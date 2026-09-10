import { buildSnapshot } from "./index.ts";

const token = Deno.env.get("TJDFT_NOTION_TOKEN")?.trim();
if (!token) {
  throw new Error("TJDFT_NOTION_TOKEN não configurado no GitHub Actions.");
}

const outputPath = "public/data/tjdft-snapshot.json";
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
  status: "synced",
};
snapshot.notice = "Snapshot validado a partir do Notion privado e publicado pelo GitHub.";

if (
  existing?.source?.content_hash === snapshot.source.content_hash &&
  existing?.source?.status === "synced" &&
  existing?.notice === snapshot.notice
) {
  console.log("Nenhuma alteração editorial detectada no Notion.");
  Deno.exit(0);
}

await Deno.writeTextFile(outputPath, JSON.stringify(snapshot, null, 2) + "\n");
console.log("Snapshot TJDFT atualizado no GitHub.");
console.log("content_hash:", snapshot.source.content_hash);
console.log("synced_at:", snapshot.source.synced_at);
