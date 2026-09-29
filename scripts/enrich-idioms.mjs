import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { buildIndex, dictionaryRecord, moeRecord, normalizeWord, parseCSV, selectEntry } from './idiom-enrichment.mjs';

const readJSON = async path => JSON.parse(await readFile(path, 'utf8'));
const cache = resolve('work/idiom-sources');
const manifest = await readJSON(resolve(cache, 'manifest.json'));
async function readSource(id, extension = 'json') {
  const bytes = await readFile(resolve(cache, `${id}.${extension}`));
  if (createHash('sha256').update(bytes).digest('hex') !== manifest[id].sha256) throw new Error(`Source checksum mismatch: ${id}`);
  return extension === 'json' ? JSON.parse(bytes.toString('utf8')) : bytes.toString('utf8');
}

const phrases = Object.entries(await readSource('phrases')).map(([word, row]) => dictionaryRecord(word, row['解释'], row['出处'], 'phrases', row['链接']));
const xinhua = (await readSource('xinhua')).map(row => dictionaryRecord(row.word, row.explanation, row.derivation, 'xinhua'));
const li1fan = (await readSource('li1fan')).map(row => dictionaryRecord(row.word, row.explanation, row.derivation, 'li1fan'));
const bySyk = parseCSV(await readSource('by-syk', 'txt')).map(row => dictionaryRecord(row[1], row[3], row[4], 'by-syk'));
const moe = (await readSource('moe')).idioms.map(moeRecord);
const words = (await readSource('xinhua-words')).map(row => dictionaryRecord(row.ci, row.explanation, '', 'xinhua-words'));
const moedict = (await readSource('moedict')).map(row => dictionaryRecord(row.title,
  row.heteronyms?.flatMap(variant => variant.definitions?.map(definition => definition.def) ?? []).filter(Boolean).join('\n'), '', 'moedict',
  `https://www.moedict.tw/${encodeURIComponent(row.title)}`));
// Prefer the clean simplified dictionary. Other sources fill absent fields independently.
const index = buildIndex([...phrases, ...li1fan, ...bySyk, ...xinhua, ...moe, ...words, ...moedict]);
const webRecords = await readJSON('data/idiom-web-records.json');
for (const [word, records] of buildIndex(webRecords)) index.set(word, [...(index.get(word) ?? []), ...records]);
const aliases = await readJSON('data/idiom-aliases.json');
const fallbacks = await readJSON('data/idiom-fallbacks.json');
const input = await readJSON('data/idioms.json');
const output = {};
const missing = [], generated = [], differences = [], withoutOrigin = [];
const sourcesUsed = {};
for (const [level, items] of Object.entries(input)) {
  output[level] = items.map(word => {
    const direct = index.get(normalizeWord(word)) ?? [];
    const alias = aliases[word];
    const related = alias ? (index.get(normalizeWord(alias)) ?? []).map(record => ({ ...record,
      origins: record.origins.map(origin => ({ ...origin, kind: 'related', referenceWord: alias })) })) : [];
    const records = [...direct, ...related];
    const entry = selectEntry(word, records, direct.some(record => record.explanation) ? undefined : alias, fallbacks[word]);
    // MOE explicitly links 走馬觀花 to 走馬看花 and lists two different literary origins.
    if (word === '走马观花') {
      const main = moe.find(record => record.word === '走馬看花');
      if (main?.origins.length) entry.origins = main.origins.map((origin, i) => ({ ...origin, kind: i === 0 ? 'paraphrase' : 'related', referenceWord: '走马看花',
        note: i === 0 ? '由诗意概括形成，原文未连续出现这四个字。' : '词典列出的另一典源说法，并非唯一确定的出处。' }));
    }
    if (entry.status === 'missing') missing.push(word);
    if (entry.status === 'generated') generated.push(word);
    if (!entry.origins.length) withoutOrigin.push(word);
    if (entry.explanationSource) sourcesUsed[entry.explanationSource] = (sourcesUsed[entry.explanationSource] ?? 0) + 1;
    const variants = records.filter(record => record.explanation).filter((record, i, all) => all.findIndex(other => normalizeWord(other.explanation).replace(/[\s；;，,。．]/g, '') === normalizeWord(record.explanation).replace(/[\s；;，,。．]/g, '')) === i);
    if (variants.length > 1) differences.push({ word, selectedSource: entry.explanationSource,
      candidates: variants.map(({ explanation, origins, sourceId, sourceUrl, word: sourceWord }) => ({ explanation, origins, sourceId, sourceUrl, sourceWord })) });
    return entry;
  });
}

