import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseWords } from '../lib/game.ts';

const readJSON = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const full = readJSON('idioms');
const common = readJSON('idioms-common');
const report = readJSON('idiom-common-report');
const annotated = new Map(Object.values(readJSON('idioms copy')).flat().map(entry => [entry.word, entry]));
const removed = readJSON('removed');
const levels = new Map(Object.entries(full).flatMap(([level, words]) => words.map(word => [word, level])));

test('common default is roughly ten thousand traceable four-character words with preserved levels', () => {
  const words = Object.values(common).flat();
  assert.ok(words.length >= 8500 && words.length <= 10500);
  assert.equal(words.length, report.total);
  assert.equal(new Set(words).size, words.length);
  assert.equal(report.decisions.length, words.length);
  const decisions = new Map(report.decisions.map(row => [row.word, row]));
  for (const [level, list] of Object.entries(common)) {
    assert.equal(list.length, report.counts[level]);
    for (const word of list) {
      assert.match(word, /^\p{Script=Han}{4}$/u);
      assert.equal(levels.get(word), level);
      assert.equal(removed[word], undefined, word);
      const entry = annotated.get(word);
      assert.equal(entry.status, 'dictionary', word);
      assert.ok(entry.explanation.trim(), word);
      const decision = decisions.get(word);
      assert.ok(decision.thuocl > 1 || decision.jionlp > 1 || decision.jieba >= 4, word);
    }
  }
  for (const word of ['画蛇添足', '守株待兔', '破釜沉舟', '刻舟求剑', '亡羊补牢', '卧薪尝胆', '掩耳盗铃', '叶公好龙', '南辕北辙', '纸上谈兵']) assert.ok(words.includes(word), word);
  assert.ok(!words.includes('一丁不识'));
  assert.ok(!words.includes('敲诈勒索'));
});

test('local full archive is intact and both TXT exports round trip all words and difficulties', () => {
  const archive = JSON.parse(readFileSync(new URL('../libraries/完整题库_47150.json', import.meta.url), 'utf8'));
  assert.deepEqual(archive, full);
  for (const [file, library] of [['完整题库_47150.txt', full], [`常用竞猜题库_${report.total}.txt`, common]]) {
    const parsed = parseWords(readFileSync(new URL(`../libraries/${file}`, import.meta.url), 'utf8'));
    assert.deepEqual(parsed.words, Object.values(library).flat());
    assert.equal(parsed.invalid, 0);
    for (const [level, words] of Object.entries(library)) for (const word of words) assert.equal(parsed.marked.get(word), level);
  }
});
