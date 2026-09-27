export type Mode = 'time' | 'word';
export type Verdict = 'correct' | 'skip' | 'foul';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type DifficultyRatios = Record<Difficulty, number>;
export type Settings = { target: number; seconds: number; fouls: number; skips: number; ratios?: DifficultyRatios };
export type Round = {
  mode: Mode; settings: Settings; deck: string[]; cursor: number; prepared: number;
  startedAt: number; endedAt: number | null; reason: string;
  correct: number; skip: number; foul: number;
  history: { word: string; verdict: Verdict }[];
};

const excludedWords = new Set(['盗墓笔记', '长江七号', '财务主管', '清华东门', '同轴电缆', '严重错误', '功夫之王', '玫瑰人生', '家有儿女', '暴露目标', '瞄准射击', '精确瞄准', '双管猎枪']);
const easyWords = new Set(['画龙点睛', '守株待兔', '掩耳盗铃', '狐假虎威', '亡羊补牢', '刻舟求剑', '拔苗助长', '井底之蛙', '自相矛盾', '滥竽充数', '叶公好龙', '对牛弹琴', '一箭双雕', '画蛇添足', '杯弓蛇影', '望梅止渴', '四面楚歌', '卧薪尝胆', '三顾茅庐', '完璧归赵', '负荆请罪', '闻鸡起舞', '精卫填海', '愚公移山', '大惊小怪', '手忙脚乱', '眉开眼笑', '欢天喜地', '一心一意', '五颜六色', '三心二意', '七上八下', '大吃一惊', '自由自在', '心想事成', '马到成功', '一帆风顺', '皆大欢喜']);
const hardWords = new Set(['魑魅魍魉', '佶屈聱牙', '沆瀣一气', '暴殄天物', '鳏寡孤独', '踽踽独行', '茕茕孑立', '治丝益棼', '殷鉴不远', '曲突徙薪', '铩羽而归', '越俎代庖', '胶柱鼓瑟', '不稂不莠', '睚眦必报', '羚羊挂角', '栉风沐雨', '韬光养晦', '凤毛麟角', '明日黄花', '不落窠臼', '差强人意', '不孚众望', '望其项背', '首鼠两端', '方枘圆凿', '不刊之论', '集腋成裘', '曲高和寡', '高屋建瓴', '醍醐灌顶', '南辕北辙', '买椟还珠', '邯郸学步', '沧海遗珠', '雪泥鸿爪', '洛阳纸贵']);

export const defaultRatios: DifficultyRatios = { easy: 40, medium: 40, hard: 20 };

export function cleanWords(words: string[]) {
  return [...new Set(words.filter(word => !excludedWords.has(word)))];
}

export function classifyWord(word: string): Difficulty {
  if (easyWords.has(word)) return 'easy';
  if (hardWords.has(word)) return 'hard';
  return 'medium';
}

function normalizeRatios(ratios?: DifficultyRatios) {
  const result = ratios ?? defaultRatios;
  return result.easy + result.medium + result.hard === 100 ? result : defaultRatios;
}

export function stratified(words: string[], ratios?: DifficultyRatios, random = Math.random) {
  const normalized = normalizeRatios(ratios);
  const cleaned = cleanWords(words);
  const groups = new Map<Difficulty, string[]>([['easy', []], ['medium', []], ['hard', []]]);
  for (const word of cleaned) groups.get(classifyWord(word))!.push(word);
  const count = cleaned.length;
  const desired = { easy: Math.floor(count * normalized.easy / 100), medium: Math.floor(count * normalized.medium / 100), hard: Math.floor(count * normalized.hard / 100) } as Record<Difficulty, number>;
  let remainder = count - desired.easy - desired.medium - desired.hard;
  for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) if (remainder-- > 0) desired[difficulty]++;
  const selected = new Map<Difficulty, string[]>();
  for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) selected.set(difficulty, shuffled(groups.get(difficulty)!, random));
  const slots: Difficulty[] = [];
  for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) for (let i = 0; i < Math.min(desired[difficulty], selected.get(difficulty)!.length); i++) slots.push(difficulty);
  while (slots.length < count) {
    const difficulty = (['easy', 'medium', 'hard'] as Difficulty[]).find(item => selected.get(item)!.length > slots.filter(slot => slot === item).length);
    if (!difficulty) break;
    slots.push(difficulty);
  }
  return shuffled(slots, random).map(difficulty => selected.get(difficulty)!.shift()!);
}

export function parseWords(text: string) {
  const all = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.trim().split(/\s+/)[0]).filter(Boolean);
  const valid = all.filter(word => /^\p{Script=Han}{4}$/u.test(word));
  const unique = [...new Set(valid)];
  const words = cleanWords(unique);
  return { words, invalid: all.length - valid.length, duplicates: valid.length - unique.length };
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
  const ratios = settings.ratios ?? defaultRatios;
  if (![ratios.easy, ratios.medium, ratios.hard].every(n => Number.isInteger(n) && n >= 0 && n <= 100) || ratios.easy + ratios.medium + ratios.hard !== 100) return '难度比例须为 0–100 的整数，且总和为 100%。';
  return '';
}

export function createRound(mode: Mode, settings: Settings, words: string[], now: number): Round {
  const error = validateSettings(mode, settings, words.length);
  if (error) throw new Error(error);
  const ratios = normalizeRatios(settings.ratios);
  return { mode, settings: { ...settings, ratios }, deck: stratified(words, ratios), cursor: 0,
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
