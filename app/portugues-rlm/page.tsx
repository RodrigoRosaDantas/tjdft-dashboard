"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CheckCircle2, ExternalLink, Filter, Search, Sparkles } from "lucide-react";
import ReadingSettings from "../reading-settings";

type Unit = {
  code: string;
  title: string;
  track: "Português Primeiro" | "RLM Preventivo" | "Revisão integrada";
  layer: string;
  block: string;
  canonical_order: number;
  priority?: string;
  meta_initial?: number;
  material_ready: boolean;
  notion_url: string;
  internal_path: string;
  content_html?: string;
};

type Snapshot = {
  source: { page_url: string; synced_at: string | null };
  summary: { units: number; content_units: number; review_units: number; material_ready: number };
  sequence: string[];
  advance_rule: string;
  study_sequence: string[];
  audit_notes: string[];
  units: Unit[];
};

const tracks = ["Todos", "Português Primeiro", "RLM Preventivo", "Revisão integrada"];
const blocks = ["Todos", "B1", "B2", "B3", "B4", "B5", "B6", "Fechamento"];

function formatDate(value: string | null | undefined) {
  if (!value) return "aguardando sincronização";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "aguardando sincronização";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(date);
}

function trackShort(track: Unit["track"]) {
  if (track === "Português Primeiro") return "Português";
  if (track === "RLM Preventivo") return "RLM";
  return "Revisão";
}

function isStudyUnit(unit: Unit) {
  return unit.track !== "Revisão integrada";
}

