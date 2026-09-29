const { app, BrowserWindow, protocol, net, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');

const root = path.resolve('desktop/renderer');
const output = path.resolve('outputs/ui-check');
const annotated = Object.values(JSON.parse(fs.readFileSync('data/idioms copy.json', 'utf8'))).flat();
const entries = new Map(annotated.map(entry => [entry.word, entry]));
fs.mkdirSync(output, { recursive: true });
protocol.registerSchemesAsPrivileged([{ scheme: 'chengyu', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
let window;
const errors = [];
const checkpoints = [];
let uploadNumber = 0;
const timeout = setTimeout(() => { console.error('UI test timed out'); app.exit(1); }, 45000);
const evaluate = script => window.webContents.executeJavaScript(script);
async function waitFor(script) {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    if (await evaluate(script)) return;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw new Error(`UI condition failed: ${script}`);
}
async function click(selector) {
  await evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) throw new Error('Missing control'); element.click(); })()`);
}
async function screenshot(name) {
  await evaluate(`Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {})))`);
  await evaluate(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
  const painted = new Promise(resolve => window.webContents.once('paint', resolve));
  window.webContents.invalidate();
  await painted;
  fs.writeFileSync(path.join(output, `${name}.png`), (await window.webContents.capturePage()).toPNG());
}
async function upload(words) {
  const filename = `ui-test-${++uploadNumber}.txt`;
  await evaluate(`(() => {
    const input = document.querySelector('input[type="file"]');
    const transfer = new DataTransfer();
    transfer.items.add(new File([${JSON.stringify(words.join('\n'))}], ${JSON.stringify(filename)}, { type: 'text/plain' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(`document.querySelector('.library>strong')?.textContent === ${JSON.stringify(filename)} && !document.querySelector('.start-row .primary').disabled`);
  assert.ok(await evaluate(`document.querySelector('.notice')?.textContent.includes('已导入 ${words.length} 个成语')`));
}
async function assertMeaning() {
  const word = await evaluate(`document.querySelector('.word-stage h1').textContent`);
  const meaning = await evaluate(`document.querySelector('.explanation').textContent`);
  assert.equal(meaning, entries.get(word)?.explanation || '暂未收录释义');
  return word;
}
async function assertNoOverflow() {
  const dimensions = await evaluate(`({ viewport: innerWidth, page: document.documentElement.scrollWidth })`);
  if (dimensions.page > dimensions.viewport + 1) console.log(await evaluate(`Array.from(document.querySelectorAll('main *')).filter(element => element.getBoundingClientRect().right > innerWidth + 1).map(element => ({ tag: element.tagName, class: element.className, right: element.getBoundingClientRect().right, text: element.textContent.slice(0,80) })).slice(0,12)`));
  assert.ok(dimensions.page <= dimensions.viewport + 1, JSON.stringify(dimensions));
}
async function assertCompetitionHidden() {
  await waitFor(`document.querySelector('.competition-toggle')?.getAttribute('aria-checked') === 'true'`);
  assert.equal(await evaluate(`!!document.querySelector('.idiom-info, .explanation, .origins, .dictionary-credits, .meaning-toggle, .review-item')`), false);
}

app.whenReady().then(async () => {
  protocol.handle('chengyu', request => {
    const url = new URL(request.url);
    const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  // The test uses the offline renderer; external requests must be unnecessary.
  const target = process.argv[2] || 'chengyu://app/';
  if (target !== 'chengyu://app/' && !/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(target)) throw new Error('UI target must be a local server');
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (details, callback) => callback({ cancel: new URL(details.url).hostname !== '127.0.0.1' }));
  window = new BrowserWindow({ width: 1200, height: 860, show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false, offscreen: true } });
  window.webContents.on('console-message', (_event, details) => { if (details.level === 'error') errors.push(details.message); });
  await window.loadURL(target);
  await waitFor(`!!document.querySelector('.modes')`);
  await click('.mode.green');
  await waitFor(`!!document.querySelector('input[aria-label="目标词数"]')`);
  await evaluate(`(() => { const input = document.querySelector('input[aria-label="目标词数"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '3'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await upload(['萍水相逢', '走马观花', '辞旧迎新']);
  assert.equal(await evaluate(`document.querySelector('.competition-toggle').getAttribute('aria-checked')`), 'false');
  await click('.competition-toggle');
  await assertCompetitionHidden();
  await click('.start-row .primary');
  await waitFor(`!!document.querySelector('.word-stage')`);
  await assertCompetitionHidden();
  const competitionWord = await evaluate(`document.querySelector('.word-stage h1').textContent`);
  await click('.competition-toggle');
  await waitFor(`!!document.querySelector('.explanation')`);
  const first = await assertMeaning();
  assert.equal(first, competitionWord);
  checkpoints.push('setup competition hides clues and restores preloaded meaning offline');
  await assertNoOverflow();
  await screenshot('desktop-game');
  await click('.meaning-toggle');
  await waitFor(`!document.querySelector('.word-layout .idiom-info')`);
  await click('.meaning-toggle');
  await waitFor(`!!document.querySelector('.word-layout .idiom-info')`);
  assert.equal(await assertMeaning(), first);
  checkpoints.push('default meaning and hide/show');
  await click('.verdict.correct');
  await waitFor(`document.querySelector('.word-stage h1')?.textContent !== ${JSON.stringify(first)}`);
  const second = await assertMeaning();
  assert.notEqual(second, first);
  checkpoints.push('next card updates meaning');
  if (await evaluate(`!!document.querySelector('.origins')`)) {
    await click('.origins summary');
    await waitFor(`document.querySelector('.origins')?.open`);
    assert.ok(await evaluate(`document.querySelector('.origin-list').textContent.length > 10`));
  }
  window.setContentSize(390, 844);
  await assertNoOverflow();
  await screenshot('mobile-game');
  await click('.competition-toggle');
  await assertCompetitionHidden();
  await assertNoOverflow();
  await screenshot('mobile-competition');
  await click('.verdict.correct');
  await waitFor(`document.querySelector('.word-stage h1')?.textContent !== ${JSON.stringify(second)}`);
  await assertCompetitionHidden();
  const nextCompetitionWord = await evaluate(`document.querySelector('.word-stage h1').textContent`);
  await click('.competition-toggle');
  await waitFor(`!!document.querySelector('.explanation')`);
  assert.equal(await assertMeaning(), nextCompetitionWord);
  checkpoints.push('midgame competition preserves progress and restores next card');
  await assertMeaning();
  await click('.meaning-toggle');
  await waitFor(`!document.querySelector('.explanation')`);
  await click('.verdict.correct');
  await waitFor(`!!document.querySelector('.results')`);
  await click('.review-item summary');
  await waitFor(`!!document.querySelector('.review-item[open] .explanation')`);
  await assertNoOverflow();
  await screenshot('mobile-review');
  await click('.competition-toggle');
  await assertCompetitionHidden();
  await assertNoOverflow();
  await click('.competition-toggle');
  await waitFor(`!!document.querySelector('.review-item')`);
  checkpoints.push('competition hides results meanings and origins');
  checkpoints.push('mobile layout and expandable results');
  window.setContentSize(1200, 820);
  await click('.result-actions .secondary');
  await waitFor(`!!document.querySelector('input[type="file"]')`);
  await upload(['辞旧迎新', '未收录词', '萍水相逢']);
  await click('.start-row .primary');
  await waitFor(`!!document.querySelector('.word-stage')`);
  await waitFor(`!!document.querySelector('.explanation')`);
  checkpoints.push('new round defaults to expanded meaning after previous manual hiding');
  const visited = [];
  for (let i = 0; i < 3; i++) {
    const word = await assertMeaning();
    visited.push(word);
    if (word === '未收录词') assert.equal(await evaluate(`!!document.querySelector('.origins')`), false);
    if (word === '辞旧迎新') {
      assert.equal(await evaluate(`document.querySelector('.generated-note').textContent`), '补充释义，待核对');
      assert.equal(await evaluate(`!!document.querySelector('.origins')`), false);
    }
    await click('.verdict.correct');
    if (i < 2) await waitFor(`document.querySelector('.word-stage h1')?.textContent !== ${JSON.stringify(word)}`);
  }
  assert.deepEqual(visited.sort(), ['辞旧迎新', '未收录词', '萍水相逢'].sort());
  checkpoints.push('unknown TXT and generated entries have no invented origin');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ ok: true, checkpoints, errors }, null, 2));
  console.log(JSON.stringify({ ok: true, checkpoints, screenshots: output }, null, 2));
  clearTimeout(timeout);
  app.exit(0);
}).catch(async error => {
  console.error(error);
  if (window) await screenshot('failure').catch(() => {});
  clearTimeout(timeout);
  app.exit(1);
});
