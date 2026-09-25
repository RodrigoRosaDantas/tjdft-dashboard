export type HomeAction = {
  kind: string;
  label: string;
  code: string | null;
  title: string;
  href: string | null;
  reason: string;
  confidence: string;
  impact: string;
};

export type HomeIntelligenceState = {
  nextAction: HomeAction;
  evidenceLabel: string;
  sequenceValid: boolean;
};

export type StudyOsClientSeed = {
  portuguese: {
    sequence: string[];
    units: Array<{
      code: string;
      title: string;
      canonical_order: number;
      material_ready: boolean | null;
    }>; 
  };
};
