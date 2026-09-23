export type Mode = 'time' | 'word';
export type Verdict = 'correct' | 'skip' | 'foul';
export type Settings = { target: number; seconds: number; fouls: number; skips: number };
export type Round = {
  mode: Mode; settings: Settings; deck: string[]; cursor: number; prepared: number;
  startedAt: number; endedAt: number | null; reason: string;
  correct: number; skip: number; foul: number;
  history: { word: string; verdict: Verdict }[];
};

export function parseWords(text: string) {
  const all = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.trim().split(/\s+/)[0]).filter(Boolean);
  const valid = all.filter(word => /^\p{Script=Han}{4}$/u.test(word));
  const words = [...new Set(valid)];
  return { words, invalid: all.length - valid.length, duplicates: valid.length - words.length };
}

export function shuffled(words: string[], random = Math.random) {
  const deck = [...words];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function validateSettings(mode: Mode, settings: Settings, count: number) {
  if (!count) return '题库中没有可用的四字成语，请更换 TXT 文件。';
  if (![settings.fouls, settings.skips].every(n => Number.isInteger(n) && n >= 0 && n <= 9999)) return '犯规和跳过次数须为 0–9999 的整数。';
  if (mode === 'word' && (!Number.isInteger(settings.target) || settings.target < 1 || settings.target > 9999)) return '目标词数须为 1–9999 的整数。';
  if (mode === 'word' && settings.target > count) return `目标词数不能超过题库的 ${count} 个成语。`;
  if (mode === 'time' && (!Number.isInteger(settings.seconds) || settings.seconds < 1 || settings.seconds > 86400)) return '时间须为 1–86400 秒的整数。';
  return '';
}

export function createRound(mode: Mode, settings: Settings, words: string[], now: number): Round {
  const error = validateSettings(mode, settings, words.length);
  if (error) throw new Error(error);
  return { mode, settings: { ...settings }, deck: shuffled(words), cursor: 0,
    prepared: mode === 'word' ? Math.min(words.length, settings.target + settings.fouls + settings.skips + 10) : words.length,
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
    history: [...checked.history, { word: checked.deck[checked.cursor], verdict }] };
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
