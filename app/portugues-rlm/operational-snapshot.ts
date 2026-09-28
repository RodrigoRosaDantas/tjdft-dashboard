"use client";

const LIVE_NOTION_API_URL = "https://ugxdmvlynyzfmmgshvyq.supabase.co/functions/v1/tjdft-notion";
// Chave pública/publishable: autoriza apenas a leitura da função; o token privado do Notion não vai ao navegador.
const LIVE_NOTION_API_KEY = "sb_publishable_acJ3KnWmZLidHTFhtTGYUw_RkYu39ca";
const SNAPSHOT_REQUEST_TIMEOUT_MS = 8000;

export type OperationalSnapshotMode = "live" | "supabase" | "fallback";

type SnapshotResult<T> = {
  snapshot: T;
  mode: OperationalSnapshotMode;
  cacheMode: string | null;
};

async function readJson<T>(url: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), SNAPSHOT_REQUEST_TIMEOUT_MS);
  try {
    const separator = url.includes("?") ? "&" : "?";
    const response = await fetch(url + separator + "ts=" + Date.now(), {
      ...options,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("snapshot HTTP " + response.status);
    return {
      snapshot: await response.json() as T,
      cacheMode: response.headers.get("x-tjdft-cache"),
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

function sourceInfo(value: unknown) {
  if (!value || typeof value !== "object") return null;
  return (value as {
    source?: {
      synced_at?: string | null;
      last_edited_time?: string | null;
      component_synced_at?: Record<string, string | null>;
      component_sources?: Record<string, string | null>;
    };
  }).source || null;
}

function syncedAt(value: unknown) {
  const source = sourceInfo(value);
  const raw = source?.component_synced_at?.operational || source?.synced_at || source?.last_edited_time || "";
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function liveMode(value: unknown): OperationalSnapshotMode {
  return sourceInfo(value)?.component_sources?.operational === "notion" ? "live" : "supabase";
}

function operationalProgress(value: unknown) {
  const operational = (value as {
    operational?: {
      trail?: {
        checkpoints?: { d0?: number; d7?: number; d20?: number };
        items?: Array<{ d0?: boolean; d7?: boolean; d20?: boolean; last_execution?: string | null }>;
      };
      questions?: { total?: number | null };
    };
  } | null)?.operational;
  const items = operational?.trail?.items || [];
  const count = (key: "d0" | "d7" | "d20") =>
    Number(operational?.trail?.checkpoints?.[key]) ||
    items.filter((item) => item[key] === true).length;
  const latestExecution = items.reduce((latest, item) => {
    const parsed = Date.parse(item.last_execution || "");
    return Number.isFinite(parsed) ? Math.max(latest, parsed) : latest;
  }, 0);
  return {
    questions: Math.max(0, Number(operational?.questions?.total) || 0),
    d0: count("d0"),
    d7: count("d7"),
    d20: count("d20"),
    latestExecution,
  };
}

function regressesAgainst(candidate: unknown, baseline: unknown) {
  const current = operationalProgress(candidate);
  const previous = operationalProgress(baseline);
  return current.questions < previous.questions ||
    current.d0 < previous.d0 ||
    current.d7 < previous.d7 ||
    current.d20 < previous.d20 ||
    current.latestExecution < previous.latestExecution;
}

export async function loadOperationalSnapshot<T>(fallbackUrl: string): Promise<SnapshotResult<T>> {
  const livePromise = readJson<T>(LIVE_NOTION_API_URL + "?refresh=1", {
    headers: {
      Accept: "application/json",
      apikey: LIVE_NOTION_API_KEY,
      Authorization: "Bearer " + LIVE_NOTION_API_KEY,
    },
  });
  const fallbackPromise = readJson<T>(fallbackUrl);

  const [live, fallback] = await Promise.allSettled([livePromise, fallbackPromise]);

  if (live.status === "fulfilled" && fallback.status === "fulfilled") {
    if (regressesAgainst(live.value.snapshot, fallback.value.snapshot)) {
      return { ...fallback.value, mode: "fallback" };
    }
    if (regressesAgainst(fallback.value.snapshot, live.value.snapshot)) {
      return { ...live.value, mode: liveMode(live.value.snapshot) };
    }
    if (syncedAt(fallback.value.snapshot) > syncedAt(live.value.snapshot)) {
      return { ...fallback.value, mode: "fallback" };
    }
    return { ...live.value, mode: liveMode(live.value.snapshot) };
  }
  if (live.status === "fulfilled") return { ...live.value, mode: liveMode(live.value.snapshot) };
  if (fallback.status === "fulfilled") return { ...fallback.value, mode: "fallback" };
  throw new Error("snapshot operacional indisponível nas fontes live e fallback");
}
