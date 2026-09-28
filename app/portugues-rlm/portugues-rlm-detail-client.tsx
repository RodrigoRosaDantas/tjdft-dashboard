"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import ReadingSettings from "../reading-settings";

type Unit = {
  code: string;
  title: string;
  track: string;
  layer: string;
  block: string;
  canonical_order: number;
  priority?: string;
  meta_initial?: number;
  material_ready: boolean;
  notion_url: string;
  content_html?: string;
};

type Snapshot = { units: Unit[] };

type LiveTrailItem = {
  code: string;
  state: string | null;
  d0: boolean | null;
  d7: boolean | null;
  d20: boolean | null;
};

type QuestionStats = {
  code?: string;
  total: number | null;
  correct: number | null;
  errors: number | null;
  sessions?: number | null;
  precision: number | null;
};

type DashboardSnapshot = {
  operational?: {
    trail?: { items?: LiveTrailItem[] };
    questions?: { by_unit?: QuestionStats[] };
  };
};

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function fallbackHtml(unit: Unit) {
  return `<h2>${unit.title}</h2><p>O conteúdo completo desta unidade está disponível no Notion. O snapshot público ainda não recebeu blocos suficientes para esta página.</p>`;
}

export default function PortuguesRlmDetailClient({ code }: { code: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [operational, setOperational] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const timestamp = Date.now();
    fetch("../../data/portugues-rlm.json?ts=" + timestamp, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("snapshot indisponível");
        return response.json();
      })
      .then((value: Snapshot) => setSnapshot(value))
      .catch(() => setError(true));
    fetch("../../data/tjdft-snapshot.json?ts=" + timestamp, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("snapshot operacional indisponível");
        return response.json();
      })
      .then((value: DashboardSnapshot) => setOperational(value))
      .catch(() => undefined);
  }, []);

  const orderedUnits = useMemo(() => [...(snapshot?.units || [])].sort((left, right) => left.canonical_order - right.canonical_order), [snapshot]);
  const unit = snapshot?.units.find((item) => item.code.toLowerCase() === code.toLowerCase());
  const live = operational?.operational?.trail?.items?.find((item) => item.code.toLowerCase() === code.toLowerCase()) || null;
  const questionStats = operational?.operational?.questions?.by_unit?.find((item) => item.code?.toLowerCase() === code.toLowerCase()) || null;
  const currentIndex = unit ? orderedUnits.findIndex((item) => item.code === unit.code) : -1;
  const previous = currentIndex > 0 ? orderedUnits[currentIndex - 1] : null;
  const next = currentIndex >= 0 ? orderedUnits[currentIndex + 1] || null : null;

  if (error) return <StatePage title="Snapshot indisponível" description="Abra a unidade original no Notion enquanto o espelho público é atualizado." />;
  if (!snapshot || !unit) return <StatePage title="Carregando a unidade…" description="A página editorial está sendo buscada no snapshot publicado." />;

  return (
    <main className="portugues-detail-page">
      <header className="laws-topbar">
        <a className="laws-back" href="../"><ArrowLeft size={17} /> Voltar para Português + RLM</a>
        <div className="laws-topbar-tools"><ReadingSettings /><span className="laws-sync"><span className="laws-live-dot" /> Snapshot publicado</span></div>
      </header>

      <section className="portugues-detail-hero">
        <p className="laws-kicker">{unit.code} · {unit.track} · {unit.block}</p>
        <h1>{unit.title}</h1>
        <p>{live?.d0 ? "Execução real registrada no Notion. O site espelha agora o estado da unidade, os checkpoints e as questões vinculadas." : unit.material_ready ? "Material editorial disponível para estudo. Leia na ordem proposta, resolva as questões e registre a execução no Notion." : "Esta unidade já está posicionada na esteira, mas o material ainda está em desenvolvimento editorial. Consulte o Notion para acompanhar a versão de trabalho."}</p>
        <div className="portugues-detail-meta"><span>posição {unit.canonical_order} / {orderedUnits.length}</span><span>{live?.state || unit.layer}</span><span>{live?.d0 ? "D0 concluído" : (unit.material_ready ? "Material pronto" : "Em edição")}</span>{questionStats?.total ? <span>{questionStats.total} questões · {formatPercent(questionStats.precision)}</span> : null}{unit.priority ? <span>{unit.priority}</span> : null}</div>
        <div className="portugues-detail-actions"><a className="primary" href={unit.notion_url} target="_blank" rel="noreferrer">Abrir fonte no Notion <ExternalLink size={14} /></a><a href="../flashcards/">Ver flashcards <ExternalLink size={14} /></a><a href="../">Voltar ao mapa <ArrowLeft size={14} /></a></div>
      </section>

      {!unit.material_ready ? <div className="portugues-pending-note">⚠️ Conteúdo editorial em desenvolvimento. Esta página não transforma o item em “estudado” e não altera Status, D0, D7 ou D20 no Notion.</div> : null}
      {live?.d0 ? <div className="portugues-pending-note">✅ {unit.code} consta como {live.state || "estudado"} · D0 concluído{questionStats?.total ? " · " + questionStats.total + " questões · " + (questionStats.correct ?? 0) + " acertos · " + (questionStats.errors ?? 0) + " erros" : ""}.</div> : null}

      <div className="portugues-detail-grid">
        <article className="study-html" dangerouslySetInnerHTML={{ __html: unit.content_html || fallbackHtml(unit) }} />
        <aside className="portugues-detail-side">
          <h2>Rota da sessão</h2>
          <p>{live?.d0 ? "A execução já foi registrada. Use esta página para consolidar e acompanhe D7/D20 pelo mesmo banco operacional." : "O site entrega o material e também lê o estado operacional do Notion."}</p>
          {live ? <><strong>Estado operacional</strong><ul><li>{live.state || "Sem estado"}</li><li>{live.d0 ? "D0 concluído" : "D0 pendente"}</li><li>{live.d7 ? "D7 concluído" : "D7 pendente"}</li><li>{live.d20 ? "D20 concluído" : "D20 pendente"}</li>{questionStats?.total ? <li>{questionStats.total} questões · {questionStats.correct ?? 0} acertos · {questionStats.errors ?? 0} erros · {formatPercent(questionStats.precision)}</li> : null}</ul></> : null}
          <strong>Sequência recomendada</strong>
          <ul><li>Teoria e exemplos</li><li>Macetes e alertas</li><li>Questões da unidade</li><li>Motivo dos erros</li><li>Flashcards reaplicáveis</li><li>D0; D7/D20 em paralelo</li></ul>
          <a href={unit.notion_url} target="_blank" rel="noreferrer">Abrir registro operacional <ExternalLink size={13} /></a>
        </aside>
      </div>

      <nav className="portugues-detail-nav" aria-label="Navegação da esteira">
        {previous ? <a href={`../${previous.code.toLowerCase()}/`}><ArrowLeft size={14} /> {previous.code} · anterior</a> : <span />}
        {next ? <a href={`../${next.code.toLowerCase()}/`}>{next.code} · próxima <ArrowRight size={14} /></a> : <a href="../">Voltar ao mapa <ArrowRight size={14} /></a>}
      </nav>
    </main>
  );
}

function StatePage({ title, description }: { title: string; description: string }) {
  return <main className="portugues-detail-page"><header className="laws-topbar"><a className="laws-back" href="../"><ArrowLeft size={17} /> Voltar para Português + RLM</a><div className="laws-topbar-tools"><ReadingSettings /></div></header><section className="portugues-detail-hero"><p className="laws-kicker">PORTUGUÊS + RLM · TJDFT</p><h1>{title}</h1><p>{description}</p><div className="portugues-detail-actions"><a className="primary" href="https://app.notion.com/p/3e1cf5a267318168b5c8d18590be25bf" target="_blank" rel="noreferrer">Abrir a central no Notion <ExternalLink size={14} /></a></div></section></main>;
}