export default function PortuguesRlmPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState("Todos");
  const [block, setBlock] = useState("Todos");

  useEffect(() => {
    let cancelled = false;
    fetch(`../data/portugues-rlm.json?ts=${Date.now()}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("snapshot indisponível");
        return response.json();
      })
      .then((value: Snapshot) => {
        if (!cancelled) setSnapshot(value);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => { cancelled = true; };
  }, []);

  const units = useMemo(() => [...(snapshot?.units || [])].sort((left, right) => left.canonical_order - right.canonical_order), [snapshot]);
  const nextUnit = units.find((unit) => unit.material_ready) || units[0] || null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    return units.filter((unit) => {
      if (track !== "Todos" && unit.track !== track) return false;
      if (block !== "Todos" && unit.block !== block) return false;
      if (!needle) return true;
      return `${unit.code} ${unit.title} ${unit.track} ${unit.layer} ${unit.block}`.toLocaleLowerCase("pt-BR").includes(needle);
    });
  }, [block, query, track, units]);
  const readyCount = units.filter((unit) => unit.material_ready).length;
  const studyCount = units.filter(isStudyUnit).length;
  const reviewCount = units.filter((unit) => unit.track === "Revisão integrada").length;
  const flowPreview = units.slice(0, 5);

  return (
    <main className="laws-page portugues-page">
      <header className="laws-topbar">
        <a className="laws-back" href="../"><ArrowLeft size={17} /> Dashboard TJDFT</a>
        <div className="laws-topbar-tools"><ReadingSettings /><div className="laws-sync"><span className="laws-live-dot" /> Notion → GitHub · {formatDate(snapshot?.source.synced_at)}</div></div>
      </header>

      <section className="laws-hero">
        <div className="laws-hero-copy">
          <p className="laws-kicker">🧠 TRILHA DE ESTUDO · TJDFT</p>
          <h1>Português Primeiro + RLM Preventivo<span className="laws-hero-dot">.</span></h1>
          <p className="laws-lead">Estude pela página, resolva as questões, transforme os erros em revisão e avance pela sequência oficial. O banco organiza; o material ensina.</p>
          <div className="laws-hero-thesis"><span>TEORIA</span><i>→</i><span>QUESTÕES</span><i>→</i><span>ERROS</span><i>→</i><span>REVISÃO</span></div>
          <div className="laws-hero-meta"><span className="laws-live-dot" /><span>Fonte editorial: Notion</span><span className="laws-meta-separator">·</span><span>Espelho público: GitHub</span></div>
          <div className="laws-hero-actions">
            <a className="laws-primary" href={nextUnit ? `./${nextUnit.code.toLowerCase()}/` : "#mapa"}>▶️ Abrir {nextUnit?.code || "a trilha"}</a>
            <a className="laws-secondary" href="#mapa">Ver sequência ↓</a>
            <a className="laws-secondary" href="./flashcards/">🧠 Flashcards</a>
            <a className="laws-secondary" href={snapshot?.source.page_url || "https://app.notion.com/p/3e1cf5a267318168b5c8d18590be25bf"} target="_blank" rel="noreferrer">Plano B · Notion ↗</a>
          </div>
        </div>
        <aside className="laws-next-card">
          <div className="laws-next-top"><div><p className="laws-kicker">PRÓXIMO MATERIAL DISPONÍVEL</p><span>{nextUnit?.block || "—"} · posição {nextUnit?.canonical_order || "—"}</span></div><span className="laws-next-badge">{String(nextUnit?.canonical_order || 0).padStart(2, "0")} / {units.length || 37}</span></div>
          <div className="laws-next-law"><span className="laws-next-code">{nextUnit?.code || "—"}</span><h2>{nextUnit?.title || "Aguardando sincronização"}</h2></div>
          <div className="laws-next-context"><span>{nextUnit ? trackShort(nextUnit.track) : "—"}</span><span>{nextUnit?.layer || "—"}</span><span>{nextUnit?.material_ready ? "Material pronto" : "Em edição"}</span></div>
          <div className="laws-next-focus"><span>→</span><div><small>FAÇA AGORA</small><strong>Leia a página e abra as questões</strong></div></div>
          <p>Material pronto é checkpoint editorial. Seu status, D0, D7 e D20 continuam registrados no Notion depois da execução real.</p>
          <div className="laws-checkpoints"><span className="laws-checkpoint is-done">✓ Teoria</span><span className="laws-checkpoint">○ Questões</span><span className="laws-checkpoint">○ Erros</span><span className="laws-checkpoint">○ D0</span></div>
          <a className="laws-next-cta" href={nextUnit ? `./${nextUnit.code.toLowerCase()}/` : "#mapa"}>Abrir página <span aria-hidden="true">↗</span></a>
          <a className="laws-next-notion" href={nextUnit?.notion_url || snapshot?.source.page_url || "#"} target="_blank" rel="noreferrer">Abrir no Notion ↗</a>
        </aside>
      </section>

      <section className="portugues-sequence-flow" aria-label="Início da sequência canônica">
        <div><p className="laws-kicker">ORDEM DA ESTEIRA</p><h2>Intercalada, não agrupada.</h2><p>Português, RLM e revisão entram na ordem editorial real.</p></div>
        <ol className="portugues-sequence-list">
          {flowPreview.map((unit) => <li key={unit.code}><strong>{unit.canonical_order}. {unit.code}</strong><small>{trackShort(unit.track)}</small></li>)}
        </ol>
        <div className="portugues-sequence-aside"><strong>37 posições</strong><span>Use a busca para saltar sem perder a sequência oficial.</span></div>
      </section>

      <section className="laws-status-strip portugues-stats" aria-label="Resumo da trilha">
        <article className="laws-stat-progress portugues-stat-ready"><div className="laws-stat-top"><span className="laws-stat-icon">01</span><span>MATERIAIS PRONTOS</span></div><strong>{snapshot ? `${readyCount}/${units.length}` : "—"}</strong><small>checkpoint editorial</small></article>
        <article className="laws-stat-questions portugues-stat-units"><div className="laws-stat-top"><span className="laws-stat-icon">02</span><span>UNIDADES DE CONTEÚDO</span></div><strong>{snapshot ? studyCount : "—"}</strong><small>Português + RLM</small></article>
        <article className="laws-stat-map portugues-stat-reviews"><div className="laws-stat-top"><span className="laws-stat-icon">03</span><span>REVISÕES FORMAIS</span></div><strong>{snapshot ? reviewCount : "—"}</strong><small>blocos integrados 5+1</small></article>
        <article className="laws-stat-source portugues-stat-source"><div className="laws-stat-top"><span className="laws-stat-icon">04</span><span>FONTE OPERACIONAL</span></div><strong>Notion</strong><small>GitHub publica o espelho</small></article>
      </section>

      <section className="laws-panel" id="metodo">
        <div className="laws-heading"><div><p className="laws-kicker">MÉTODO DE ESTUDO</p><h2>Página que ensina, banco que controla.</h2><p>O site leva para o material completo e preserva o Notion como registro de execução.</p></div><BookOpen size={21} color="#5e54bd" /></div>
        <div className="laws-steps">
          {(snapshot?.study_sequence || ["Teoria", "Macetes e alertas", "Questões", "Caderno de erros", "Flashcards", "D0 / D7 / D20"]).map((step, index) => <article className="laws-step" key={step}><span>{index + 1}</span><p>{step}</p></article>)}
        </div>
        <div className="laws-rule"><Sparkles size={18} /><strong>Regra:</strong><span>{snapshot?.advance_rule || "A Ordem da esteira decide a navegação; a execução real fica no Notion."}</span></div>
      </section>

      <details className="laws-panel laws-disclosure portugues-map" id="mapa" open>
        <summary><span><b>📚 SEQUÊNCIA CANÔNICA</b><strong>Mapa P01–RL13 + revisões</strong><small>Filtre por frente, bloco ou palavra-chave sem alterar a ordem.</small></span><span>{filtered.length} de {units.length || 37}</span></summary>
        <div className="laws-disclosure-body">
          <div className="portugues-toolbar">
            <label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar código, tema ou banca…" aria-label="Buscar na trilha" /></label>
            <label><Filter size={16} /><select value={track} onChange={(event) => setTrack(event.target.value)} aria-label="Filtrar por frente">{tracks.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><Filter size={16} /><select value={block} onChange={(event) => setBlock(event.target.value)} aria-label="Filtrar por bloco">{blocks.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          {error ? <div className="laws-error">O snapshot público não carregou. Use o botão Plano B · Notion enquanto a sincronização é corrigida.</div> : null}
          {!snapshot && !error ? <div className="laws-loading">Carregando a esteira editorial…</div> : null}
          {snapshot && !filtered.length ? <div className="laws-empty">Nenhuma unidade corresponde aos filtros atuais.</div> : null}
          <div className="portugues-sequence-grid">
            {filtered.map((unit) => <article className="portugues-unit-card" key={unit.code}>
              <span className="portugues-order">{String(unit.canonical_order).padStart(2, "0")}</span>
              <div className="portugues-unit-main"><div className="portugues-unit-topline"><strong>{unit.code}</strong><span>·</span><span>{trackShort(unit.track)}</span><span>·</span><span>{unit.block}</span><span className={`portugues-unit-badge ${unit.material_ready ? "is-ready" : ""}`}>{unit.material_ready ? "Material pronto" : "Em edição"}</span></div><h3>{unit.title}</h3><p>{unit.layer}{unit.priority ? ` · ${unit.priority}` : ""}</p></div>
              <a className="portugues-unit-link" href={`./${unit.code.toLowerCase()}/`}>Abrir página <ExternalLink size={13} /></a>
            </article>)}
          </div>
        </div>
      </details>

      <details className="laws-panel laws-disclosure" id="auditoria">
        <summary><span><b>🔎 AUDITORIA DA PUBLICAÇÃO</b><strong>O que fica protegido</strong></span><span>abrir conferência</span></summary>
        <div className="laws-disclosure-body"><div className="laws-audit-grid">{(snapshot?.audit_notes || []).map((note) => <div key={note}><CheckCircle2 size={16} /><span>{note}</span></div>)}</div></div>
      </details>

      <footer className="laws-footer portugues-footer"><span>TJDFT · Português Primeiro + RLM Preventivo</span><span>Notion privado · snapshot versionado · interface pública de estudo</span></footer>
    </main>
  );
}
