"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";

type Law = {
  code: string;
  title: string;
  group: string;
  notion_url: string;
  bank_record_url?: string;
  official_url?: string;
  priority?: string;
  status?: string;
  action?: string;
  question_target?: number;
  flashcards_meta?: number | string | null;
  content_html?: string;
};

type Snapshot = { laws: Law[] };

function fallbackHtml(law: Law) {
  return `<h2>Recorte operacional</h2><p>A página interna contém o roteiro completo de leitura, questões, flashcards e revisões. O Notion continua disponível como fonte operacional.</p><h2>Flashcards da unidade</h2><ol><li><strong>Frente:</strong> Leia a orientação e confirme a fonte oficial do recorte.<br><strong>Verso:</strong> Use a fonte oficial antes de consolidar o cartão.</li><li><strong>Frente:</strong> Qual é o próximo passo?</li><li><strong>Verso:</strong> ${law.action || "Ler orientação"}; depois registre a execução.</li></ol><h2>✅ D0 — fechamento</h2><p>Leia a fonte oficial, responda a meta, revise os cartões e marque D0 somente após executar.</p>`;
}

export default function LawDetailClient({ code }: { code: string }) {
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

  const law = snapshot?.laws.find((item) => item.code.toLowerCase() === code.toLowerCase());
  const html = law?.content_html || (law ? fallbackHtml(law) : "");
  if (error) {
    return <main className="law-detail-page"><header className="laws-topbar"><a className="laws-back" href="../"><ArrowLeft size={17} /> Voltar para Leis Primeiro</a></header><section className="law-detail-hero"><p className="laws-kicker">SNAPSHOT INDISPONÍVEL</p><h1>Abra esta unidade no Notion.</h1><p>O site não conseguiu carregar o espelho publicado agora.</p></section></main>;
  }
  if (!snapshot || !law) {
    return <main className="law-detail-page"><header className="laws-topbar"><a className="laws-back" href="../"><ArrowLeft size={17} /> Voltar para Leis Primeiro</a></header><section className="law-detail-hero"><p className="laws-kicker">LEIS PRIMEIRO · TJDFT</p><h1>Carregando a unidade…</h1></section></main>;
  }

  return (
    <main className="law-detail-page laws-reading-body">
      <header className="laws-topbar"><a className="laws-back" href="../"><ArrowLeft size={17} /> Leis Primeiro · TJDFT</a><span className="laws-sync"><span className="laws-live-dot" /> Snapshot publicado</span></header>
      <section className="law-detail-hero">
        <p className="laws-kicker">{law.code} · {law.group}</p>
        <h1>{law.title}</h1>
        <p>Leia a orientação, abra a fonte oficial, responda as questões, revise os flashcards e feche D0. D7/D20 seguem em paralelo.</p>
        <div className="law-detail-meta"><span>{law.priority || "Sem prioridade"}</span><span>{law.question_target || 0} questões-meta</span><span>{law.flashcards_meta || 0} flashcards-meta</span><span>{law.status || "Não iniciado"}</span></div>
        <div className="law-detail-actions">
          <a className="primary" href={law.official_url || law.notion_url} target="_blank" rel="noreferrer">Abrir fonte oficial <ExternalLink size={14} /></a>
          <a href={law.notion_url} target="_blank" rel="noreferrer">Abrir página no Notion <ExternalLink size={14} /></a>
          <a href="../flashcards/">Ver flashcards <ExternalLink size={14} /></a>
        </div>
      </section>
      <div className="law-detail-grid">
        <article className="study-html" dangerouslySetInnerHTML={{ __html: html }} />
        <aside className="law-detail-side">
          <h2>Fechamento</h2>
          <p>O site mostra o conteúdo sincronizado. O registro de execução continua no banco canônico do Notion.</p>
          <strong>Fluxo</strong>
          <ul><li>Orientação</li><li>Leitura oficial</li><li>Questões</li><li>Flashcards</li><li>D0</li><li>D7 / D20</li></ul>
          <a href={law.bank_record_url} target="_blank" rel="noreferrer">Abrir registro operacional <ExternalLink size={13} /></a>
          <a href="../">Voltar ao mapa <ArrowLeft size={13} /></a>
        </aside>
      </div>
    </main>
  );
}
