import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { calibrateThresholds, classifyDifficulty, familiarityScore } from './idiom-difficulty.mjs';

const readJSON = async path => JSON.parse(await readFile(path, 'utf8'));
const saveJSON = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const library = await readJSON('data/idioms.json');
const expansion = await readJSON('data/idiom-expansion-report.json');
const added = new Set(expansion.addedWords);
const allWords = Object.values(library).flat();
const currentWords = new Set(allWords);
const reference = Object.fromEntries(Object.entries(library).map(([level, words]) => [level, words.filter(word => !added.has(word))]));
let features;
if (process.argv.includes('--extract-features')) {
  const bytes = await readFile('work/idiom-sources/jieba-dict.txt');
  const wantedWords = new Set(allWords);
  const characterFrequencies = new Map();
  const wordFrequencies = {};
  for (const line of bytes.toString('utf8').split(/\r?\n/)) {
    const [word, value] = line.split(' ');
    const frequency = Number(value);
    if (!word || !Number.isFinite(frequency) || frequency <= 0) continue;
    if (wantedWords.has(word)) wordFrequencies[word] = frequency;
    for (const char of word) if (/^\p{Script=Han}$/u.test(char)) characterFrequencies.set(char, (characterFrequencies.get(char) ?? 0) + frequency);
  }
  const ranked = [...characterFrequencies].sort((a, b) => b[1] - a[1] || a[0].codePointAt(0) - b[0].codePointAt(0));
  const wantedChars = new Set(allWords.join(''));
  const characterRanks = Object.fromEntries(ranked.flatMap(([char], index) => wantedChars.has(char) ? [[char, index + 1]] : []));
  features = {
    source: { url: 'https://raw.githubusercontent.com/fxsjy/jieba/master/jieba/dict.txt', sha256: createHash('sha256').update(bytes).digest('hex'), license: 'MIT; see jieba-LICENSE.txt', note: '词频是分词词典权重；字频由词频加权统计，均为熟悉度近似指标。' },
    wordFrequencies, characterRanks,
  };
  await saveJSON('data/idiom-difficulty-features.json', features);
} else features = await readJSON('data/idiom-difficulty-features.json');
const calibration = calibrateThresholds(reference, features);
const output = Object.fromEntries(Object.entries(reference).map(([level, words]) => [level, [...words]]));
const decisions = expansion.addedWords.map(word => {
  if (!currentWords.has(word)) throw Error(`Missing new word: ${word}`);
  const level = classifyDifficulty(word, features, calibration.thresholds);
  output[level].push(word);
  return { word, level, frequency: features.wordFrequencies[word] ?? 0, score: familiarityScore(word, features) };
});
const details = new Map(Object.values(await readJSON('data/idioms copy.json')).flat().map(entry => [entry.word, entry]));
const annotated = Object.fromEntries(Object.entries(output).map(([level, words]) => [level, words.map(word => {
  if (!details.has(word)) throw Error(`Missing annotation: ${word}`);
  return details.get(word);
})]));
const counts = words => Object.fromEntries(Object.entries(words).map(([level, rows]) => [level, rows.length]));
const report = {
  algorithm: 'jieba-familiarity-v1',
  formula: 'score=max(0, round(100*(log10(1+wordFrequency)-sum(characterPenalty)))); rank<=3500:0, rank<=6500:0.25, other/missing:0.75',
  calibration: { ...calibration, referenceCounts: counts(reference), note: '训练集平均召回率，不是独立测试准确率。原有词的分级不变。' },
  source: features.source,
  newCounts: counts(Object.fromEntries(Object.keys(output).map(level => [level, decisions.filter(row => row.level === level)]))),
  totalCounts: counts(output),
  limitations: '按熟悉度近似难度；无法精确衡量比划难度、多义性、典故门槛。词典未收录或极低频词保守分为困难，不强制按比例分级。',
  decisions,
};
await saveJSON('data/idioms.json', output);
await saveJSON('data/idioms copy.json', annotated);
await saveJSON('data/idiom-difficulty-report.json', report);
console.log(JSON.stringify({ ...calibration, newCounts: report.newCounts, totalCounts: report.totalCounts }, null, 2));
