"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CircleAlert, ExternalLink, RefreshCw } from "lucide-react";

const REPOSITORY = "RodrigoRosaDantas/tjdft-dashboard";
const WORKFLOW_URL = "https://github.com/" + REPOSITORY + "/actions/workflows/sync-notion.yml";
const WORKFLOW_API = "https://api.github.com/repos/" + REPOSITORY + "/actions/workflows/sync-notion.yml/runs?branch=main&per_page=1";
const BASELINE_KEY = "tjdft:sync:baseline-run";

type WorkflowRun = {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
};

type PanelTone = "neutral" | "running" | "success" | "warning" | "error";
type SyncMode = "live" | "fallback" | "error";

type SyncWorkflowPanelProps = {
  publishedAt: string | null;
  onReload: () => Promise<SyncMode>;
};

function formatWorkflowDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function readBaseline() {
  if (typeof window === "undefined") return 0;
  try {
    const value = Number(window.sessionStorage.getItem(BASELINE_KEY) || 0);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function describeRun(run: WorkflowRun | null, publishedAt: string | null): { tone: PanelTone; title: string; detail: string } {
  if (!run) return { tone: "neutral", title: "Nenhuma execução encontrada", detail: "Use Atualizar agora para consultar a fonte viva ou abra o workflow para uma publicação oficial." };
  if (run.status !== "completed") return { tone: "running", title: "Atualização em andamento", detail: "O GitHub está consultando o Notion e validando o novo snapshot." };
  if (run.conclusion === "success") return { tone: "success", title: "Sincronização validada", detail: "Concluída em " + formatWorkflowDate(run.updated_at) + "." };
  const publishedDetail = publishedAt ? " Snapshot anterior: " + formatWorkflowDate(publishedAt) + "." : " O snapshot anterior foi preservado.";
  return { tone: "warning", title: "Atualização não promovida", detail: "Resultado " + (run.conclusion || "inconclusivo") + "." + publishedDetail };
}

export default function SyncWorkflowPanel({ publishedAt, onReload }: SyncWorkflowPanelProps) {
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [checking, setChecking] = useState(false);
  const [baseline, setBaseline] = useState(0);
  const [guide, setGuide] = useState<{ tone: PanelTone; title: string; detail: string } | null>(null);
  const [requestError, setRequestError] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const checkingRef = useRef(false);
  const runRef = useRef<WorkflowRun | null>(null);

  const check = useCallback(async () => {
    if (checkingRef.current) return runRef.current;
    checkingRef.current = true;
    setChecking(true);
    setRequestError(false);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(WORKFLOW_API + "&t=" + Date.now(), {
        cache: "no-store",
        headers: { Accept: "application/vnd.github+json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("GitHub " + response.status);
      const payload = (await response.json()) as { workflow_runs?: WorkflowRun[] };
      const next = payload.workflow_runs?.[0] ?? null;
      runRef.current = next;
      setRun(next);
      const storedBaseline = readBaseline();
      if (storedBaseline && next) {
        if (next.id > storedBaseline && next.status === "completed") {
          setMonitoring(false);
          setBaseline(0);
          try { window.sessionStorage.removeItem(BASELINE_KEY); } catch { /* armazenamento opcional */ }
          setGuide(next.conclusion === "success"
            ? { tone: "success", title: "Dados publicados", detail: "O novo snapshot foi validado. Recarregue o painel para ler os dados atualizados." }
            : { tone: "warning", title: "Snapshot anterior preservado", detail: "A execução terminou sem publicar dados novos. Abra o diagnóstico no GitHub." });
        } else {
          setMonitoring(next.status !== "completed");
        }
      }
      return next;
    } catch {
      setRequestError(true);
      return null;
    } finally {
      window.clearTimeout(timeout);
      checkingRef.current = false;
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const storedBaseline = readBaseline();
    setBaseline(storedBaseline);
    setMonitoring(Boolean(storedBaseline));
    void check();
  }, [check]);

  useEffect(() => {
    if (!monitoring || !baseline) return undefined;
    const timer = window.setInterval(() => { void check(); }, 15000);
    return () => window.clearInterval(timer);
  }, [monitoring, baseline, check]);

  useEffect(() => {
    const handleReturn = () => { if (!document.hidden) void check(); };
    window.addEventListener("focus", handleReturn);
    window.addEventListener("pageshow", handleReturn);
    return () => {
      window.removeEventListener("focus", handleReturn);
      window.removeEventListener("pageshow", handleReturn);
    };
  }, [check]);

  const openWorkflow = async () => {
    const current = await check();
    const currentId = Number(current?.id ?? runRef.current?.id ?? 0);
    if (typeof window !== "undefined") {
      if (currentId > 0) {
        try { window.sessionStorage.setItem(BASELINE_KEY, String(currentId)); } catch { /* armazenamento opcional */ }
        setBaseline(currentId);
        setMonitoring(true);
      }
      window.open(WORKFLOW_URL, "_blank", "noopener,noreferrer");
    }
  };

  const reloadSnapshot = async () => {
    setGuide({ tone: "running", title: "Recarregando snapshot", detail: "Consultando o Supabase e o backup publicado no GitHub." });
    const mode = await onReload().catch(() => "error" as const);
    if (typeof window !== "undefined") {
      try { window.sessionStorage.removeItem(BASELINE_KEY); } catch { /* armazenamento opcional */ }
    }
    setBaseline(0);
    setMonitoring(false);
    setGuide(mode === "live"
      ? { tone: "success", title: "Painel atualizado", detail: "A fonte viva do TJDFT foi consultada e a leitura mais recente foi carregada." }
      : mode === "fallback"
        ? { tone: "warning", title: "Backup do GitHub carregado", detail: "A fonte viva não respondeu; o snapshot publicado foi mantido como fallback." }
        : { tone: "error", title: "Atualização indisponível", detail: "A fonte viva e o snapshot publicado não puderam ser carregados." });
  };

  const status = describeRun(run, publishedAt);
  const displayStatus = requestError
    ? { tone: "error" as PanelTone, title: "GitHub Actions indisponível", detail: "Não foi possível consultar o status do workflow agora." }
    : status;
  const StatusIcon = displayStatus.tone === "success" ? Check : displayStatus.tone === "warning" || displayStatus.tone === "error" ? CircleAlert : RefreshCw;
  const runUrl = run?.html_url && run.html_url.startsWith("https://github.com/") ? run.html_url : WORKFLOW_URL;

  return (
    <section className="sync-panel" aria-labelledby="tjdft-sync-title">
      <div className="sync-panel-head">
        <div className="sync-panel-title">
          <span className="sync-panel-icon" aria-hidden="true"><RefreshCw size={21} /></span>
          <div>
            <p className="eyebrow">PUBLICAÇÃO DOS DADOS</p>
            <h2 id="tjdft-sync-title">Atualização oficial do TJDFT</h2>
            <p className="sync-panel-description">O Notion continua privado. O GitHub valida e publica o snapshot; o Supabase entrega a leitura ao painel.</p>
          </div>
        </div>
        <a className="sync-workflow-link" href={WORKFLOW_URL} target="_blank" rel="noreferrer">
          GitHub Actions <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className={"sync-panel-status sync-tone-" + displayStatus.tone} data-tone={displayStatus.tone} aria-live="polite">
        <StatusIcon className={checking ? "sync-status-spin" : ""} size={21} />
        <div>
          <strong>{displayStatus.title}</strong>
          <span>{displayStatus.detail}</span>
        </div>
        {run && <a href={runUrl} target="_blank" rel="noreferrer">Ver execução <span aria-hidden="true">↗</span></a>}
      </div>
      <div className="sync-panel-actions">
        <button className="secondary-button" type="button" onClick={() => void check()} disabled={checking}>
          <RefreshCw size={16} className={checking ? "sync-status-spin" : ""} /> Verificar workflow
        </button>
        <button className="primary-button sync-primary-button" type="button" onClick={() => void reloadSnapshot()} disabled={checking}>
          <RefreshCw size={16} className={checking ? "sync-status-spin" : ""} /> Atualizar agora
        </button>
        <button className="text-button sync-open-workflow" type="button" onClick={() => void openWorkflow()} disabled={checking}>
          {monitoring ? "Acompanhar workflow" : "Abrir workflow"} <ExternalLink size={14} />
        </button>
      </div>
      {guide && <div className={"sync-panel-guide sync-tone-" + guide.tone} role="status">
        <div><strong>{guide.title}</strong><span>{guide.detail}</span></div>
        {guide.tone === "success" && guide.title === "Dados publicados" && <button className="text-button" type="button" onClick={() => void reloadSnapshot()}>Recarregar snapshot <RefreshCw size={14} /></button>}
        {guide.tone === "warning" && <a href={WORKFLOW_URL} target="_blank" rel="noreferrer">Ver diagnóstico <ExternalLink size={13} /></a>}
        {guide.tone === "error" && <button className="text-button" type="button" onClick={() => void reloadSnapshot()}>Tentar novamente <RefreshCw size={14} /></button>}
      </div>}
      <div className="sync-panel-foot">
        <span><span className="source-dot" /> Notion privado → GitHub Actions → snapshot → Supabase</span>
        <span>Última publicação: {publishedAt ? formatWorkflowDate(publishedAt) : "ainda não informada"}</span>
      </div>
    </section>
  );
}
