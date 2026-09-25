export const SNAPSHOT_COMPONENTS = ["materials", "execution", "operational"] as const;

export type SnapshotComponent = typeof SNAPSHOT_COMPONENTS[number];
export type ComponentSource = "notion" | "snapshot" | "mixed" | "partial" | "unavailable";
export type ComponentSources = Record<SnapshotComponent, ComponentSource>;

const COMPONENT_LABELS: Record<SnapshotComponent, string> = {
  materials: "materiais",
  execution: "execução e desempenho",
  operational: "trilha, revisões e erros",
};

const SOURCE_LABELS: Record<ComponentSource, string> = {
  notion: "Notion",
  snapshot: "snapshot anterior do GitHub",
  mixed: "dados mistos do Notion e do snapshot anterior",
  partial: "leitura parcial no Notion",
  unavailable: "indisponível",
};

export function resolveSnapshotProvenance(componentSources: ComponentSources) {
  const partialComponents = SNAPSHOT_COMPONENTS.filter((component) => componentSources[component] !== "notion");
  const status = partialComponents.length ? "partial" : "live";
  const notice = partialComponents.length
    ? "Snapshot parcialmente atualizado. " + partialComponents
      .map((component) => `${COMPONENT_LABELS[component]}: ${SOURCE_LABELS[componentSources[component]]}`)
      .join("; ") + ". Confira a sincronização antes de tratar essas métricas como atuais."
    : "Dados consultados diretamente no Notion. O snapshot público contém apenas informações operacionais sanitizadas.";

  return { status, component_sources: { ...componentSources }, partial_components: partialComponents, notice };
}
