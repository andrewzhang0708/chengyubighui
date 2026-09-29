import annotated from '../data/idioms copy.json';
import sourceData from '../data/idiom-sources.json';

export type Origin = { text: string; sourceId: string; sourceWord: string; sourceUrl: string; kind: string; referenceWord?: string; note?: string };
export type IdiomDetail = {
  word: string; explanation: string; explanationSource: string; sourceWord: string; sourceUrl: string;
  origins: Origin[]; status: string; relatedWord?: string;
};
export type DictionarySource = { name: string; repositoryUrl: string; license: string; upstream: string; attribution?: string };

export const dictionarySources: Record<string, DictionarySource> = sourceData;
const details = new Map<string, IdiomDetail>(Object.values(annotated).flat().map(entry => [entry.word, entry as IdiomDetail]));
export function idiomDetail(word: string) { return details.get(word); }
export function dictionaryName(id: string) { return dictionarySources[id]?.name ?? (id === 'llm' ? 'LLM 补充释义，待核对' : '词典资料'); }

// MOE's source fragments carry footnote markers, retained in the JSON for provenance.
export function originDisplayText(origin: Origin) {
  return origin.sourceId === 'moe' ? origin.text.replace(/\*\d+\*/g, '').replace(/^#/gm, '').replace(/\n/g, '') : origin.text;
}
