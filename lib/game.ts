export type Mode = 'time' | 'word';
export type Verdict = 'correct' | 'skip' | 'foul';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type DifficultyRatios = Record<Difficulty, number>;
export type Settings = { target: number; seconds: number; fouls: number; skips: number; ratios: DifficultyRatios };
export type Card = { word: string; level: Difficulty };
export type Classifier = (word: string) => Difficulty;
export type Round = {
  mode: Mode; settings: Settings; deck: Card[]; cursor: number; prepared: number;
  startedAt: number; endedAt: number | null; reason: string;
  correct: number; skip: number; foul: number;
  history: (Card & { verdict: Verdict })[];
};

export const levels: Difficulty[] = ['easy', 'medium', 'hard'];
export const defaultRatios: DifficultyRatios = { easy: 40, medium: 40, hard: 20 };
const blockSize = 10;
const levelMarks: Record<string, Difficulty> = { 下: 'easy', 易: 'easy', 简单: 'easy', easy: 'easy', 中: 'medium', 适中: 'medium', medium: 'medium', 上: 'hard', 难: 'hard', 挑战: 'hard', hard: 'hard' };

export function levelCounts(words: string[], classify: Classifier) {
  const counts: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  for (const word of words) counts[classify(word)]++;
  return counts;
}

// 比例为 0 的难度不出题；比例为正但该难度没有词时，其余难度按比例补上。
export function eligibleCount(counts: Record<Difficulty, number>, ratios: DifficultyRatios) {
  return levels.reduce((sum, level) => sum + (ratios[level] > 0 ? counts[level] : 0), 0);
}

// 先按「最大缺口」排出难度序列，使任意前缀都贴近设定比例；再在每 10 题内打乱，避免出题节奏可被猜到。
export function stratified(words: string[], ratios: DifficultyRatios, classify: Classifier, random = Math.random): Card[] {
  const pools: Record<Difficulty, string[]> = { easy: [], medium: [], hard: [] };
  for (const word of new Set(words)) if (ratios[classify(word)] > 0) pools[classify(word)].push(word);
  for (const level of levels) pools[level] = shuffled(pools[level], random);
  const total = levels.reduce((sum, level) => sum + pools[level].length, 0);
  const drawn: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  const sequence: Difficulty[] = [];
  while (sequence.length < total) {
    const open = levels.filter(level => drawn[level] < pools[level].length);
    const weight = open.reduce((sum, level) => sum + ratios[level], 0);
    let best = open[0], bestGap = -Infinity;
    for (const level of open) {
      const gap = ratios[level] / weight * (sequence.length + 1) - drawn[level];
      if (gap > bestGap) { best = level; bestGap = gap; }
    }
    drawn[best]++;
    sequence.push(best);
  }
  const deck: Card[] = [];
  for (let i = 0; i < total; i += blockSize) {
    for (const level of shuffled(sequence.slice(i, i + blockSize), random)) deck.push({ word: pools[level].pop()!, level });
  }
  return deck;
}

export function parseWords(text: string) {
  const all = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.trim().split(/\s+/)).filter(parts => parts[0]);
  const valid = all.filter(parts => /^\p{Script=Han}{4}$/u.test(parts[0]));
  const words = [...new Set(valid.map(parts => parts[0]))];
  // 第二列可写难度（上/中/下、难/中/易、hard/medium/easy），其余内容（如频次）忽略。
  const marked = new Map<string, Difficulty>();
  for (const [word, mark] of valid) if (mark && levelMarks[mark.toLowerCase()] && !marked.has(word)) marked.set(word, levelMarks[mark.toLowerCase()]);
  return { words, marked, invalid: all.length - valid.length, duplicates: valid.length - words.length };
}

export function shuffled<T>(items: T[], random = Math.random) {
  const deck = [...items];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function validateSettings(mode: Mode, settings: Settings, counts: Record<Difficulty, number>) {
  if (!levels.some(level => counts[level])) return '题库中没有可用的四字成语，请更换 TXT 文件。';
  if (![settings.fouls, settings.skips].every(n => Number.isInteger(n) && n >= 0 && n <= 9999)) return '犯规和跳过次数须为 0–9999 的整数。';
  if (mode === 'word' && (!Number.isInteger(settings.target) || settings.target < 1 || settings.target > 9999)) return '目标词数须为 1–9999 的整数。';
  if (mode === 'time' && (!Number.isInteger(settings.seconds) || settings.seconds < 1 || settings.seconds > 86400)) return '时间须为 1–86400 秒的整数。';
  const { ratios } = settings;
  if (!levels.every(level => Number.isInteger(ratios[level]) && ratios[level] >= 0 && ratios[level] <= 100) || levels.reduce((sum, level) => sum + ratios[level], 0) !== 100) return '难度比例须为 0–100 的整数，且合计为 100%。';
  const count = eligibleCount(counts, ratios);
  if (!count) return '所选难度下没有成语，请调整难度比例。';
  if (mode === 'word' && settings.target > count) return `目标词数不能超过所选难度中的 ${count} 个成语。`;
  return '';
}

export function createRound(mode: Mode, settings: Settings, words: string[], now: number, classify: Classifier = () => 'medium', random = Math.random): Round {
  const error = validateSettings(mode, settings, levelCounts(words, classify));
  if (error) throw new Error(error);
  const deck = stratified(words, settings.ratios, classify, random);
  return { mode, settings: { ...settings, ratios: { ...settings.ratios } }, deck, cursor: 0,
    prepared: mode === 'word' ? Math.min(deck.length, settings.target + settings.fouls + settings.skips + 10) : deck.length,
    startedAt: now, endedAt: null, reason: '', correct: 0, skip: 0, foul: 0, history: [] };
}

export function finish(round: Round, now: number, reason: string): Round {
  if (round.endedAt !== null) return round;
  return { ...round, endedAt: now, reason };
}

export function tick(round: Round, now: number): Round {
  const deadline = round.startedAt + round.settings.seconds * 1000;
  return round.mode === 'time' && now >= deadline ? finish(round, deadline, '时间到，挑战完成！') : round;
}

export function judge(round: Round, verdict: Verdict, now: number): Round {
  const checked = tick(round, now);
  if (checked.endedAt !== null) return checked;
  const next = { ...checked, [verdict]: checked[verdict] + 1,
    cursor: checked.cursor + 1,
    history: [...checked.history, { ...checked.deck[checked.cursor], verdict }] };
  if (next.mode === 'word' && next.correct >= next.settings.target) return finish(next, now, '目标达成，一气呵成！');
  if (next.cursor >= next.deck.length) return finish(next, now, '本轮题库已全部出完');
  // 用完准备的词组后，从未出现的剩余词中补充，超出参考次数也能继续。
  if (next.cursor >= next.prepared) next.prepared = Math.min(next.deck.length, next.prepared + 10);
  return next;
}

export function elapsed(round: Round, now: number) {
  return Math.max(0, (round.endedAt ?? now) - round.startedAt);
}

export function formatTime(milliseconds: number, countdown = false) {
  const total = Math.max(0, countdown ? Math.ceil(milliseconds / 1000) : Math.floor(milliseconds / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
