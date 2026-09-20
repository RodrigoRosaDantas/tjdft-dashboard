"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import ReadingSettings from "../../reading-settings";
import { extractFlashcardHtml, extractFlashcardPairs } from "../flashcard-utils";

type Law = { code: string; title: string; notion_url: string; record_kind?: "active" | "support" | "historical"; content_html?: string; flashcards_meta?: number | string | null };
type Snapshot = { laws: Law[] };

export default function FlashcardsPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`../../data/leis-primeiro.json?ts=${Date.now()}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("snapshot indisponível");
        return response.json();
      })
      .then((value: Snapshot) => setSnapshot(value))
      .catch(() => setError(true));
  }, []);

  return (
    <main className="flashcards-page">
      <header className="laws-topbar"><a className="laws-back" href="../"><ArrowLeft size={17} /> Voltar para Leis Primeiro</a><div className="laws-topbar-tools"><ReadingSettings /><span className="laws-sync"><span className="laws-live-dot" /> TJDFT · flashcards</span></div></header>
      <section className="flashcards-hero">
        <p className="laws-kicker">🧠 RECUPERAÇÃO ATIVA · D0 / D7 / D20</p>
        <h1>Flashcards da trilha TJDFT</h1>
        <p>Use os cartões depois da leitura oficial e das questões. A revisão não fabrica progresso: marque D0, D7 e D20 apenas no registro operacional.</p>
      </section>
      {error ? <div className="flashcards-card">O snapshot não carregou. Abra o Notion pelo mapa principal.</div> : null}
      {!snapshot && !error ? <div className="flashcards-card">Carregando cartões…</div> : null}
      <section className="flashcards-grid">
        {snapshot?.laws.filter((law) => law.record_kind === "active").map((law) => (
          <article className="flashcards-card" key={law.code}>
            <div className="flashcards-card-top"><div><small>{law.code}</small><h2>{law.title}</h2></div><small>{law.flashcards_meta || 0} cartões-meta</small></div>
            <FlashcardContent law={law} />
            <div className="flashcards-actions"><a href={`../${law.code.toLowerCase()}/`}>Abrir unidade <ExternalLink size={13} /></a><a href={law.notion_url} target="_blank" rel="noreferrer">Notion <ExternalLink size={13} /></a></div>
          </article>
        ))}
      </section>
    </main>
  );
}

function FlashcardContent({ law }: { law: Law }) {
  const fragment = extractFlashcardHtml(law.content_html || "");
  const cards = extractFlashcardPairs(fragment);
  if (!cards.length) return <div className="flashcards-html" dangerouslySetInnerHTML={{ __html: fragment }} />;
  return <div className="flashcards-stack">
    <p className="flashcards-instruction">Abra cada cartão para revelar o verso. O conteúdo vem do snapshot sincronizado.</p>
    {cards.map((card, index) => <details className="flashcard-item" key={`${law.code}-${index}`}>
      <summary><span className="flashcard-number">{String(index + 1).padStart(2, "0")}</span><span dangerouslySetInnerHTML={{ __html: card.questionHtml }} /></summary>
      <div className="flashcard-answer"><strong>Verso</strong><div dangerouslySetInnerHTML={{ __html: card.answerHtml }} /></div>
    </details>)}
  </div>;
}
