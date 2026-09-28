import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRound, elapsed, formatTime, judge, levelCounts, parseWords, shuffled, stratified, tick, validateSettings } from '../lib/game.ts';

const words = ['坚定不移', '随时随地', '全力以赴', '丰富多彩', '脱颖而出'];
const ratios = { easy: 40, medium: 40, hard: 20 };
const settings = { target: 2, seconds: 2, fouls: 0, skips: 0, ratios };
const medium = () => 'medium';
const counts = count => ({ easy: 0, medium: count, hard: 0 });

test('TXT import handles BOM, whitespace, frequencies, duplicates and invalid lines', () => {
  assert.deepEqual(parseWords('\uFEFF坚定不移\t54113\r\n随时随地   52510\n\n坚定不移\n三字词\n五个字词语\nABCD\n'), {
    words: ['坚定不移', '随时随地'], marked: new Map(), invalid: 3, duplicates: 1,
  });
});

test('TXT import reads an optional difficulty mark in the second column', () => {
  const result = parseWords('画蛇添足 下\n如火如荼 中\n首鼠两端 上\n醍醐灌顶 hard\n一心一意 12\n');
  assert.deepEqual([...result.marked], [['画蛇添足', 'easy'], ['如火如荼', 'medium'], ['首鼠两端', 'hard'], ['醍醐灌顶', 'hard']]);
  assert.equal(result.words.length, 5);
});

const tiered = Object.fromEntries([...Array(100)].map((_, i) => [`易${i}`, 'easy']).concat([...Array(100)].map((_, i) => [`中${i}`, 'medium']), [...Array(100)].map((_, i) => [`难${i}`, 'hard'])));
const tieredWords = Object.keys(tiered);
const tierOf = word => tiered[word];

test('every block of ten follows the configured difficulty ratio', () => {
  for (const r of [{ easy: 40, medium: 40, hard: 20 }, { easy: 60, medium: 30, hard: 10 }, { easy: 34, medium: 33, hard: 33 }]) {
    const deck = stratified(tieredWords, r, tierOf);
    for (const size of [10, 20, 50]) {
      const prefix = levelCounts(deck.slice(0, size).map(card => card.word), tierOf);
      for (const level of ['easy', 'medium', 'hard']) assert.ok(Math.abs(prefix[level] - size * r[level] / 100) <= 1, `${JSON.stringify(r)} ${size} ${level}`);
    }
    assert.ok(deck.every(card => card.level === tierOf(card.word)));
  }
});

test('zero-ratio levels never appear and exhausted levels are backfilled', () => {
  const deck = stratified(tieredWords, { easy: 50, medium: 50, hard: 0 }, tierOf);
  assert.equal(deck.length, 200);
  assert.equal(deck.some(card => card.level === 'hard'), false);
  const small = stratified([...tieredWords.slice(0, 3), ...tieredWords.slice(100, 200)], { easy: 50, medium: 50, hard: 0 }, tierOf);
  assert.equal(small.length, 103);
  assert.equal(new Set(small.map(card => card.word)).size, 103);
  assert.match(validateSettings('word', { ...settings, target: 250, ratios: { easy: 50, medium: 50, hard: 0 } }, levelCounts(tieredWords, tierOf)), /200 个/);
  assert.match(validateSettings('time', { ...settings, ratios: { easy: 0, medium: 0, hard: 100 } }, counts(5)), /调整难度比例/);
});

test('built-in library is tiered, four-character and free of duplicates', () => {
  const idioms = JSON.parse(readFileSync(new URL('../data/idioms.json', import.meta.url), 'utf8'));
  const all = [...idioms.easy, ...idioms.medium, ...idioms.hard];
  assert.equal(new Set(all).size, all.length);
  assert.ok(all.every(word => /^\p{Script=Han}{4}$/u.test(word)));
  for (const level of ['easy', 'medium', 'hard']) assert.ok(idioms[level].length >= 500, level);
});

test('word mode only counts correct answers and allows exceeding foul/skip limits', () => {
  let round = createRound('word', settings, words, 1000, medium);
  round = judge(round, 'foul', 1100);
  round = judge(round, 'skip', 1200);
  assert.equal(round.correct, 0);
  assert.equal(round.endedAt, null);
  round = judge(round, 'correct', 1300);
  assert.equal(round.endedAt, null);
  round = judge(round, 'correct', 1400);
  assert.equal(round.correct, 2);
  assert.equal(round.endedAt, 1400);
  assert.equal(elapsed(round, 9000), 400);
  assert.equal(judge(round, 'correct', 1500), round);
  assert.equal(new Set(round.history.map(entry => entry.word)).size, 4);
  assert.ok(round.history.every(entry => entry.level === 'medium'));
});

test('answer at the timer deadline does not score, delayed timer ends at exact deadline', () => {
  const round = createRound('time', settings, words, 1000, medium);
  assert.equal(judge(round, 'correct', 2999).correct, 1);
  const late = judge(round, 'correct', 3000);
  assert.equal(late.correct, 0);
  assert.equal(late.endedAt, 3000);
  assert.equal(tick(round, 50000).endedAt, 3000);
});

test('word timer has no countdown limit and exhausted library ends cleanly', () => {
  const round = createRound('word', { ...settings, target: 1 }, [words[0]], 0, medium);
  assert.equal(tick(round, 99999999), round);
  const ended = judge(round, 'skip', 99999999);
  assert.equal(ended.correct, 0);
  assert.match(ended.reason, /题库/);
  assert.equal(ended.endedAt, 99999999);
});

test('prepares requested count plus allowances plus ten, then replenishes unused words', () => {
  const library = Array.from({ length: 30 }, (_, i) => `词条${i}`);
  let round = createRound('word', settings, library, 0, medium);
  assert.equal(round.prepared, 12);
  for (let i = 0; i < 13; i++) round = judge(round, 'skip', i + 1);
  assert.equal(round.endedAt, null);
  assert.equal(round.prepared, 22);
  assert.equal(new Set(round.history.map(entry => entry.word)).size, 13);
});

test('validates impossible targets, empty libraries, non-integers and negative counts', () => {
  assert.match(validateSettings('word', { ...settings, target: 6 }, counts(5)), /超过/);
  assert.ok(validateSettings('word', settings, counts(0)));
  assert.ok(validateSettings('time', { ...settings, seconds: NaN }, counts(5)));
  assert.ok(validateSettings('word', { ...settings, target: 1.5 }, counts(5)));
  assert.ok(validateSettings('time', { ...settings, fouls: -1 }, counts(5)));
  assert.equal(validateSettings('word', settings, counts(5)), '');
  assert.ok(validateSettings('time', { ...settings, ratios: { easy: 50, medium: 50, hard: 1 } }, counts(5)));
  assert.ok(validateSettings('time', { ...settings, ratios: { easy: 50, medium: NaN, hard: 50 } }, counts(5)));
});

test('shuffle preserves every word without mutating source; timers round in correct direction', () => {
  const before = [...words];
  assert.deepEqual([...shuffled(words)].sort(), [...words].sort());
  assert.deepEqual(words, before);
  assert.equal(formatTime(1, true), '00:01');
  assert.equal(formatTime(999), '00:00');
  assert.equal(formatTime(3600000), '60:00');
  assert.equal(formatTime(-1, true), '00:00');
});
