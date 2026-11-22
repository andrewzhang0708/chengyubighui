const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = path.resolve('outputs/filter-check');
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, 'electron-profile'));
app.disableHardwareAcceleration();
let win;
const run = script => win.webContents.executeJavaScript(script);
async function waitFor(script) {
  for (let i = 0; i < 150; i++) {
    if (await run(script)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw Error(`Timed out: ${script}`);
}
const click = selector => run(`document.querySelector(${JSON.stringify(selector)}).click()`);
let download;
app.whenReady().then(async () => {
  session.defaultSession.on('will-download', (_event, item) => {
    const target = path.join(output, item.getFilename());
    item.setSavePath(target);
    download = new Promise((resolve, reject) => item.once('done', (_event, state) => state === 'completed' ? resolve(target) : reject(Error(state))));
  });
  win = new BrowserWindow({ width: 1200, height: 860, show: false, webPreferences: { contextIsolation: true, sandbox: true } });
  win.webContents.on('console-message', (_event, details) => { if (details.level === 'error') console.error(details.message); });
  await win.loadURL('http://localhost:3000');
  await waitFor(`!!document.querySelector('.mode')`);
  await new Promise(resolve => setTimeout(resolve, 1500));
  await click('.mode');
  await waitFor(`!!document.querySelector('.filter-library-button')`);
  await click('.filter-library-button');
  await waitFor(`!!document.querySelector('.filter-verdicts')`);
  assert.equal(await run(`document.querySelector('.filter-library-name').textContent`), '内置题库副本.txt');
  assert.equal(await run(`!!document.querySelector('.scoreboard, .progress, .word-number .count')`), false);
  const levels = { easy: 0, medium: 0, hard: 0 };
  for (let i = 0; i < 10; i++) {
    const level = await run(`['easy','medium','hard'].find(level => document.querySelector('.word-stage .level').classList.contains(level))`);
    levels[level]++;
    await click('.filter-verdicts .correct');
  }
  assert.deepEqual(levels, { easy: 2, medium: 3, hard: 5 });
  const rejected = await run(`document.querySelector('.word-stage h1').textContent`);
  await click('.filter-verdicts .foul');
  const retained = await run(`document.querySelector('.word-stage h1').textContent`);
  await click('.filter-verdicts .correct');
  await new Promise(resolve => setTimeout(resolve, 200));
  fs.writeFileSync(path.join(output, 'filter-desktop.png'), (await win.webContents.capturePage()).toPNG());
  win.setSize(390, 844);
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.ok(await run(`document.documentElement.scrollWidth <= innerWidth + 1`));
  fs.writeFileSync(path.join(output, 'filter-mobile.png'), (await win.webContents.capturePage()).toPNG());
  await click('.exit-button');
  await waitFor(`!!document.querySelector('.library>strong')`);
  await waitFor(`document.querySelector('.library>strong').textContent.includes('_')`);
  while (!download) await new Promise(resolve => setTimeout(resolve, 20));
  const file = await download;
  const content = fs.readFileSync(file, 'utf8');
  assert.ok(!content.includes(rejected));
  assert.ok(content.includes(retained));
  const originalCount = Object.values(JSON.parse(fs.readFileSync('data/idioms.json', 'utf8'))).flat().length;
  assert.equal(content.trim().split(/\r?\n/).length, originalCount - 1);
  await click('.library>.text-button');
  assert.equal(await run(`document.querySelector('.library>strong').textContent`), '内置题库');
  // Imported files keep their own name; finishing with no retained words exports an empty TXT.
  await run(`(() => { const input = document.querySelector('input[type=file]'); const data = new DataTransfer(); data.items.add(new File(['一心一意 下'], 'custom.txt', {type:'text/plain'})); input.files = data.files; input.dispatchEvent(new Event('change', {bubbles:true})); })()`);
  await waitFor(`document.querySelector('.library>strong').textContent === 'custom.txt'`);
  await click('.filter-library-button');
  assert.equal(await run(`document.querySelector('.filter-library-name').textContent`), 'custom.txt');
  await click('.filter-verdicts .foul');
  await waitFor(`!!document.querySelector('.filter-complete')`);
  download = undefined;
  await click('.exit-button');
  while (!download) await new Promise(resolve => setTimeout(resolve, 20));
  const emptyFile = await download;
  assert.match(path.basename(emptyFile), /^custom_\d{8}_\d{6}\.txt$/);
  assert.equal(fs.readFileSync(emptyFile, 'utf8').replace(/^\uFEFF/, ''), '');
  console.log('Filter UI passed: default copy, removal, retain, partial save, restore, imported filename, empty export, mobile layout.');
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
setTimeout(() => { console.error('Filter UI timeout'); app.exit(1); }, 45000);
