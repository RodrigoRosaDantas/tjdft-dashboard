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

export async function loadOperationalSnapshot<T>(fallbackUrl: string): Promise<SnapshotResult<T>> {
  try {
    const live = await readJson<T>(LIVE_NOTION_API_URL + "?refresh=1", {
      headers: {
        Accept: "application/json",
        apikey: LIVE_NOTION_API_KEY,
        Authorization: "Bearer " + LIVE_NOTION_API_KEY,
      },
    });
    return { ...live, mode: "live" };
  } catch {
    const fallback = await readJson<T>(fallbackUrl);
    return { ...fallback, mode: "fallback" };
  }
}
