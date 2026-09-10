import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store",
};

const projectUrl = Deno.env.get("SUPABASE_URL") ?? "";

function readPublicKeys() {
  const keys = new Set<string>();
  const legacyAnon = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacyAnon) keys.add(legacyAnon);

  const publishableJson = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (publishableJson) {
    try {
      const parsed = JSON.parse(publishableJson) as Record<string, unknown>;
      for (const value of Object.values(parsed)) {
        if (typeof value === "string" && value.length > 0) keys.add(value);
      }
    } catch {
      // Keep the legacy key path when the platform has not exposed the new key map.
    }
  }

  return keys;
}

function isAuthorized(request: Request) {
  const suppliedApiKey = request.headers.get("apikey");
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  const candidate = suppliedApiKey || bearer;
  return Boolean(candidate && readPublicKeys().has(candidate));
}

const adminKey = (() => {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, unknown>;
      const defaultKey = parsed.default;
      if (typeof defaultKey === "string" && defaultKey.length > 0) return defaultKey;
    } catch {
      // Fall through to the legacy service role key.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
})();

const supabase = projectUrl && adminKey
  ? createClient(projectUrl, adminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const publishedSnapshotUrl =
  "https://raw.githubusercontent.com/RodrigoRosaDantas/tjdft-dashboard/main/public/data/tjdft-snapshot.json";

const notionPageIds = {
  central: "3d5cf5a2673181aa8acbebd128dada89",
  execution: "3d5cf5a26731811e9584e8841d7e4786",
  materials: "3d5cf5a267318119924bebf5bf243d0d",
  library: "3d5cf5a26731811aaf70ea6e75d78dad",
};

type DashboardSnapshot = {
  schema_version: number;
  source: {
    kind: "notion";
    title: string;
    page_id: string;
    page_url: string;
    last_edited_time: string | null;
    synced_at: string | null;
    content_hash: string | null;
    status: string;
  };
  dashboard: {
    phase: string;
    cycle: string;
    next_action: string;
    planned_questions: number;
    projected_questions: number;
    executed_questions: number | null;
    verticalized_axes: number;
    jobs: number;
  };
  [key: string]: unknown;
};

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function isDashboardSnapshot(value: unknown): value is DashboardSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const source = candidate.source as Record<string, unknown> | undefined;
  const dashboard = candidate.dashboard as Record<string, unknown> | undefined;
  return Boolean(
    source &&
      dashboard &&
      source.kind === "notion" &&
      typeof source.title === "string" &&
      typeof source.page_id === "string" &&
      typeof source.page_url === "string" &&
      typeof dashboard.phase === "string" &&
      typeof dashboard.cycle === "string" &&
      typeof dashboard.next_action === "string" &&
      typeof dashboard.planned_questions === "number" &&
      typeof dashboard.projected_questions === "number" &&
      typeof dashboard.verticalized_axes === "number" &&
      typeof dashboard.jobs === "number",
  );
}

async function readStoredSnapshot() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("tjdft_dashboard_snapshots")
    .select("snapshot")
    .eq("id", "current")
    .maybeSingle();

  if (error) throw new Error("snapshot_read_failed");
  const snapshot = data?.snapshot;
  return isDashboardSnapshot(snapshot) ? snapshot : null;
}

async function saveSnapshot(snapshot: DashboardSnapshot) {
  if (!supabase) return;
  const { error } = await supabase
    .from("tjdft_dashboard_snapshots")
    .upsert({
      id: "current",
      snapshot,
      content_hash: snapshot.source.content_hash,
      source_last_edited_time: snapshot.source.last_edited_time,
      synced_at: snapshot.source.synced_at ?? new Date().toISOString(),
    });
  if (error) throw new Error("snapshot_write_failed");
}

async function fetchPublishedSnapshot() {
  const response = await fetch(publishedSnapshotUrl + "?ts=" + Date.now(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("published_snapshot_unavailable");
  const candidate: unknown = await response.json();
  if (!isDashboardSnapshot(candidate)) throw new Error("published_snapshot_invalid");
  return candidate;
}

type NotionProperty = {
  type?: string;
  title?: Array<{ plain_text?: string; text?: { content?: string } }>;
};

type NotionPage = {
  id?: string;
  last_edited_time?: string;
  properties?: Record<string, NotionProperty>;
};

function extractNotionTitle(page: NotionPage) {
  for (const property of Object.values(page.properties ?? {})) {
    if (property.type !== "title") continue;
    const title = (property.title ?? [])
      .map((item) => item.plain_text ?? item.text?.content ?? "")
      .join("")
      .trim();
    if (title) return title;
  }
  return null;
}

async function fetchNotionPage(pageId: string, token: string) {
  const response = await fetch("https://api.notion.com/v1/pages/" + pageId, {
    headers: {
      Authorization: "Bearer " + token,
      "Notion-Version": Deno.env.get("NOTION_VERSION") ?? "2022-06-28",
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error("notion_page_unavailable");
  return await response.json() as NotionPage;
}

async function enrichFromNotion(snapshot: DashboardSnapshot, token: string) {
  const pages = await Promise.all(
    Object.values(notionPageIds).map((pageId) => fetchNotionPage(pageId, token)),
  );
  const central = pages[0];
  const editedTimes = pages
    .map((page) => page.last_edited_time)
    .filter((value): value is string => Boolean(value))
    .sort()
    .reverse();
  const now = new Date().toISOString();

  const updated: DashboardSnapshot = {
    ...snapshot,
    source: {
      ...snapshot.source,
      title: extractNotionTitle(central) ?? snapshot.source.title,
      page_id: central.id ?? snapshot.source.page_id,
      last_edited_time: central.last_edited_time ?? snapshot.source.last_edited_time,
      synced_at: now,
      status: "live",
    },
  };

  const execution = updated.execution;
  if (execution && typeof execution === "object") {
    updated.execution = {
      ...(execution as Record<string, unknown>),
      as_of: editedTimes[0] ?? now,
    };
  }

  await saveSnapshot(updated);
  return updated;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!isAuthorized(request)) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  if (request.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const url = new URL(request.url);
  const refreshRequested = url.searchParams.get("refresh") === "1";
  const notionToken = Deno.env.get("TJDFT_NOTION_TOKEN") ?? Deno.env.get("NOTION_TOKEN") ?? "";
  let snapshot: DashboardSnapshot | null = null;
  let notice: string | undefined;

  try {
    snapshot = await readStoredSnapshot();

    if (refreshRequested) {
      try {
        snapshot = await fetchPublishedSnapshot();
        await saveSnapshot(snapshot);
      } catch {
        notice = "Backend ativo; mantendo o último snapshot válido.";
      }
    }

    if (!snapshot) {
      snapshot = await fetchPublishedSnapshot();
      await saveSnapshot(snapshot);
    }

    if (refreshRequested && notionToken) {
      try {
        snapshot = await enrichFromNotion(snapshot, notionToken);
      } catch {
        notice = "Snapshot atualizado; a leitura de metadados do Notion falhou.";
      }
    }

    const responseSnapshot = notice ? { ...snapshot, notice } : snapshot;
    return jsonResponse(responseSnapshot, 200, {
      "X-TJDFT-Backend": notionToken && refreshRequested ? "notion-or-snapshot" : "supabase-snapshot",
    });
  } catch {
    return jsonResponse({ error: "tjdft_backend_unavailable" }, 500);
  }
});
