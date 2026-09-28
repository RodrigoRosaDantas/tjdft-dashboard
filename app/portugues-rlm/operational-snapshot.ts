"use client";

const LIVE_NOTION_API_URL = "https://ugxdmvlynyzfmmgshvyq.supabase.co/functions/v1/tjdft-notion";
// Chave pública/publishable: autoriza apenas a leitura da função; o token privado do Notion não vai ao navegador.
const LIVE_NOTION_API_KEY = "sb_publishable_acJ3KnWmZLidHTFhtTGYUw_RkYu39ca";
const SNAPSHOT_REQUEST_TIMEOUT_MS = 8000;

export type OperationalSnapshotMode = "live" | "fallback";

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

function syncedAt(value: unknown) {
  if (!value || typeof value !== "object") return 0;
  const source = (value as { source?: { synced_at?: string | null; last_edited_time?: string | null } }).source;
  const raw = source?.synced_at || source?.last_edited_time || "";
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
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
    if (syncedAt(fallback.value.snapshot) > syncedAt(live.value.snapshot)) {
      return { ...fallback.value, mode: "fallback" };
    }
    return { ...live.value, mode: "live" };
  }
  if (live.status === "fulfilled") return { ...live.value, mode: "live" };
  if (fallback.status === "fulfilled") return { ...fallback.value, mode: "fallback" };
  throw new Error("snapshot operacional indisponível nas fontes live e fallback");
}
