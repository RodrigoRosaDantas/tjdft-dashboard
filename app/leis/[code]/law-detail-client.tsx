"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import ReadingSettings from "../../reading-settings";

type Law = {
  code: string;
  title: string;
  group: string;
  record_kind: "active" | "support" | "historical";
  active: boolean;
  notion_url: string;
  bank_record_url?: string;
  official_url?: string;
  priority?: string;
  status?: string;
  action?: string;
  question_target?: number;
  flashcards_meta?: number | string | null;
  content_html?: string;
  alert?: string;
  block?: string;
  observations?: string;
  version?: string;
};

type Snapshot = { laws: Law[] };

function fallbackHtml(law: Law) {
  if (law.record_kind === "historical") {
    return "<h2>Arquivo histórico — não estudar</h2><p>" +
      (law.alert || law.observations || "Esta unidade não compõe a fila ativa.") +
      "</p><p><strong>Não gerar leitura, questões, flashcards ou revisão para esta norma.</strong></p>";
  }
  return "<h2>Apoio do cargo</h2><p>" +
    (law.alert || law.observations || "Use esta unidade para conferência de requisito e atualização.") +
    "</p>";
}

function kindLabel(kind: Law["record_kind"]) {
  if (kind === "support") return "Apoio do cargo";
  if (kind === "historical") return "Arquivo histórico";
  return "Unidade ativa";
}

function addResponsiveTableLabels(html: string) {
  if (typeof document === "undefined" || !html) return html;
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const table of template.content.querySelectorAll("table")) {
    const rows = [...table.querySelectorAll("tr")];
    const headerRow = rows.find((row) => row.querySelector("th"));
    const labels = headerRow
      ? [...headerRow.querySelectorAll("th,td")].map((cell) => cell.textContent?.trim() || "")
      : [];
    headerRow?.setAttribute("data-table-header", "true");
    for (const row of rows) {
      [...row.querySelectorAll(":scope > td, :scope > th")].forEach((cell, index) => {
        cell.setAttribute("data-label", labels[index] || `Coluna ${index + 1}`);
      });
    }
  }
  return template.innerHTML;
}

export default function LawDetailClient({ code }: { code: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("../../data/leis-primeiro.json?ts=" + Date.now(), { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("snapshot indisponível");
        return response.json();
      })
      .then((value: Snapshot) => setSnapshot(value))
      .catch(() => setError(true));
  }, []);

  const law = snapshot?.laws.find((item) => item.code.toLowerCase() === code.toLowerCase());
  const isActive = law?.record_kind === "active";
  const html = useMemo(() => addResponsiveTableLabels(law?.content_html || (law ? fallbackHtml(law) : "")), [law]);

  if (error) {
    return (
      <main className="law-detail-page">
        <header className="laws-topbar"><a className="laws-back" href="../"><ArrowLeft size={17} /> Voltar para Leis Primeiro</a><div className="laws-topbar-tools"><ReadingSettings /></div></header>
        <section className="law-detail-hero"><p className="laws-kicker">SNAPSHOT INDISPONÍVEL</p><h1>Abra esta unidade no Notion.</h1><p>O site não conseguiu carregar o espelho publicado agora.</p></section>
      </main>
    );
  }

  if (!snapshot || !law) {
    return (
      <main className="law-detail-page">
        <header className="laws-topbar"><a className="laws-back" href="../"><ArrowLeft size={17} /> Voltar para Leis Primeiro</a><div className="laws-topbar-tools"><ReadingSettings /></div></header>
        <section className="law-detail-hero"><p className="laws-kicker">LEIS PRIMEIRO · TJDFT</p><h1>Carregando a unidade…</h1></section>
      </main>
    );
  }

  return (
    <main className="law-detail-page laws-reading-body">
      <header className="laws-topbar">
        <a className="laws-back" href="../"><ArrowLeft size={17} /> Leis Primeiro · TJDFT</a>
        <div className="laws-topbar-tools"><ReadingSettings /><span className="laws-sync"><span className="laws-live-dot" /> Snapshot publicado</span></div>
      </header>

      <section className="law-detail-hero">
        <p className="laws-kicker">{law.code} · {law.group} · {kindLabel(law.record_kind)}</p>
        <h1>{law.title}</h1>
        <p>
          {isActive
            ? "Leia a orientação, abra a fonte oficial, responda as questões, revise os flashcards e feche D0. D7/D20 seguem em paralelo."
            : law.record_kind === "support"
              ? "Esta página é apoio de requisito e atualização do cargo. Ela fica fora da fila ativa e não deve ser confundida com uma unidade de estudo."
              : "Esta página preserva rastreabilidade histórica. A norma está fora da fila ativa e não deve receber estudo, questões, flashcards ou revisão."}
        </p>
        <div className="law-detail-meta">
          <span>{law.priority || "Sem prioridade"}</span>
          <span>{law.question_target || 0} questões-meta</span>
          <span>{law.flashcards_meta || 0} flashcards-meta</span>
          <span>{law.status || kindLabel(law.record_kind)}</span>
        </div>
        <div className="law-detail-actions">
          {law.official_url ? <a className="primary" href={law.official_url} target="_blank" rel="noreferrer">{isActive ? "Abrir fonte oficial" : "Abrir fonte de referência"} <ExternalLink size={14} /></a> : null}
          <a href={law.notion_url} target="_blank" rel="noreferrer">Abrir página no Notion <ExternalLink size={14} /></a>
          {isActive ? <a href="../flashcards/">Ver flashcards <ExternalLink size={14} /></a> : null}
        </div>
      </section>

      <div className="law-detail-grid">
        <article className="study-html" dangerouslySetInnerHTML={{ __html: html }} />
        <aside className="law-detail-side">
          <h2>{isActive ? "Fechamento" : "Estado da unidade"}</h2>
          <p>
            {isActive
              ? "O site mostra o conteúdo sincronizado. O registro de execução continua no banco canônico do Notion."
              : law.alert || law.observations || "Unidade fora da fila ativa."}
          </p>
          {isActive ? (
            <>
              <strong>Fluxo</strong>
              <ul><li>Orientação</li><li>Leitura oficial</li><li>Questões</li><li>Flashcards</li><li>D0</li><li>D7 / D20</li></ul>
            </>
          ) : (
            <>
              <strong>Classificação</strong>
              <ul><li>{kindLabel(law.record_kind)}</li><li>{law.action || "Radar / monitorar"}</li><li>{law.block || "Sem fila de estudo"}</li></ul>
            </>
          )}
          {law.bank_record_url ? <a href={law.bank_record_url} target="_blank" rel="noreferrer">Abrir registro operacional <ExternalLink size={13} /></a> : null}
          <a href="../"><ArrowLeft size={13} /> Voltar ao mapa</a>
        </aside>
      </div>
    </main>
  );
}
