"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CheckCircle2, ExternalLink, Filter, Search, Sparkles } from "lucide-react";
import ReadingSettings from "../reading-settings";
import { loadOperationalSnapshot, type OperationalSnapshotMode } from "./operational-snapshot";

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

type LiveTrailItem = {
  code: string;
  state: string | null;
  d0: boolean | null;
  d7: boolean | null;
  d20: boolean | null;
  material_ready: boolean | null;
  last_execution?: string | null;
  next_review?: string | null;
};

type QuestionStats = {
  code?: string;
  total: number | null;
  correct: number | null;
  errors: number | null;
  doubts?: number | null;
  annulled?: number | null;
  sessions?: number | null;
  precision: number | null;
};

type DashboardSnapshot = {
  source?: { synced_at?: string | null };
  operational?: {
    trail?: {
      next?: LiveTrailItem | null;
      items?: LiveTrailItem[];
      checkpoints?: { d0?: number; d7?: number; d20?: number };
    };
    questions?: QuestionStats & { by_unit?: QuestionStats[] };
    errors?: { active_count?: number | null };
  };
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

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

export default function PortuguesRlmPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [operational, setOperational] = useState<DashboardSnapshot | null>(null);
  const [operationalMode, setOperationalMode] = useState<OperationalSnapshotMode | null>(null);
  const [error, setError] = useState(false);
  const [operationalError, setOperationalError] = useState(false);
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState("Todos");
  const [block, setBlock] = useState("Todos");

  useEffect(() => {
    let cancelled = false;
    const timestamp = Date.now();
    fetch("../data/portugues-rlm.json?ts=" + timestamp, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("snapshot editorial indisponível");
        return response.json();
      })
      .then((value: Snapshot) => {
        if (!cancelled) setSnapshot(value);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    loadOperationalSnapshot<DashboardSnapshot>("../data/tjdft-snapshot.json")
      .then(({ snapshot: value, mode }) => {
        if (!cancelled) {
          setOperational(value);
          setOperationalMode(mode);
          setOperationalError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setOperationalError(true);
      });
    return () => { cancelled = true; };
  }, []);

  const units = useMemo(() => [...(snapshot?.units || [])].sort((left, right) => left.canonical_order - right.canonical_order), [snapshot]);
  const liveByCode = useMemo(() => new Map((operational?.operational?.trail?.items || []).map((item) => [item.code, item])), [operational]);
  const questionsByCode = useMemo(() => new Map((operational?.operational?.questions?.by_unit || []).map((item) => [item.code || "", item])), [operational]);
  const operationalNextCode = operational?.operational?.trail?.next?.code || null;
  const nextUnit = operational
    ? ((operationalNextCode ? units.find((unit) => unit.code === operationalNextCode) : null)
      || units.find((unit) => unit.material_ready && liveByCode.get(unit.code)?.d0 !== true)
      || null)
    : operationalError
      ? (units.find((unit) => unit.material_ready) || units[0] || null)
      : null;
  const completedUnits = units.filter((unit) => liveByCode.get(unit.code)?.d0 === true);
  const latestStudied = [...completedUnits].sort((left, right) => {
    const leftTime = Date.parse(liveByCode.get(left.code)?.last_execution || "") || 0;
    const rightTime = Date.parse(liveByCode.get(right.code)?.last_execution || "") || 0;
    return rightTime - leftTime || right.canonical_order - left.canonical_order;
  })[0] || null;
  const overallQuestions = operational?.operational?.questions || null;
  const operationalSyncedAt = operational?.source?.synced_at || snapshot?.source.synced_at || null;
  const operationalSourceLabel = operationalMode === "live" ? "Notion · ao vivo" : operationalMode === "supabase" ? "Supabase · snapshot" : operationalMode === "fallback" ? "GitHub · backup" : "Sincronizando";
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
  const flowPreview = units.slice(0, 5);
  const nextLive = nextUnit ? liveByCode.get(nextUnit.code) : null;
  const nextQuestions = nextUnit ? questionsByCode.get(nextUnit.code) : null;
  const latestLive = latestStudied ? liveByCode.get(latestStudied.code) : null;
  const latestQuestions = latestStudied ? questionsByCode.get(latestStudied.code) : null;

  return (
    <main className="laws-page portugues-page">
      <header className="laws-topbar">
        <a className="laws-back" href="../"><ArrowLeft size={17} /> Dashboard TJDFT</a>
        <div className="laws-topbar-tools">
          <ReadingSettings />
          <div className="laws-sync" data-operational-source={operationalMode || "loading"} data-next-code={nextUnit?.code || ""} aria-label={`Execução operacional: ${operationalSourceLabel}; atualização ${formatDate(operationalSyncedAt)}`}>
            <span className="laws-live-dot" aria-hidden="true" />
            <span className="portugues-sync-source">{operationalSourceLabel}</span>
            <span className="portugues-sync-separator" aria-hidden="true">·</span>
            <time className="portugues-sync-date" dateTime={operationalSyncedAt || undefined}>{formatDate(operationalSyncedAt)}</time>
            <span className="portugues-sync-short" aria-hidden="true">{operationalMode === "live" ? "Ao vivo" : operationalMode === "supabase" ? "Snapshot" : "Backup"}</span>
          </div>
        </div>
      </header>

      <section className="laws-hero">
        <div className="laws-hero-copy">
          <p className="laws-kicker">🧠 TRILHA DE ESTUDO · TJDFT</p>
          <h1>Português Primeiro + RLM Preventivo<span className="laws-hero-dot">.</span></h1>
          <p className="laws-lead">Estude pela página, resolva as questões, transforme os erros em revisão e avance pela sequência oficial. O banco organiza; o material ensina.</p>
          <div className="laws-hero-thesis"><span>TEORIA</span><i>→</i><span>QUESTÕES</span><i>→</i><span>ERROS</span><i>→</i><span>REVISÃO</span></div>
          <div className="laws-hero-meta"><span className="laws-live-dot" /><span>Execução: {operationalSourceLabel}</span><span className="laws-meta-separator">·</span><span>Materiais: GitHub</span></div>
          <div className="laws-hero-actions">
            <a className="laws-primary" href={nextUnit ? `./${nextUnit.code.toLowerCase()}/` : "#mapa"}>▶️ Abrir {nextUnit?.code || "a trilha"}</a>
            <a className="laws-secondary" href="#mapa">Ver sequência ↓</a>
            <a className="laws-secondary" href="./flashcards/">🧠 Flashcards</a>
            <a className="laws-secondary" href={snapshot?.source.page_url || "https://app.notion.com/p/3e1cf5a267318168b5c8d18590be25bf"} target="_blank" rel="noreferrer">Plano B · Notion ↗</a>
          </div>
        </div>
        <aside className="laws-next-card">
          <div className="laws-next-top"><div><p className="laws-kicker">PRÓXIMA UNIDADE OPERACIONAL</p><span>{nextUnit?.block || "—"} · posição {nextUnit?.canonical_order || "—"}</span></div><span className="laws-next-badge">{String(nextUnit?.canonical_order || 0).padStart(2, "0")} / {units.length || 37}</span></div>
          <div className="laws-next-law"><span className="laws-next-code">{nextUnit?.code || "—"}</span><h2>{nextUnit?.title || "Aguardando sincronização"}</h2></div>
          <div className="laws-next-context"><span>{nextUnit ? trackShort(nextUnit.track) : "—"}</span><span>{nextLive?.state || "Não estudado"}</span><span>{nextUnit?.material_ready ? "Material pronto" : "Em edição"}</span></div>
          <div className="laws-next-focus"><span>→</span><div><small>FAÇA AGORA</small><strong>{nextUnit ? "Abrir " + nextUnit.code + " e iniciar a sessão" : "Aguardar sincronização"}</strong></div></div>
          <p>{latestStudied ? latestStudied.code + " já consta com D0 concluído. A sequência avançou para " + (nextUnit?.code || "a próxima unidade") + "." : "A próxima unidade é definida pelo estado real da esteira no Notion."}</p>
          <div className="laws-checkpoints"><span className={"laws-checkpoint " + (nextQuestions?.total ? "is-done" : "")}>{nextQuestions?.total ? "✓" : "○"} Questões</span><span className={"laws-checkpoint " + (nextLive?.d0 ? "is-done" : "")}>{nextLive?.d0 ? "✓" : "○"} D0</span><span className={"laws-checkpoint " + (nextLive?.d7 ? "is-done" : "")}>{nextLive?.d7 ? "✓" : "○"} D7</span><span className={"laws-checkpoint " + (nextLive?.d20 ? "is-done" : "")}>{nextLive?.d20 ? "✓" : "○"} D20</span></div>
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
        <article className="laws-stat-progress portugues-stat-ready"><div className="laws-stat-top"><span className="laws-stat-icon">01</span><span>MATERIAIS PRONTOS</span></div><strong>{snapshot ? readyCount + "/" + units.length : "—"}</strong><small>checkpoint editorial</small></article>
        <article className="laws-stat-questions portugues-stat-units"><div className="laws-stat-top"><span className="laws-stat-icon">02</span><span>D0 CONCLUÍDO</span></div><strong>{operational ? completedUnits.length + "/" + units.length : "—"}</strong><small>execução real da esteira</small></article>
        <article className="laws-stat-map portugues-stat-reviews"><div className="laws-stat-top"><span className="laws-stat-icon">03</span><span>QUESTÕES RESPONDIDAS</span></div><strong>{overallQuestions?.total ?? "—"}</strong><small>{overallQuestions?.total ? (overallQuestions.correct ?? 0) + " acertos · " + (overallQuestions.errors ?? 0) + " erros" : "sem evidência registrada"}</small></article>
        <article className="laws-stat-source portugues-stat-source"><div className="laws-stat-top"><span className="laws-stat-icon">04</span><span>PRECISÃO</span></div><strong>{formatPercent(overallQuestions?.precision)}</strong><small>{operationalSourceLabel}</small></article>
      </section>

      <section className="laws-panel portugues-method" id="execucao-real">
        <div className="laws-heading"><div><p className="laws-kicker">EXECUÇÃO REAL</p><h2>{latestStudied ? latestStudied.code + " registrado no Notion" : "Ainda sem D0 concluído"}</h2><p>{latestStudied ? (latestLive?.state || "Estudado") + ". O site agora usa o mesmo estado operacional do Notion." : "Quando uma unidade receber D0, ela aparecerá aqui automaticamente."}</p></div><CheckCircle2 size={21} color="#5e54bd" /></div>
        {latestStudied ? <div className="laws-status-strip portugues-stats" aria-label={"Desempenho de " + latestStudied.code}>
          <article className="laws-stat-progress"><div className="laws-stat-top"><span className="laws-stat-icon">✓</span><span>UNIDADE</span></div><strong>{latestStudied.code}</strong><small>{latestLive?.state || "D0 concluído"}</small></article>
          <article className="laws-stat-questions"><div className="laws-stat-top"><span className="laws-stat-icon">Q</span><span>QUESTÕES</span></div><strong>{latestQuestions?.total ?? "—"}</strong><small>{latestQuestions?.total ? (latestQuestions.correct ?? 0) + " acertos · " + (latestQuestions.errors ?? 0) + " erros" : "sem vínculo por unidade"}</small></article>
          <article className="laws-stat-map"><div className="laws-stat-top"><span className="laws-stat-icon">%</span><span>PRECISÃO</span></div><strong>{formatPercent(latestQuestions?.precision)}</strong><small>{latestQuestions?.sessions ? latestQuestions.sessions + " sessão(ões)" : "resultado da unidade"}</small></article>
          <article className="laws-stat-source"><div className="laws-stat-top"><span className="laws-stat-icon">↻</span><span>REVISÕES</span></div><strong>{latestLive?.d7 ? "D7 ✓" : "D7 pendente"}</strong><small>{latestLive?.d20 ? "D20 concluído" : "D20 pendente"}</small></article>
        </div> : null}
        {operationalError ? <div className="laws-error">O material editorial carregou, mas o snapshot operacional não respondeu. O Notion continua sendo a fonte de verdade até a próxima sincronização.</div> : null}
      </section>

      <section className="laws-panel portugues-method" id="metodo">
        <div className="laws-heading"><div><p className="laws-kicker">MÉTODO DE ESTUDO</p><h2>Página que ensina, banco que controla.</h2><p>O site leva para o material completo e preserva o Notion como registro de execução.</p></div><BookOpen size={21} color="#5e54bd" /></div>
        <div className="laws-steps">
          {(snapshot?.study_sequence || ["Teoria", "Macetes e alertas", "Questões", "Caderno de erros", "Flashcards", "D0 / D7 / D20"]).map((step, index) => <article className="laws-step portugues-method-step" key={step}><span aria-hidden="true">{index + 1}</span><p>{step}</p></article>)}
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
            {filtered.map((unit) => {
              const live = liveByCode.get(unit.code);
              const questionStats = questionsByCode.get(unit.code);
              return <article className="portugues-unit-card" key={unit.code}>
                <span className="portugues-order">{String(unit.canonical_order).padStart(2, "0")}</span>
                <div className="portugues-unit-main"><div className="portugues-unit-topline"><strong>{unit.code}</strong><span>·</span><span>{trackShort(unit.track)}</span><span>·</span><span>{unit.block}</span><span className={"portugues-unit-badge " + (live?.d0 ? "is-ready" : "")}>{live?.d0 ? "D0 concluído" : (live?.state || (unit.material_ready ? "Material pronto" : "Em edição"))}</span></div><h3>{unit.title}</h3><p>{questionStats?.total ? questionStats.total + " questões · " + (questionStats.correct ?? 0) + " acertos · " + formatPercent(questionStats.precision) : unit.layer + (unit.priority ? " · " + unit.priority : "")}</p></div>
                <a className="portugues-unit-link" href={"./" + unit.code.toLowerCase() + "/"}>Abrir página <ExternalLink size={13} /></a>
              </article>;
            })}
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
