import { buildSnapshot } from "./index.ts";

const token = Deno.env.get("TJDFT_NOTION_TOKEN")?.trim();
if (!token) {
  throw new Error("TJDFT_NOTION_TOKEN não configurado no GitHub Actions.");
}

const outputPath = "public/data/tjdft-snapshot.json";

function stableSnapshotFingerprint(value: Record<string, any> | null) {
  if (!value) return null;
  return JSON.stringify(value, (key, item) => {
    if (key === "synced_at" || key === "component_synced_at" || key === "as_of") return undefined;
    return item;
  });
}
let existing: Record<string, any> | null = null;
try {
  existing = JSON.parse(await Deno.readTextFile(outputPath));
} catch {
  // O primeiro snapshot será criado abaixo.
}

const snapshot = await buildSnapshot(token);
if (!snapshot?.source?.content_hash) {
  throw new Error("O snapshot gerado não tem content_hash e não será publicado.");
}

snapshot.source = {
  ...snapshot.source,
  status: snapshot.source.status === "partial" ? "partial" : "synced",
};
snapshot.notice = snapshot.source.status === "partial"
  ? snapshot.notice || "Snapshot parcial: alguns componentes operacionais não foram atualizados pelo Notion."
  : "Snapshot validado a partir do Notion privado e publicado pelo GitHub.";

if (stableSnapshotFingerprint(existing) === stableSnapshotFingerprint(snapshot)) {
  console.log("Nenhuma alteração material detectada no snapshot TJDFT.");
  Deno.exit(0);
}

await Deno.writeTextFile(outputPath, JSON.stringify(snapshot, null, 2) + "\n");
console.log("Snapshot TJDFT atualizado no GitHub.");
console.log("content_hash:", snapshot.source.content_hash);
console.log("synced_at:", snapshot.source.synced_at);
