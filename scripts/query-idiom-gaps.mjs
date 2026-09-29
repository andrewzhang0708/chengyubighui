import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve('work/idiom-sources/pages');
await mkdir(directory, { recursive: true });
const { missing } = JSON.parse(await readFile('data/idiom-enrichment-report.json', 'utf8'));
const selected = process.argv.includes('--sample') ? missing.slice(0, 3) : missing;
let pages = {};
try { pages = JSON.parse(await readFile('work/idiom-sources/pages.json', 'utf8')); } catch { /* First query. */ }
for (const word of selected) {
  if (pages[word]) continue;
  const url = `https://www.zdic.net/hans/${encodeURIComponent(word)}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'ChengyuDahui dictionary lookup' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    await writeFile(resolve(directory, `${word}.html`), html);
    pages[word] = { url, status: response.status, bytes: Buffer.byteLength(html), file: `${word}.html` };
    console.log(`${word}: ${pages[word].bytes} bytes`);
  } catch (error) {
    pages[word] = { url, error: error.message };
    console.log(`${word}: ${error.message}`);
  }
  await writeFile('work/idiom-sources/pages.json', JSON.stringify(pages, null, 2) + '\n');
  // Sequential requests and a local cache keep the lookup load low.
  await new Promise(resolve => setTimeout(resolve, 500));
}
