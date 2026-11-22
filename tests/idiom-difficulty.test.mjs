import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calibrateThresholds, classifyDifficulty, familiarityScore } from '../scripts/idiom-difficulty.mjs';

const readJSON = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const library = readJSON('idioms');
const report = readJSON('idiom-difficulty-report');
const features = readJSON('idiom-difficulty-features');
const expansion = readJSON('idiom-expansion-report');
const added = new Set(expansion.addedWords);
const reference = Object.fromEntries(Object.entries(library).map(([level, words]) => [level, words.filter(word => !added.has(word))]));

test('classification reproduces every added word and preserves all original labels', () => {
  const thresholds = calibrateThresholds(reference, features).thresholds;
  assert.deepEqual(thresholds, report.calibration.thresholds);
  assert.deepEqual(Object.fromEntries(Object.entries(reference).map(([level, words]) => [level, words.length])), { easy: 1519, medium: 5247, hard: 779 });
  for (const [level, words] of Object.entries(library)) {
    for (const word of words.filter(word => added.has(word))) assert.equal(classifyDifficulty(word, features, thresholds), level, word);
  }
  assert.equal(report.decisions.length, expansion.added);
  assert.equal(new Set(report.decisions.map(row => row.word)).size, expansion.added);
  for (const decision of report.decisions) assert.equal(familiarityScore(decision.word, features), decision.score);
});

test('frequency increases familiarity; uncommon characters reduce it; missing data stays hard', () => {
  const f = { wordFrequencies: { 常见词语: 100, 生僻词语: 100 }, characterRanks: { 常: 1, 见: 2, 词: 3, 语: 4, 生: 4000, 僻: 7000 } };
  assert.ok(familiarityScore('常见词语', f) > familiarityScore('生僻词语', f));
  assert.ok(familiarityScore('常见词语', f) > familiarityScore('常见词语', { ...f, wordFrequencies: { 常见词语: 5 } }));
  assert.equal(classifyDifficulty('没有数据', f, report.calibration.thresholds), 'hard');
  const absent = expansion.addedWords.filter(word => !features.wordFrequencies[word]);
  assert.ok(absent.length > 0);
  assert.ok(absent.every(word => classifyDifficulty(word, features, report.calibration.thresholds) === 'hard'));
});
