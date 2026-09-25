import dashboard from "@/public/data/tjdft-snapshot.json";
import portuguese from "@/public/data/portugues-rlm.json";
import laws from "@/public/data/leis-primeiro.json";
import edital from "@/public/data/tjdft-edital.json";
import { buildTJDFTIntelligence } from "./intelligence/tjdft-intelligence.mjs";
import type { HomeIntelligenceState, StudyOsClientSeed } from "./intelligence/home-types";

export function getStudyOsModel() {
  return buildTJDFTIntelligence({ dashboard, portuguese, laws, edital });
}

export function getStudyOsHomeData(): { initialHomeState: HomeIntelligenceState; intelligenceSeed: StudyOsClientSeed } {
  const model = getStudyOsModel();
  return {
    initialHomeState: {
      nextAction: {
        kind: model.nextAction.kind,
        label: model.nextAction.label,
        code: model.nextAction.code ?? null,
        title: model.nextAction.title,
        href: model.nextAction.href ?? null,
        reason: model.nextAction.reason,
        confidence: model.nextAction.confidence,
        impact: model.nextAction.impact,
      },
      evidenceLabel: model.execution.evidence.label,
      sequenceValid: model.sequence.valid,
    },
    intelligenceSeed: {
      portuguese: {
        sequence: portuguese.sequence,
        units: portuguese.units.map((unit) => ({
          code: unit.code,
          title: unit.title,
          canonical_order: unit.canonical_order,
          material_ready: unit.material_ready ?? null,
        })),
      },
    },
  };
}
