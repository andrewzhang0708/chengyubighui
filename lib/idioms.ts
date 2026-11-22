import idioms from '../data/idioms.json';
import commonIdioms from '../data/idioms-common.json';
import { levels, type Difficulty } from './game';

// 默认使用常用竞猜版；完整词库保留，用于导入 TXT 时查询难度。
const builtinLevels = new Map<string, Difficulty>(levels.flatMap(level => idioms[level].map(word => [word, level] as const)));

export const builtinLibrary = levels.flatMap(level => commonIdioms[level]);
export const builtinLibraryName = '常用竞猜题库';

export function builtinLevel(word: string) {
  return builtinLevels.get(word);
}
