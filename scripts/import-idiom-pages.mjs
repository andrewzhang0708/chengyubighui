import { readFile, writeFile } from 'node:fs/promises';
import { dictionaryRecord } from './idiom-enrichment.mjs';

const pages = JSON.parse(await readFile('work/idiom-sources/pages.json', 'utf8'));
const entries = [];
for (const [word, page] of Object.entries(pages)) {
  if (!page.file) continue;
  const html = await readFile(`work/idiom-sources/pages/${page.file}`, 'utf8');
  if (!html.includes(`<title>${word}`)) throw new Error(`Wrong dictionary page: ${word}`);
  const definitions = [...html.matchAll(/<div class="xxjs-item__def">([\s\S]*?)<\/div>/g)]
    .map(match => match[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()).filter(Boolean);
  if (definitions.length) entries.push(dictionaryRecord(word, definitions.join('\n'), '', 'zdic', page.url));
}
await writeFile('data/idiom-web-records.json', JSON.stringify(entries, null, 2) + '\n');
console.log(`Imported ${entries.length} definitions from cached dictionary pages.`);
