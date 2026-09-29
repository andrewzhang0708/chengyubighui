import { dictionaryName, dictionarySources, idiomDetail, originDisplayText } from '../lib/idiom-details';

export function IdiomInfo({ word, compact = false }: { word: string; compact?: boolean }) {
  const entry = idiomDetail(word);
  return <aside className={`idiom-info ${compact ? 'compact' : ''}`} aria-label={`${word}的释义`}>
    <div className="info-heading"><span className="eyebrow">知其意 · 会其心</span><h2>释义</h2></div>
    {entry?.relatedWord && entry.sourceWord !== word && <p className="related-idiom">参照词条：{entry.relatedWord}<span>以下为该词条的释义</span></p>}
    <p className="explanation">{entry?.explanation || '暂未收录释义'}</p>
    {entry?.status === 'generated' && <p className="generated-note">补充释义，待核对</p>}
    {!!entry?.origins.length && <details className="origins" open><summary>出处 / 典故 <span>{entry.origins.length > 1 ? `${entry.origins.length} 项` : ''}</span></summary><div className="origin-list">{entry.origins.map((origin, index) => <div key={index}>
      {origin.referenceWord && <p className="origin-reference">参照「{origin.referenceWord}」的出处</p>}
      {origin.note && <p className="origin-reference">{origin.note}</p>}
      <p>{originDisplayText(origin)}</p>
      <SourceCredit id={origin.sourceId} word={origin.sourceWord} url={origin.sourceUrl}/>
    </div>)}</div></details>}
    {entry?.explanationSource && <details className="entry-source"><summary>释义来源</summary><SourceCredit id={entry.explanationSource} word={entry.sourceWord} url={entry.sourceUrl}/></details>}
  </aside>;
}

function SourceCredit({ id, word, url }: { id: string; word: string; url: string }) {
  return <p className="source-credit">{dictionaryName(id)}{word && ` · ${word}`}{url && <span className="source-address">{url}</span>}</p>;
}

export function DictionaryCredits() {
  return <details className="dictionary-credits"><summary>词典资料来源</summary><div><p>释义与出处分别标注来源。补充释义标有「待核对」；未查到的出处不作补写。</p>{Object.entries(dictionarySources).map(([id, source]) => <p key={id}><strong>{source.name}</strong><span>{source.upstream}</span><span>{source.attribution}</span><span>{source.license}</span><span className="source-address">{source.repositoryUrl}</span></p>)}</div></details>;
}
