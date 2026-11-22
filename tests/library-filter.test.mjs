import test from 'node:test';
import assert from 'node:assert/strict';
import { filteredFilename, serializeLibrary, filterRatios } from '../lib/library-filter.ts';
import { parseWords, stratified, levelCounts } from '../lib/game.ts';

test('filter deals 2 easy, 3 medium, 5 hard per block without repeats and backfills depleted tiers', () => {
  let seed = 1234;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const words = ['easy', 'medium', 'hard'].flatMap(level => Array.from({ length: 100 }, (_, i) => `${level}:${i}`));
  const classify = word => word.split(':')[0];
  const deck = stratified(words, filterRatios, classify, random);
  for (let index = 0; index < 200; index += 10) {
    assert.deepEqual(levelCounts(deck.slice(index, index + 10).map(card => card.word), classify), { easy: 2, medium: 3, hard: 5 });
  }
  assert.equal(deck.length, 300);
  assert.equal(new Set(deck.map(card => card.word)).size, 300);
  assert.notDeepEqual(deck.map(card => card.word), words);
  assert.equal(stratified(['hard:1', 'hard:2'], filterRatios, classify, random).length, 2);
  assert.deepEqual(stratified([], filterRatios, classify, random), []);
});

test('filtered exports append local timestamp and preserve filename stem', () => {
  const date = new Date(2026, 10, 21, 8, 9, 5);
  assert.equal(filteredFilename('我的题库.TXT', date), '我的题库_20261121_080905.txt');
  assert.equal(filteredFilename('内置题库副本', date), '内置题库副本_20261121_080905.txt');
});

test('filtered TXT round trips retained words and difficulty including an empty library', () => {
  const words = ['一心一意', '心想事成', '一丁不识'];
  const levels = ['easy', 'medium', 'hard'];
  const classify = word => levels[words.indexOf(word)];
  const retained = [words[0], words[2]];
  const parsed = parseWords(serializeLibrary(retained, classify));
  assert.deepEqual(parsed.words, retained);
  assert.deepEqual([...parsed.marked.values()], ['easy', 'hard']);
  assert.equal(parsed.invalid, 0);
  assert.deepEqual(parseWords(serializeLibrary([], classify)).words, []);
});