const sourceInfo = {
  phrases: { name: '在线成语词典语料库', upstream: '在线成语词典（5156edu）', license: '仓库未声明数据再分发许可；保留原网页来源。' },
  xinhua: { name: 'chinese-xinhua · 成语库', upstream: '网络词典汇编，并非新华字典出版社官方数据库', license: '仓库标注 MIT；数据来自网络，原始内容权利不由代码许可替代。' },
  li1fan: { name: 'chinese-idiom · 成语库', upstream: '网络词典汇编', license: '仓库标注 MIT；README 说明仅作学习使用，保留来源。' },
  'by-syk': { name: 'Chinese idiom data', upstream: '非官方网络资料，作者说明未经严格校对', license: '未发现独立数据许可，保留来源。' },
  moe: { name: '教育部《成语典》', upstream: '教育部《成语典》2020（20260324 整理版）', license: 'CC BY-ND 3.0 TW。所用释义、典源保留原文，不由 LLM 改写。', attribution: '本数据采用教育部《成语典》之部分内容。教育部公眾授權字詞資料來源網站：https://dict.idioms.moe.edu.tw/', officialUrl: 'https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/dict_idiomsdict_download.html' },
  'xinhua-words': { name: 'chinese-xinhua · 词语库', upstream: '网络词典汇编', license: '仓库标注 MIT；数据来自网络，保留来源。' },
  moedict: { name: '教育部《重编国语辞典修订本》', upstream: '教育部原始辞典，经 g0v 整理为 JSON（备份版）', license: 'CC BY-ND 3.0 TW。保留释义原文，格式转换的编辑权以 CC0 释出。', attribution: '本数据采用教育部《重编国语辞典修订本》之部分内容。教育部公眾授權字詞資料來源網站：https://dict.revised.moe.edu.tw/' },
};
const provenance = Object.fromEntries(Object.entries(manifest).map(([id, record]) => [id, { ...sourceInfo[id], ...record, repositoryUrl: `https://github.com/${record.repository}` }]));
provenance.zdic = { name: '汉典', upstream: '公开词语释义页面（逐词查询）', license: '保留原文与词条链接，原始内容权利归来源所有。', repositoryUrl: 'https://www.zdic.net/', records: webRecords.length };
const total = Object.values(output).flat().length;
const summary = { total, dictionary: total - missing.length - generated.length, generated: generated.length, missing: missing.length,
  withOrigin: total - withoutOrigin.length, withoutOrigin: withoutOrigin.length, differingDefinitions: differences.length, sourcesUsed };
const serialise = value => JSON.stringify(value, null, 2) + '\n';
// Calculate everything before writing: a missing source must not truncate the annotated library.
await writeFile('data/idioms copy.json', serialise(output));
await writeFile('data/idiom-sources.json', serialise(provenance));
await writeFile('data/idiom-enrichment-report.json', serialise({ summary, missing, generated, withoutOrigin,
  note: 'differingDefinitions 表示来源表述不同，不等于语义冲突；候选详见 work/idiom-sources/definition-differences.json。未把 example／书证字段当作出处。' }));
await writeFile(resolve(cache, 'definition-differences.json'), serialise(differences));
console.log(serialise(summary));
if (missing.length) console.log('Missing:', missing.join('、'));
