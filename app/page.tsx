"use client";

import { useEffect, useRef, useState } from 'react';
import defaultWords from '../data/default.json';
import { createRound, elapsed, finish, formatTime, judge, parseWords, tick, validateSettings, type Mode, type Round, type Settings, type Verdict } from '../lib/game';

const initialSettings: Settings = { target: 10, seconds: 120, fouls: 3, skips: 3 };
const labels = { correct: '答对', skip: '跳过', foul: '犯规' };

export default function Home() {
  const [screen, setScreen] = useState<'home' | 'setup' | 'game'>('home');
  const [mode, setMode] = useState<Mode>('time');
  const [settings, setSettings] = useState(initialSettings);
  const [words, setWords] = useState(defaultWords);
  const [library, setLibrary] = useState('default.txt');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [round, setRound] = useState<Round | null>(null);
  const [now, setNow] = useState(0);
  const [exitOpen, setExitOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const uploadId = useRef(0);
  const endButton = useRef<HTMLButtonElement>(null);
  const running = screen === 'game' && round !== null && round.endedAt === null;
  const title = mode === 'time' ? '限时模式' : '限词模式';

  useEffect(() => {
    if (!running) return;
    const update = () => {
      const time = performance.now();
      setNow(time);
      setRound(current => current ? tick(current, time) : current);
    };
    const timer = window.setInterval(update, 100);
    const onVisibility = () => { if (!document.hidden) update(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [running]);

  useEffect(() => {
    const update = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  function answer(verdict: Verdict) {
    const time = performance.now();
    setNow(time);
    setRound(current => current ? judge(current, verdict, time) : current);
  }

  useEffect(() => {
    if (!running || exitOpen) return;
    const handle = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))) return;
      const verdict = ({ ArrowLeft: 'foul', ArrowDown: 'skip', ArrowRight: 'correct' } as Record<string, Verdict>)[event.key];
      if (verdict) { event.preventDefault(); answer(verdict); }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [running, exitOpen]);

  function selectMode(value: Mode) {
    setMode(value); setScreen('setup'); setError('');
  }

  function exitToSetup() {
    setRound(null);
    setNow(0);
    setExitOpen(false);
    setError('');
    setScreen('setup');
  }

  function start() {
    const message = validateSettings(mode, settings, words.length);
    if (message) { setError(message); return; }
    const time = performance.now();
    setRound(createRound(mode, settings, words, time));
    setNow(time); setScreen('game'); setError(''); setExitOpen(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  async function upload(file?: File) {
    if (!file) return;
    const request = ++uploadId.current;
    if (!/\.txt$/i.test(file.name)) { setError('请选择 .txt 格式的题库。'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('题库文件不能超过 5 MB。'); return; }
    setReading(true); setError('');
    try {
      const buffer = await file.arrayBuffer();
      let text: string;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
      catch { text = new TextDecoder('gb18030').decode(buffer); }
      const result = parseWords(text);
      if (request !== uploadId.current) return;
      if (!result.words.length) throw new Error('没有找到四字成语，请检查文件内容。原题库仍可使用。');
      setWords(result.words); setLibrary(file.name);
      setNotice(`已导入 ${result.words.length} 个成语，忽略 ${result.invalid} 行非四字词，合并 ${result.duplicates} 个重复词。`);
    } catch (cause) {
      if (request === uploadId.current) setError(cause instanceof Error ? cause.message : '读取题库失败，请重试。');
    } finally { if (request === uploadId.current) setReading(false); }
  }

  function resetLibrary() {
    uploadId.current++; setReading(false); setWords(defaultWords); setLibrary('default.txt'); setNotice('已恢复默认题库。'); setError('');
  }

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { setError('当前浏览器不支持全屏，可使用浏览器的全屏功能。'); }
  }

  const duration = round ? elapsed(round, now) : 0;
  const timeLeft = round ? Math.max(0, round.settings.seconds * 1000 - duration) : 0;
  const result = round && round.endedAt !== null;

  return <main className={`shell ${screen === 'game' ? 'playing' : ''}`}>
    <header>
      <button className="brand bare" onClick={() => running ? setExitOpen(true) : setScreen('home')}>成语大会<span>朋友之间的默契挑战</span></button>
      <div className="header-actions">{screen !== 'home' && <button className="text-button" onClick={fullscreen}>{isFullscreen ? '退出全屏' : '全屏显示'}</button>}<span className="edition">一起玩 · 尽兴猜</span></div>
    </header>

    {screen === 'home' && <>
      <section className="hero"><p className="eyebrow">以词会友，以意相通</p><h1>四个字，<br/>有你们的<span>默契。</span></h1><p>你来比划，我来猜。选一种玩法，开启今天的成语大会。</p></section>
      <div className="modes">
        <button className="mode" onClick={() => selectMode('time')}><span className="number">01 / 限时挑战</span><h2>争分夺秒 <span>↗</span></h2><p>时间有限，默契无限。倒计时内，猜对越多越好。</p><b>进入限时模式 →</b></button>
        <button className="mode green" onClick={() => selectMode('word')}><span className="number">02 / 限词挑战</span><h2>一气呵成 <span>↗</span></h2><p>锁定目标，挑战速度。看看你们能多快猜完。</p><b>进入限词模式 →</b></button>
      </div>
      <div className="home-note"><span className="dot"/> 内置 {defaultWords.length.toLocaleString()} 个四字成语 <span>支持导入自己的 TXT 题库</span></div>
    </>}

    {screen === 'setup' && <>
      <button className="back text-button" onClick={() => setScreen('home')}>← 选择玩法</button>
      <section className="section-heading"><p className="eyebrow">{mode === 'time' ? '01 / 争分夺秒' : '02 / 一气呵成'}</p><h1>{title}</h1><p>{mode === 'time' ? '在限定时间内，尽可能多地猜对成语。' : '猜对指定数量的成语，挑战你们的最快用时。'}</p></section>
      <form onSubmit={event => { event.preventDefault(); start(); }}>
        <div className="setup-grid">
          <section className="panel"><h2><span>一</span> 本轮规则</h2>
            <label className="field"><span>{mode === 'time' ? '挑战时间' : '目标词数'}</span><div><input aria-label={mode === 'time' ? '挑战时间' : '目标词数'} type="number" required min="1" max={mode === 'time' ? 86400 : 9999} step="1" value={Number.isNaN(settings[mode === 'time' ? 'seconds' : 'target']) ? '' : settings[mode === 'time' ? 'seconds' : 'target']} onChange={event => setSettings({ ...settings, [mode === 'time' ? 'seconds' : 'target']: event.target.valueAsNumber })}/><span>{mode === 'time' ? '秒' : '个'}</span></div></label>
            {(['fouls', 'skips'] as const).map((key) => <label className="field" key={key}><span>{key === 'fouls' ? '犯规参考次数' : '跳过参考次数'}</span><div><input aria-label={key === 'fouls' ? '犯规参考次数' : '跳过参考次数'} type="number" required min="0" max="9999" step="1" value={Number.isNaN(settings[key]) ? '' : settings[key]} onChange={event => setSettings({ ...settings, [key]: event.target.valueAsNumber })}/><span>次</span></div></label>)}
            <p className="hint">犯规与跳过仅计次，达到参考次数也可以继续。</p>
          </section>
          <section className="panel library"><h2><span>二</span> 挑选题库</h2><div className="file-icon">词</div><strong>{library}</strong><p>{words.length.toLocaleString()} 个成语 · 随机出题 · 本轮不重复</p><label className={`upload-button ${reading ? 'disabled' : ''}`}>{reading ? '正在读取…' : '↑ 导入 TXT 题库'}<input type="file" accept=".txt,text/plain" disabled={reading} onChange={event => { upload(event.target.files?.[0]); event.target.value = ''; }}/></label><button className="text-button" type="button" onClick={resetLibrary}>恢复默认题库</button><p className="hint">每行一个成语，也兼容「成语 + 空格 + 数字」。<br/>文件仅在当前浏览器读取，不上传。</p></section>
        </div>
        {notice && <p className="notice" role="status">{notice}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="start-row"><p>让猜词的人背对屏幕，准备好就开始。</p><button type="submit" className="primary" disabled={reading}>开始挑战 <span>→</span></button></div>
      </form>
    </>}

    {screen === 'game' && round && !result && <>
      <div className="game-heading"><span className="eyebrow">{title} / 挑战进行中</span><div className="game-actions"><button className="exit-button" onClick={exitToSetup}>← 退出本轮</button><button ref={endButton} className="text-button" onClick={() => setExitOpen(true)}>结束并结算</button></div></div>
      <div className="scoreboard"><div className={round.mode === 'time' && timeLeft <= 10000 ? 'danger' : ''}><span>{round.mode === 'time' ? '剩余时间' : '已用时间'}</span><strong>{formatTime(round.mode === 'time' ? timeLeft : duration, round.mode === 'time')}</strong></div><div className="score"><span>已答对</span><strong>{round.correct}{round.mode === 'word' && <small> / {round.settings.target}</small>}</strong></div></div>
      <section className="word-stage" aria-label="当前成语"><p className="word-number">第 {String(round.cursor + 1).padStart(2, '0')} 题</p><h1 key={round.cursor}>{round.deck[round.cursor]}</h1><p>心领神会，就在此刻</p></section>
      <div className="verdicts">{(['foul', 'skip', 'correct'] as const).map((verdict, index) => <div key={verdict}><button className={`verdict ${verdict}`} onClick={event => { answer(verdict); event.currentTarget.blur(); }}><span className="symbol">{['×', '»', '✓'][index]}</span>{labels[verdict]}<kbd>{['←', '↓', '→'][index]}</kbd></button>{verdict !== 'correct' ? <p className={round[verdict] > round.settings[verdict === 'foul' ? 'fouls' : 'skips'] ? 'danger' : ''}>{round[verdict]} / {round.settings[verdict === 'foul' ? 'fouls' : 'skips']} 次{round[verdict] >= round.settings[verdict === 'foul' ? 'fouls' : 'skips'] && ' · 可继续'}</p> : <p>答对计 1 分</p>}</div>)}</div>
      <p className="keyboard-note">支持键盘 ← 犯规 · ↓ 跳过 · → 答对</p>
      {error && <p className="error" role="alert">{error}</p>}
    </>}

    {screen === 'game' && round && result && <section className="results">
      <p className="eyebrow">{title} / 本轮回顾</p><h1>{round.reason}</h1><p>每一次心领神会，都值得再来一局。</p>
      <div className="result-stats"><div><strong>{round.correct}</strong><span>答对成语{round.mode === 'word' ? ` / 目标 ${round.settings.target}` : ''}</span></div><div><strong>{formatTime(duration)}</strong><span>本轮用时</span></div><div><strong>{round.foul} <small>/</small> {round.skip}</strong><span>犯规 / 跳过</span></div></div>
      <div className="result-actions"><button className="primary" onClick={start}>再来一局 ↗</button><button className="secondary" onClick={() => { setScreen('setup'); setError(''); }}>调整设置</button><button className="text-button" onClick={() => setScreen('home')}>返回首页</button></div>
      <section className="review"><h2>本轮成语 <span>{round.history.length} 题已判定</span></h2>{round.history.length ? <div className="review-list">{round.history.map((entry, index) => <div key={index}><span className="review-index">{String(index + 1).padStart(2, '0')}</span><strong>{entry.word}</strong><span className={`tag ${entry.verdict}`}>{labels[entry.verdict]}</span></div>)}</div> : <p className="hint">本轮还没有判定成语。</p>}{round.cursor < round.deck.length && (round.mode !== 'word' || round.correct < round.settings.target) && <p className="hint">未判定：{round.deck[round.cursor]}（不计入成绩）</p>}</section>
    </section>}

    <footer>一人描述 · 一人猜词 · 一人判定 <span>让成语成为相聚的理由</span></footer>
    {exitOpen && running && <div className="modal-backdrop" onKeyDown={event => { if (event.key === 'Escape') { setExitOpen(false); endButton.current?.focus(); } if (event.key === 'Tab') { const elements = event.currentTarget.querySelectorAll<HTMLButtonElement>('button'); const first = elements[0], last = elements[elements.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="exit-title"><h2 id="exit-title">结束这一轮？</h2><p>将保留本轮成绩并进入结算。确认期间计时继续。</p><div><button autoFocus className="secondary" onClick={() => { setExitOpen(false); endButton.current?.focus(); }}>继续挑战</button><button className="primary" onClick={() => { const time = performance.now(); setRound(current => current ? finish(tick(current, time), time, '本轮挑战已结束') : current); setNow(time); setExitOpen(false); }}>结束并结算</button></div></section></div>}
  </main>;
}
