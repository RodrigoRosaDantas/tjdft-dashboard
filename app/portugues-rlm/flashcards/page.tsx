"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ExternalLink, Filter, RotateCcw, Shuffle } from "lucide-react";
import ReadingSettings from "../../reading-settings";
import { extractFlashcardHtml, extractFlashcardPairs, type FlashcardPair } from "../../leis/flashcard-utils";

type Unit = { code: string; title: string; track: string; notion_url: string; content_html?: string };
type Snapshot = { units: Unit[] };
type ReviewFilter = "all" | "pending" | "reviewed";
type CardProgress = { reviewed: boolean };
type ProgressMap = Record<string, CardProgress>;
type Card = FlashcardPair & { key: string };
type Entry = { unit: Unit; fragment: string; cards: Card[] };

const STORAGE_KEY = "tjdft-dashboard:portugues-rlm-flashcards:v1";

function cardText(card: FlashcardPair) {
  return `${card.questionHtml} ${card.answerHtml}`.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

export default function PortuguesRlmFlashcardsPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState("Todos");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [progress, setProgress] = useState<ProgressMap>({});
  const [shuffleSeed, setShuffleSeed] = useState(0);

  useEffect(() => {
    fetch(`../../data/portugues-rlm.json?ts=${Date.now()}`, { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("snapshot indisponível"); return response.json(); })
      .then((value: Snapshot) => setSnapshot(value))
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) setProgress(JSON.parse(raw) as ProgressMap);
      } catch { /* progresso local é opcional */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const entries = useMemo<Entry[]>(() => (snapshot?.units || []).map((unit) => {
    const fragment = extractFlashcardHtml(unit.content_html || "");
    const cards = extractFlashcardPairs(fragment).map((card, index) => ({ ...card, key: `${unit.code}-${index}` }));
    return { unit, fragment, cards };
  }), [snapshot]);
  const visible = useMemo(() => entries.map((entry) => {
    const matchesTrack = track === "Todos" || entry.unit.track === track;
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    const cards = entry.cards.filter((card) => {
      const reviewed = Boolean(progress[card.key]?.reviewed);
      const reviewMatch = reviewFilter === "all" || (reviewFilter === "reviewed" ? reviewed : !reviewed);
      return reviewMatch && (!needle || cardText(card).includes(needle));
    });
    return { ...entry, cards, showRaw: matchesTrack && entry.cards.length === 0 && reviewFilter === "all" && !needle };
  }).filter((entry) => (track === "Todos" || entry.unit.track === track) && (entry.cards.length > 0 || entry.showRaw)), [entries, progress, query, reviewFilter, track]);
  const totalCards = entries.reduce((sum, entry) => sum + entry.cards.length, 0);
  const reviewedCount = entries.reduce((sum, entry) => sum + entry.cards.filter((card) => progress[card.key]?.reviewed).length, 0);

  function updateProgress(key: string, reviewed: boolean) {
    setProgress((current) => {
      const next = { ...current, [key]: { reviewed } };
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* sessão continua utilizável */ }
      return next;
    });
  }

  function clearProgress() {
    if (!window.confirm("Limpar as marcações locais dos flashcards?")) return;
    setProgress({});
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* limpeza visual aplicada */ }
  }

  return (
    <main className="portugues-flashcards-page">
      <header className="laws-topbar"><a className="laws-back" href="../"><ArrowLeft size={17} /> Voltar para Português + RLM</a><div className="laws-topbar-tools"><ReadingSettings /><span className="laws-sync"><span className="laws-live-dot" /> Flashcards locais</span></div></header>
      <section className="flashcards-hero"><p className="laws-kicker">🧠 RECUPERAÇÃO ATIVA</p><h1>Flashcards de Português + RLM</h1><p>Os cartões são extraídos das páginas sincronizadas. As marcações ficam apenas neste aparelho e não alteram o Notion.</p></section>
      {error ? <div className="flashcards-card">O snapshot não carregou. Abra a central no Notion pelo mapa principal.</div> : null}
      {!snapshot && !error ? <div className="flashcards-card">Carregando cartões…</div> : null}
      {snapshot ? <section className="flashcards-controls"><div className="flashcards-controls-head"><div><p className="laws-kicker">SESSÃO LOCAL</p><h2>Escolha o que revisar agora</h2></div><strong>{reviewedCount}/{totalCards} revisados</strong></div><div className="flashcards-controls-grid"><label><span><Filter size={14} /> Frente</span><select value={track} onChange={(event) => setTrack(event.target.value)}><option>Todos</option><option>Português Primeiro</option><option>RLM Preventivo</option><option>Revisão integrada</option></select></label><label><span><Check size={14} /> Estado</span><select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as ReviewFilter)}><option value="all">Todos</option><option value="pending">Pendentes</option><option value="reviewed">Revisados</option></select></label><label className="flashcards-search"><span>⌕ Buscar</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no frente e verso" /></label></div><div className="flashcards-controls-actions"><span>{visible.reduce((sum, entry) => sum + entry.cards.length, 0)} cartões visíveis</span><div><button type="button" onClick={() => setShuffleSeed(Date.now())}><Shuffle size={14} /> Embaralhar</button><button type="button" onClick={clearProgress}><RotateCcw size={14} /> Limpar marcações</button></div></div><p className="flashcards-local-note">Progresso salvo somente neste aparelho; ele não altera Status, D0, D7 ou D20 no Notion.</p></section> : null}
      {snapshot && !visible.length ? <div className="flashcards-card flashcards-empty">Nenhum cartão corresponde aos filtros atuais. A sincronização poderá adicionar cartões assim que a página tiver a seção “Flashcards”.</div> : null}
      <section className="flashcards-grid">{visible.map(({ unit, fragment, cards, showRaw }) => <article className="flashcards-card" key={unit.code}><div className="flashcards-card-top"><div><small>{unit.code}</small><h2>{unit.title}</h2></div><small>{cards.length || "conteúdo"} visíveis</small></div><FlashcardContent fragment={fragment} cards={cards} showRaw={showRaw} progress={progress} shuffleSeed={shuffleSeed} onToggle={updateProgress} /><div className="flashcards-actions"><a href={`../${unit.code.toLowerCase()}/`}>Abrir unidade <ExternalLink size={13} /></a><a href={unit.notion_url} target="_blank" rel="noreferrer">Notion <ExternalLink size={13} /></a></div></article>)}</section>
    </main>
  );
}

