import { resolveSnapshotProvenance, type ComponentSources } from "./provenance.ts";

Deno.test("origem íntegra só é live quando os componentes vieram do Notion", () => {
  const components: ComponentSources = {
    materials: "notion",
    execution: "notion",
    operational: "notion",
  };
  const result = resolveSnapshotProvenance(components);
  if (result.status !== "live") throw new Error("Esperava status live para dados integralmente consultados no Notion.");
  if (result.partial_components.length !== 0) throw new Error("Snapshot integral não pode listar componentes parciais.");
});

Deno.test("reutilização e ausência de componentes são expostas como snapshot parcial", () => {
  const components: ComponentSources = {
    materials: "mixed",
    execution: "snapshot",
    operational: "unavailable",
  };
  const result = resolveSnapshotProvenance(components);
  if (result.status !== "partial") throw new Error("Fallback ou componente ausente não pode ser marcado live.");
  if (JSON.stringify(result.partial_components) !== JSON.stringify(["materials", "execution", "operational"])) {
    throw new Error("Os componentes degradados precisam permanecer identificáveis.");
  }
  if (!/snapshot anterior do GitHub/.test(result.notice) || !/indisponível/.test(result.notice)) {
    throw new Error("O aviso precisa explicar fallback e ausência de dados.");
  }
});
