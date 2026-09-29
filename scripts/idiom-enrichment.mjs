import * as OpenCC from 'opencc-js';

export const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });
export const normalizeWord = word => toSimplified(String(word).normalize('NFC').trim());
export const textValue = value => Array.isArray(value) ? value.filter(Boolean).join('\n') : typeof value === 'string' ? value.trim() : '';
export function usableText(value) {
  const text = textValue(value);
  return /^(?:无|無|暂无|暫無|不详|不詳|none|null|--?|—|未知|无出处|出处不详)[。．.!！]?$/i.test(text) ? '' : text;
}

export function usableOrigin(value) {
  const text = usableText(value);
  const content = text.replace(/^[〖【\[]?(?:出处|出處|典源)[〗】\]]?\s*[:：]?\s*/, '').trim();
  if (!usableText(content) || /^[?？\s]+$/.test(content)) return '';
  // An unfinished book title is a visibly truncated source, not usable evidence.
  if ((content.match(/《/g) ?? []).length !== (content.match(/》/g) ?? []).length) return '';
  return text;
}

// The downloaded .txt is CSV, including quoted commas and multiline cells.
export function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (character === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && character === ',') { row.push(cell); cell = ''; }
    else if (!quoted && character === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += character;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

export function dictionaryRecord(word, explanation, origin, sourceId, sourceUrl = '') {
  return { word, explanation: usableText(explanation), origins: usableOrigin(origin) ? [{ text: textValue(origin), sourceId, sourceWord: word, sourceUrl, kind: 'dictionary' }] : [], sourceId, sourceUrl };
}

export function moeRecord(row) {
  const names = Array.isArray(row['典源文獻名稱']) ? row['典源文獻名稱'] : [row['典源文獻名稱']];
  const contents = textValue(row['典源文獻內容']).split(/\n[＋+]\n/);
  const sourceUrl = `https://dict.idioms.moe.edu.tw/idiomView.jsp?ID=${row['編號']}&webMd=2&la=0`;
  const origins = names.map((name, i) => ({
    text: [name, contents[i]].filter(Boolean).join('\n'), sourceId: 'moe', sourceWord: row['成語'], sourceUrl, kind: 'dictionary',
  })).filter((origin, i) => usableText(names[i]));
  return { word: row['成語'], explanation: textValue(row['釋義']), origins, sourceId: 'moe', sourceUrl };
}

export function buildIndex(records) {
  const index = new Map();
  for (const record of records) {
    const key = normalizeWord(record.word);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(record);
  }
  return index;
}

export function selectEntry(word, records, alias, fallback) {
  const candidates = records.filter(record => usableText(record.explanation));
  const selected = candidates[0];
  const origins = records.find(record => record.origins.length)?.origins ?? [];
  if (selected) {
    return { word, explanation: selected.explanation, explanationSource: selected.sourceId,
      sourceWord: selected.word, sourceUrl: selected.sourceUrl, origins,
      status: 'dictionary', ...(alias ? { relatedWord: alias } : {}) };
  }
  if (fallback) return { word, explanation: fallback.explanation, explanationSource: 'llm', sourceWord: word, sourceUrl: '', origins: [], status: 'generated', ...(alias ? { relatedWord: alias } : {}) };
  return { word, explanation: '', explanationSource: '', sourceWord: word, sourceUrl: '', origins: [], status: 'missing' };
}
