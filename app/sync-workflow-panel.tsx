"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CircleAlert, RefreshCw } from "lucide-react";

const REPOSITORY = "RodrigoRosaDantas/tjdft-dashboard";
const WORKFLOW_URL = "https://github.com/" + REPOSITORY + "/actions/workflows/sync-notion.yml";
const WORKFLOW_API = "https://api.github.com/repos/" + REPOSITORY + "/actions/workflows/sync-notion.yml/runs?per_page=1";
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

type SyncWorkflowPanelProps = {
  publishedAt: string | null;
  onReload: () => Promise<void>;
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
  if (!run) return { tone: "neutral", title: "Nenhuma execução encontrada", detail: "Use Atualizar dados para abrir o workflow de sincronização." };
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
  const checkingRef = useRef(false);
  const runRef = useRef<WorkflowRun | null>(null);

  const check = useCallback(async () => {
    if (checkingRef.current) return runRef.current;
    checkingRef.current = true;
    setChecking(true);
    setRequestError(false);
    try {
      const response = await fetch(WORKFLOW_API + "&t=" + Date.now(), {
        cache: "no-store",
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!response.ok) throw new Error("GitHub " + response.status);
      const payload = (await response.json()) as { workflow_runs?: WorkflowRun[] };
      const next = payload.workflow_runs?.[0] ?? null;
      runRef.current = next;
      setRun(next);
      const storedBaseline = readBaseline();
      if (storedBaseline && next && next.id > storedBaseline && next.status === "completed") {
        setGuide(next.conclusion === "success"
          ? { tone: "success", title: "Dados publicados", detail: "O novo snapshot foi validado. Recarregue o painel para ler os dados atualizados." }
          : { tone: "warning", title: "Snapshot anterior preservado", detail: "A execução terminou sem publicar dados novos. Abra o diagnóstico no GitHub." });
      }
      return next;
    } catch {
      setRequestError(true);
      return null;
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const storedBaseline = readBaseline();
    setBaseline(storedBaseline);
    void check();
  }, [check]);

  useEffect(() => {
    if (!baseline || !run || run.status === "completed") return undefined;
    const timer = window.setInterval(() => { void check(); }, 15000);
    return () => window.clearInterval(timer);
  }, [baseline, run, check]);

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
      try { window.sessionStorage.setItem(BASELINE_KEY, String(currentId)); } catch { /* armazenamento opcional */ }
      window.location.assign(WORKFLOW_URL);
    }
  };

  const reloadSnapshot = async () => {
    setGuide({ tone: "running", title: "Recarregando snapshot", detail: "Consultando o Supabase e o backup publicado no GitHub." });
    await onReload();
    if (typeof window !== "undefined") {
      try { window.sessionStorage.removeItem(BASELINE_KEY); } catch { /* armazenamento opcional */ }
    }
    setBaseline(0);
    setGuide({ tone: "success", title: "Painel atualizado", detail: "A leitura mais recente do TJDFT foi carregada." });
  };

  const status = describeRun(run, publishedAt);
  const StatusIcon = status.tone === "success" ? Check : status.tone === "warning" || status.tone === "error" ? CircleAlert : RefreshCw;
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
      <div className={"sync-panel-status sync-tone-" + status.tone} data-tone={status.tone} aria-live="polite">
        <StatusIcon className={checking ? "sync-status-spin" : ""} size={21} />
        <div>
          <strong>{status.title}</strong>
          <span>{requestError ? "Não foi possível consultar o GitHub agora." : status.detail}</span>
        </div>
        {run && <a href={runUrl} target="_blank" rel="noreferrer">Ver execução <span aria-hidden="true">↗</span></a>}
      </div>
      <div className="sync-panel-actions">
        <button className="secondary-button" type="button" onClick={() => void check()} disabled={checking}>
          <RefreshCw size={16} className={checking ? "sync-status-spin" : ""} /> Verificar
        </button>
        <button className="primary-button sync-primary-button" type="button" onClick={() => void openWorkflow()} disabled={checking}>
          <RefreshCw size={16} /> Atualizar dados
        </button>
      </div>
      {guide && <div className={"sync-panel-guide sync-tone-" + guide.tone} role="status">
        <div><strong>{guide.title}</strong><span>{guide.detail}</span></div>
        {guide.tone === "success" && guide.title === "Dados publicados" && <button className="text-button" type="button" onClick={() => void reloadSnapshot()}>Recarregar snapshot <RefreshCw size={14} /></button>}
        {guide.tone === "warning" && <a href={WORKFLOW_URL} target="_blank" rel="noreferrer">Ver diagnóstico <ExternalLink size={13} /></a>}
      </div>}
      <div className="sync-panel-foot">
        <span><span className="source-dot" /> Notion privado → GitHub Actions → snapshot → Supabase</span>
        <span>Última publicação: {publishedAt ? formatWorkflowDate(publishedAt) : "ainda não informada"}</span>
      </div>
    </section>
  );
}
