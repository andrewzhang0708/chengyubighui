"use client";

import { useEffect, useRef, useState } from 'react';
import { stratified, type Classifier } from '../lib/game';
import { filterRatios } from '../lib/library-filter';
import { IdiomInfo } from './idiom-info';

export function LibraryFilter({ words, name, classify, onRemove, onExit }: {
  words: string[]; name: string; classify: Classifier;
  onRemove: (word: string) => void; onExit: () => void;
}) {
  // Rejected words leave the active library without changing the review order.
  const [queue] = useState(() => stratified(words, filterRatios, classify).map(card => card.word));
  const [cursor, setCursor] = useState(0);
  const position = useRef(0);
  const [showMeaning, setShowMeaning] = useState(true);
  const word = queue[cursor];

  function choose(keep: boolean) {
    const current = queue[position.current];
    if (!current) return;
    if (!keep) onRemove(current);
    position.current += 1;
    setCursor(position.current);
  }

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'SUMMARY', 'A'].includes(event.target.tagName))) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        choose(event.key === 'ArrowRight');
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  });

  return <>
    <div className="game-heading"><span className="eyebrow">筛选题库</span><button className="exit-button" onClick={onExit}>退出并保存题库</button></div>
    <p className="filter-library-name">{name}</p>
    <p className="hint">简单 20% · 中等 30% · 困难 50%，随机出题；某档用完后由其他档补足。</p>
    {word ? <>
      <div className="meaning-toolbar"><span>逐词挑选，随时保存退出</span><button type="button" className="text-button" aria-pressed={showMeaning} onClick={() => setShowMeaning(value => !value)}>{showMeaning ? '隐藏释义' : '显示释义'}</button></div>
      <div className={`word-layout ${showMeaning ? 'with-meaning' : ''}`}>
        <section className="word-stage" aria-label="当前筛选词语"><p className="word-number">这个词，要留下吗？ <i className={`level ${classify(word)}`}>{{ easy: '下 · 简单', medium: '中 · 适中', hard: '上 · 挑战' }[classify(word)]}</i></p><h1 key={word}>{[...word].map((char, index) => <span key={index} style={{ animationDelay: `${index * 50}ms` }}>{char}</span>)}</h1><p>不保留的词会从当前题库移除</p></section>
        {showMeaning && <IdiomInfo key={word} word={word}/>}
      </div>
      <div className="verdicts filter-verdicts"><button className="verdict foul" onClick={event => { choose(false); event.currentTarget.blur(); }}><span className="symbol">×</span>不保留<kbd>←</kbd></button><button className="verdict correct" onClick={event => { choose(true); event.currentTarget.blur(); }}><span className="symbol">✓</span>保留<kbd>→</kbd></button></div>
      <p className="keyboard-note">← 不保留 · → 保留</p>
    </> : <section className="filter-complete"><h1>题库已筛选完</h1><p>点击退出并保存，下载筛选后的题库。</p><button className="primary" onClick={onExit}>退出并保存题库</button></section>}
    <p className="hint filter-save-note">退出时保存为原文件名加时间戳的 TXT，未筛选的词也会保留。</p>
  </>;
}
