import idioms from '../data/idioms.json';
import { levels, type Difficulty } from './game';

// 内置题库按难度分层存放在 data/idioms.json；导入的 TXT 中未标注难度的词也按这里查询，查不到按「中」处理。
const builtinLevels = new Map<string, Difficulty>(levels.flatMap(level => idioms[level].map(word => [word, level] as const)));

export const builtinLibrary = [...builtinLevels.keys()];

export function builtinLevel(word: string) {
  return builtinLevels.get(word);
}
