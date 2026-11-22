import type { Classifier } from './game';

export const filterRatios = { easy: 20, medium: 30, hard: 50 } as const;

export function filteredFilename(name: string, date = new Date()) {
  const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(value => String(value).padStart(2, '0')).join('');
  const time = [date.getHours(), date.getMinutes(), date.getSeconds()].map(value => String(value).padStart(2, '0')).join('');
  return `${name.replace(/\.txt$/i, '')}_${day}_${time}.txt`;
}

export function serializeLibrary(words: string[], classify: Classifier) {
  const marks = { easy: '下', medium: '中', hard: '上' };
  return '\uFEFF' + words.map(word => `${word} ${marks[classify(word)]}`).join('\r\n');
}