function FlashcardContent({ fragment, cards, showRaw, progress, shuffleSeed, onToggle }: { fragment: string; cards: Card[]; showRaw: boolean; progress: ProgressMap; shuffleSeed: number; onToggle: (key: string, reviewed: boolean) => void }) {
  if (!cards.length) return showRaw ? <div className="flashcards-html" dangerouslySetInnerHTML={{ __html: fragment }} /> : <div className="flashcards-empty">Nenhum cartão nesta seleção.</div>;
  const ordered = shuffleSeed ? [...cards].sort((left, right) => score(`${shuffleSeed}:${left.key}`) - score(`${shuffleSeed}:${right.key}`)) : cards;
  return <div className="flashcards-stack"><p className="flashcards-instruction">Abra cada cartão para revelar o verso.</p>{ordered.map((card, index) => { const reviewed = Boolean(progress[card.key]?.reviewed); return <details className={`flashcard-item ${reviewed ? "is-reviewed" : ""}`} key={card.key}><summary><span className="flashcard-number">{String(index + 1).padStart(2, "0")}</span><span dangerouslySetInnerHTML={{ __html: card.questionHtml }} /><em>{reviewed ? "Revisado" : "Pendente"}</em></summary><div className="flashcard-answer"><strong>Verso</strong><div dangerouslySetInnerHTML={{ __html: card.answerHtml }} /><div className="flashcard-answer-tools"><button type="button" onClick={() => onToggle(card.key, !reviewed)}>{reviewed ? <><Check size={13} /> Desmarcar</> : "Marcar revisão"}</button></div></div></details>; })}</div>;
}

function score(value: string) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}
