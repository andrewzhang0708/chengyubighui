import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { normalizeWord, usableText } from './idiom-enrichment.mjs';

const readJSON = async path => JSON.parse(await readFile(path, 'utf8'));
const path = 'work/idiom-sources/wordsquares-idioms.txt';
const bytes = await readFile(path);
const library = await readJSON('data/idioms.json');
const existing = new Set(Object.values(library).flat());
const before = existing.size;
const dictionary = new Set();
for (const id of ['xinhua', 'li1fan']) {
  for (const row of await readJSON(`work/idiom-sources/${id}.json`)) {
    if (usableText(row.explanation)) dictionary.add(normalizeWord(row.word));
  }
}
const candidates = [...new Set(bytes.toString('utf8').split(/\r?\n/).map(normalizeWord).filter(word => /^\p{Script=Han}{4}$/u.test(word)))];
const added = [], rejected = [];
for (const word of candidates) {
  if (existing.has(word)) continue;
  if (!dictionary.has(word) || normalizeWord(word) !== word) { rejected.push(word); continue; }
  existing.add(word);
  library.hard.push(word);
  added.push(word);
}
if (!added.length) {
  console.log('No new words; preserving existing expansion provenance and difficulty labels.');
  process.exit(0);
}
const report = {
  source: 'https://github.com/Gaussio/WordSquares-Chinese',
  download: 'https://raw.githubusercontent.com/Gaussio/WordSquares-Chinese/main/dictionaries/idioms.txt',
  sha256: createHash('sha256').update(bytes).digest('hex'),
  rules: ['四个汉字', '繁体转简体后去重', '必须在 xinhua 或 li1fan 成语库中有释义', '保留原分级，新增词暂归 hard；未经逐词人工难度评定'],
  before, candidates: candidates.length, added: added.length, after: existing.size,
  counts: Object.fromEntries(Object.entries(library).map(([level, words]) => [level, words.length])),
  addedWords: added, rejectedWithoutDefinition: rejected,
};
await writeFile('data/idioms.json', JSON.stringify(library, null, 2) + '\n');
await writeFile('data/idiom-expansion-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ before, candidates: report.candidates, added: added.length, after: report.after, counts: report.counts, rejected: rejected.length }, null, 2));
