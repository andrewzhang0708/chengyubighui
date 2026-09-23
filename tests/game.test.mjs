import test from 'node:test';
import assert from 'node:assert/strict';
import { createRound, elapsed, formatTime, judge, parseWords, shuffled, tick, validateSettings } from '../lib/game.ts';

const words = ['坚定不移', '随时随地', '全力以赴', '丰富多彩', '脱颖而出'];
const settings = { target: 2, seconds: 2, fouls: 0, skips: 0 };

test('TXT import handles BOM, whitespace, frequencies, duplicates and invalid lines', () => {
  assert.deepEqual(parseWords('\uFEFF坚定不移\t54113\r\n随时随地   52510\n\n坚定不移\n三字词\n五个字词语\nABCD\n'), {
    words: ['坚定不移', '随时随地'], invalid: 3, duplicates: 1,
  });
});

test('word mode only counts correct answers and allows exceeding foul/skip limits', () => {
  let round = createRound('word', settings, words, 1000);
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
});

test('answer at the timer deadline does not score, delayed timer ends at exact deadline', () => {
  const round = createRound('time', settings, words, 1000);
  assert.equal(judge(round, 'correct', 2999).correct, 1);
  const late = judge(round, 'correct', 3000);
  assert.equal(late.correct, 0);
  assert.equal(late.endedAt, 3000);
  assert.equal(tick(round, 50000).endedAt, 3000);
});

test('word timer has no countdown limit and exhausted library ends cleanly', () => {
  const round = createRound('word', { ...settings, target: 1 }, [words[0]], 0);
  assert.equal(tick(round, 99999999), round);
  const ended = judge(round, 'skip', 99999999);
  assert.equal(ended.correct, 0);
  assert.match(ended.reason, /题库/);
  assert.equal(ended.endedAt, 99999999);
});

test('prepares requested count plus allowances plus ten, then replenishes unused words', () => {
  const library = Array.from({ length: 30 }, (_, i) => `词条${i}`);
  let round = createRound('word', settings, library, 0);
  assert.equal(round.prepared, 12);
  for (let i = 0; i < 13; i++) round = judge(round, 'skip', i + 1);
  assert.equal(round.endedAt, null);
  assert.equal(round.prepared, 22);
  assert.equal(new Set(round.history.map(entry => entry.word)).size, 13);
});

test('validates impossible targets, empty libraries, non-integers and negative counts', () => {
  assert.match(validateSettings('word', { ...settings, target: 6 }, 5), /超过/);
  assert.ok(validateSettings('word', settings, 0));
  assert.ok(validateSettings('time', { ...settings, seconds: NaN }, 5));
  assert.ok(validateSettings('word', { ...settings, target: 1.5 }, 5));
  assert.ok(validateSettings('time', { ...settings, fouls: -1 }, 5));
  assert.equal(validateSettings('word', settings, 5), '');
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
