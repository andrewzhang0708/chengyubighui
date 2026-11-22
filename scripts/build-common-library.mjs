import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { normalizeWord } from './idiom-enrichment.mjs';

const readJSON = async path => JSON.parse(await readFile(path, 'utf8'));
const saveJSON = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
let frequencies;
if (process.argv.includes('--extract-features')) {
  const thu = await readFile('work/idiom-sources/thuocl-chengyu.txt');
  const jio = await readFile('work/idiom-sources/jionlp/chinese_idiom.txt');
  const parse = bytes => {
    const result = {};
    for (const line of bytes.toString('utf8').split(/\r?\n/)) {
      const [raw, count] = line.trim().split(/\s+/);
      const word = normalizeWord(raw ?? '');
      if (!/^\p{Script=Han}{4}$/u.test(word) || !Number.isFinite(Number(count))) continue;
      result[word] = Math.max(result[word] ?? 0, Number(count));
    }
    return result;
  };
  frequencies = {
    sources: {
      thuocl: { url: 'https://github.com/thunlp/THUOCL', file: 'data/THUOCL_chengyu.txt', sha256: createHash('sha256').update(thu).digest('hex'), license: 'MIT; see thuocl-LICENSE.txt', attribution: '使用了清华大学开放中文词库；韩世依、张钰晖、马云山等。', note: '新浪新闻文档频率 DF，原词表 8519 条；与 JioNLP 的词频大量重合，不按独立语料重复计分。' },
      jionlp: { url: 'https://github.com/dongrixinyu/JioNLP', revision: '35a904ed4a4be99af94a6eaeb4276a7a8ceb6db2', file: 'jionlp/dictionary/chinese_idiom.zip', sha256: createHash('sha256').update(jio).digest('hex'), license: 'Apache-2.0; see jionlp-LICENSE.txt', attribution: 'Chengyu Cui, JioNLP (2020).', note: '百万篇文档词频；1 为未出现词的平滑值，不视为使用证据。' },
    },
    thuocl: parse(thu), jionlp: parse(jio),
  };
  await saveJSON('data/idiom-common-frequencies.json', frequencies);
} else frequencies = await readJSON('data/idiom-common-frequencies.json');

const full = await readJSON('data/idioms.json');
const details = new Map(Object.values(await readJSON('data/idioms copy.json')).flat().map(entry => [entry.word, entry]));
const features = await readJSON('data/idiom-difficulty-features.json');
const removed = await readJSON('data/removed.json');
const selected = { easy: [], medium: [], hard: [] };
const decisions = [], excluded = {};
for (const [level, words] of Object.entries(full)) {
  for (const word of words) {
    const entry = details.get(word);
    const thuocl = frequencies.thuocl[word] ?? 0;
    const jionlp = frequencies.jionlp[word] ?? 0;
    const jieba = features.wordFrequencies[word] ?? 0;
    let reason;
    if (!/^\p{Script=Han}{4}$/u.test(word)) reason = '非四字词';
    else if (removed[word]) reason = '原项目排除的普通词组、术语或异形词';
    else if (!entry?.explanation.trim() || entry.status !== 'dictionary') reason = '缺少词典释义或仅有 AI 补充释义';
    else if (entry.relatedWord && [...entry.relatedWord.replace(/[^\p{Script=Han}]/gu, '')].length > 4) reason = '依赖完整长句的截取片段';
    else if (!(thuocl > 1 || jionlp > 1 || jieba >= 4)) reason = '缺少常用证据（不以平滑词频或字面熟悉度凑数）';
    if (reason) { excluded[reason] = (excluded[reason] ?? 0) + 1; continue; }
    selected[level].push(word);
    decisions.push({ word, level, thuocl, jionlp, jieba });
  }
}
const total = Object.values(selected).flat().length;
if (total < 8500 || total > 10500) throw Error(`Unexpected curated library size: ${total}; review source changes before replacing the default.`);
const marks = { easy: '下', medium: '中', hard: '上' };
const txt = '\uFEFF' + Object.entries(selected).flatMap(([level, words]) => words.map(word => `${word} ${marks[level]}`)).join('\r\n');
const annotated = Object.fromEntries(Object.entries(selected).map(([level, words]) => [level, words.map(word => details.get(word))]));
await saveJSON('data/idioms-common.json', selected);
await writeFile(`libraries/常用竞猜题库_${total}.txt`, txt);
await saveJSON(`libraries/常用竞猜题库_${total}_含释义.json`, annotated);
const report = {
  name: '常用竞猜题库', total, counts: Object.fromEntries(Object.entries(selected).map(([level, words]) => [level, words.length])),
  description: '参考中国成语大会的释义、典故与语义竞猜方向筛选；非央视官方题库，也未宣称为出版词典原词表。保留常见入门词供聚会热身。',
  editorialReferences: [
    { url: 'https://1118.cctv.com/2014/05/16/ARTI1400206078537398.shtml', note: '央视总导演访谈：排除极少使用的词，重视释义、文化内涵；常用程度不等同于猜词难度。' },
    { url: 'https://www.cp.com.cn/book/a83b8cf6-d.html', note: '商务印书馆新华成语词典第二版为一万余条常用成语，作为目标规模参考；未复制该词典内容。' },
  ],
  rules: ['保留四字词且有非 AI 词典释义', '排除原项目 removed.json 中的普通词组、术语、异形词', '排除仅靠更长成句补充释义的截取片段', 'THUOCL/JioNLP 文档频率大于 1，或 jieba 词频至少为 4；不靠平滑值凑到整数一万', '保留原词库难度及顺序；筛选出题仍为 20/30/50 随机混排'],
  limitations: '自动筛选的常用竞猜候选；新闻语料有年代和体裁偏差，少量低频挑战词仍可能较生僻，未逐词人工审定比划难度。',
  sources: frequencies.sources, excluded, decisions,
};
await saveJSON('data/idiom-common-report.json', report);
console.log(JSON.stringify({ total, counts: report.counts, excluded }, null, 2));
