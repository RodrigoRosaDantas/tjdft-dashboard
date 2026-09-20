"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ExternalLink, Filter, RotateCcw, Shuffle } from "lucide-react";
import ReadingSettings from "../../reading-settings";
import { extractFlashcardHtml, extractFlashcardPairs, type FlashcardPair } from "../flashcard-utils";

type Law = { code: string; title: string; notion_url: string; record_kind?: "active" | "support" | "historical"; content_html?: string; flashcards_meta?: number | string | null };
type Snapshot = { laws: Law[] };
type ReviewStage = "D0" | "D7" | "D20";
type ReviewFilter = "all" | "pending" | "reviewed";
type CardProgress = { reviewed: boolean; stage: ReviewStage };
type CardProgressMap = Record<string, CardProgress>;
type IndexedCard = FlashcardPair & { key: string };
type FlashcardEntry = { law: Law; fragment: string; cards: IndexedCard[] };

const CARD_PROGRESS_STORAGE_KEY = "tjdft-dashboard:flashcard-progress:v1";
const DEFAULT_CARD_PROGRESS: CardProgress = { reviewed: false, stage: "D0" };

function cardText(card: FlashcardPair) {
  return `${card.questionHtml} ${card.answerHtml}`
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export default function FlashcardsPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [lawFilter, setLawFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [progress, setProgress] = useState<CardProgressMap>({});
  const [shuffleSeed, setShuffleSeed] = useState(0);

  useEffect(() => {
    fetch(`../../data/leis-primeiro.json?ts=${Date.now()}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("snapshot indisponível");
        return response.json();
      })
      .then((value: Snapshot) => setSnapshot(value))
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(CARD_PROGRESS_STORAGE_KEY);
        if (raw) setProgress(JSON.parse(raw) as CardProgressMap);
      } catch {
        // O progresso local é opcional e não bloqueia a leitura dos cartões.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const entries = useMemo<FlashcardEntry[]>(() => (snapshot?.laws || [])
    .filter((law) => law.record_kind === "active")
    .map((law) => {
      const fragment = extractFlashcardHtml(law.content_html || "");
      const cards = extractFlashcardPairs(fragment).map((card, index) => ({ ...card, key: `${law.code}-${index}` }));
      return { law, fragment, cards };
    }), [snapshot]);

  const visibleEntries = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    return entries.map((entry) => {
      const cards = entry.cards.filter((card) => {
        const state = progress[card.key] ?? DEFAULT_CARD_PROGRESS;
        const matchesReview = reviewFilter === "all" || (reviewFilter === "reviewed" ? state.reviewed : !state.reviewed);
        return matchesReview && (!needle || cardText(card).includes(needle));
      });
      const showRaw = entry.cards.length === 0 && reviewFilter === "all" && !needle;
      return { ...entry, cards, showRaw };
    }).filter((entry) => entry.law.code === lawFilter || lawFilter === "all")
      .filter((entry) => entry.cards.length > 0 || entry.showRaw);
  }, [entries, lawFilter, progress, query, reviewFilter]);

  const totalCards = entries.reduce((total, entry) => total + entry.cards.length, 0);
  const visibleCardCount = visibleEntries.reduce((total, entry) => total + entry.cards.length, 0);
  const reviewedCount = entries.reduce((total, entry) => total + entry.cards.filter((card) => progress[card.key]?.reviewed).length, 0);
  const stageCounts = entries.reduce<Record<ReviewStage, number>>((counts, entry) => {
    entry.cards.forEach((card) => {
      const stage = progress[card.key]?.stage ?? DEFAULT_CARD_PROGRESS.stage;
      counts[stage] += 1;
    });
    return counts;
  }, { D0: 0, D7: 0, D20: 0 });

  const updateCardProgress = (key: string, patch: Partial<CardProgress>) => {
    setProgress((current) => {
      const next = {
        ...current,
        [key]: { ...DEFAULT_CARD_PROGRESS, ...(current[key] || {}), ...patch },
      };
      try {
        window.localStorage.setItem(CARD_PROGRESS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // O cartão continua marcado nesta sessão se o navegador bloquear storage.
      }
      return next;
    });
  };

  const clearProgress = () => {
    if (typeof window === "undefined" || !window.confirm("Limpar as marcações locais dos flashcards?")) return;
    setProgress({});
    try {
      window.localStorage.removeItem(CARD_PROGRESS_STORAGE_KEY);
    } catch {
      // A limpeza visual já foi aplicada nesta sessão.
    }
  };

  return (
    <main className="flashcards-page">
      <header className="laws-topbar"><a className="laws-back" href="../"><ArrowLeft size={17} /> Voltar para Leis Primeiro</a><div className="laws-topbar-tools"><ReadingSettings /><span className="laws-sync"><span className="laws-live-dot" /> TJDFT · flashcards</span></div></header>
      <section className="flashcards-hero">
        <p className="laws-kicker">🧠 RECUPERAÇÃO ATIVA · D0 / D7 / D20</p>
        <h1>Flashcards da trilha TJDFT</h1>
        <p>Use os cartões depois da leitura oficial e das questões. As marcações abaixo são locais e organizam sua sessão; o registro oficial continua no Notion.</p>
      </section>
      {error ? <div className="flashcards-card">O snapshot não carregou. Abra o Notion pelo mapa principal.</div> : null}
      {!snapshot && !error ? <div className="flashcards-card">Carregando cartões…</div> : null}
      {snapshot ? <section className="flashcards-controls" aria-label="Filtros e progresso dos flashcards">
        <div className="flashcards-controls-head"><div><p className="laws-kicker">SESSÃO LOCAL</p><h2>Escolha o que revisar agora</h2></div><strong>{reviewedCount}/{totalCards} revisados</strong></div>
        <div className="flashcards-controls-grid">
          <label><span><Filter size={14} /> Lei</span><select value={lawFilter} onChange={(event) => setLawFilter(event.target.value)} aria-label="Filtrar flashcards por lei"><option value="all">Todas as leis</option>{entries.map(({ law }) => <option value={law.code} key={law.code}>{law.code} · {law.title}</option>)}</select></label>
          <label><span><Check size={14} /> Estado</span><select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as ReviewFilter)} aria-label="Filtrar flashcards por estado"><option value="all">Todos</option><option value="pending">Pendentes</option><option value="reviewed">Revisados</option></select></label>
          <label className="flashcards-search"><span>⌕ Buscar</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no frente e verso" aria-label="Buscar nos flashcards" /></label>
        </div>
        <div className="flashcards-controls-actions"><span>{visibleCardCount} cartões visíveis · D0 {stageCounts.D0} · D7 {stageCounts.D7} · D20 {stageCounts.D20}</span><div><button type="button" onClick={() => setShuffleSeed(Date.now())}><Shuffle size={14} /> Embaralhar</button><button type="button" onClick={clearProgress}><RotateCcw size={14} /> Limpar marcações</button></div></div>
        <p className="flashcards-local-note">Progresso salvo somente neste aparelho; ele não altera metas, D0, D7 ou D20 no Notion.</p>
      </section> : null}
      {snapshot && !visibleEntries.length ? <div className="flashcards-card flashcards-empty">Nenhum cartão corresponde aos filtros atuais.</div> : null}
      <section className="flashcards-grid">
        {visibleEntries.map(({ law, fragment, cards, showRaw }) => (
          <article className="flashcards-card" key={law.code}>
            <div className="flashcards-card-top"><div><small>{law.code}</small><h2>{law.title}</h2></div><small>{law.flashcards_meta || 0} cartões-meta · {cards.length || "conteúdo"} visíveis</small></div>
            <FlashcardContent law={law} fragment={fragment} cards={cards} showRaw={showRaw} progress={progress} shuffleSeed={shuffleSeed} onToggleReview={(key, reviewed) => updateCardProgress(key, { reviewed })} onStageChange={(key, stage) => updateCardProgress(key, { stage })} />
            <div className="flashcards-actions"><a href={`../${law.code.toLowerCase()}/`}>Abrir unidade <ExternalLink size={13} /></a><a href={law.notion_url} target="_blank" rel="noreferrer">Notion <ExternalLink size={13} /></a></div>
          </article>
        ))}
      </section>
    </main>
  );
}

function FlashcardContent({ law, fragment, cards, showRaw, progress, shuffleSeed, onToggleReview, onStageChange }: {
  law: Law;
  fragment: string;
  cards: IndexedCard[];
  showRaw: boolean;
  progress: CardProgressMap;
  shuffleSeed: number;
  onToggleReview: (key: string, reviewed: boolean) => void;
  onStageChange: (key: string, stage: ReviewStage) => void;
}) {
  if (!cards.length) return showRaw ? <div className="flashcards-html" dangerouslySetInnerHTML={{ __html: fragment }} /> : <div className="flashcards-empty">Nenhum cartão nesta seleção.</div>;
  const orderedCards = shuffleSeed
    ? [...cards].sort((left, right) => seededScore(`${shuffleSeed}:${left.key}`) - seededScore(`${shuffleSeed}:${right.key}`))
    : cards;
  return <div className="flashcards-stack">
    <p className="flashcards-instruction">Abra cada cartão para revelar o verso. O conteúdo vem do snapshot sincronizado.</p>
    {orderedCards.map((card, index) => {
      const state = progress[card.key] ?? DEFAULT_CARD_PROGRESS;
      return <details className={`flashcard-item ${state.reviewed ? "is-reviewed" : ""}`} data-review-stage={state.stage} key={card.key}>
        <summary><span className="flashcard-number">{String(index + 1).padStart(2, "0")}</span><span dangerouslySetInnerHTML={{ __html: card.questionHtml }} /><em>{state.reviewed ? "Revisado" : state.stage}</em></summary>
        <div className="flashcard-answer"><strong>Verso</strong><div dangerouslySetInnerHTML={{ __html: card.answerHtml }} /><div className="flashcard-answer-tools"><label>Fase <select value={state.stage} onChange={(event) => onStageChange(card.key, event.target.value as ReviewStage)} aria-label={`Fase de revisão de ${law.code} ${index + 1}`}><option>D0</option><option>D7</option><option>D20</option></select></label><button type="button" onClick={() => onToggleReview(card.key, !state.reviewed)}>{state.reviewed ? <><Check size={13} /> Revisado</> : "Marcar revisão"}</button></div></div>
      </details>;
    })}
  </div>;
}

function seededScore(value: string) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}
