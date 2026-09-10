"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileCheck2,
  FileText,
  GraduationCap,
  Layers3,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Route,
  Target,
  TimerReset,
  TrendingUp,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type SectionId = "inicio" | "estudar" | "fases" | "cargos" | "progresso" | "materiais";
type MaterialsTone = "gold" | "teal" | "violet" | "coral";
type MaterialsView = "c01" | "legislation" | "sequence" | "future";

type StudyMaterial = {
  day: string;
  title: string;
  detail: string;
  meta: string;
  href: string;
  tone: MaterialsTone;
};

type LegislationItem = {
  day: string;
  title: string;
  detail: string;
  status: string;
  tone: MaterialsTone;
  links: Array<{ label: string; href: string }>;
};

type MaterialPreview = {
  label: string;
  title: string;
  detail: string;
  meta: string;
  href: string;
  tone: MaterialsTone;
  legislation?: LegislationItem;
};

type FutureMaterial = {
  label: string;
  detail: string;
};

type SequenceMaterial = {
  code: string;
  order: number;
  title: string;
  group: string;
  detail: string;
  href: string;
};

type MaterialsSnapshot = {
  source_url: string;
  last_edited_time: string | null;
  days: StudyMaterial[];
  legislation?: LegislationItem[];
  future: FutureMaterial[];
  sequence?: SequenceMaterial[];
};

type ExecutionDay = {
  day: string;
  title: string;
  status: string;
  type: string;
  order: number;
  planned: number;
  done: number;
  correct: number;
  errors: number;
  doubts: number;
  minutes: number;
  precision: number | null;
  progress: number;
  href: string;
  executed_at: string | null;
};

type ExecutionTotals = {
  planned: number;
  fixed_meta: number;
  done: number;
  correct: number;
  errors: number;
  doubts: number;
  minutes: number;
  precision: number | null;
  progress: number;
};

type SubjectExecution = {
  subject: string;
  planned: number;
  done: number;
  correct: number;
  errors: number;
  doubts: number;
  precision: number | null;
  rows: number;
};

type ExecutionSnapshot = {
  as_of: string;
  c01: {
    days: ExecutionDay[];
    totals: ExecutionTotals;
    subjects: SubjectExecution[];
    statuses: Record<string, number>;
    active_day: string | null;
    error_count: number;
    question_rows: number;
  };
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
  materials?: MaterialsSnapshot | null;
  execution?: ExecutionSnapshot | null;
  notice?: string;
};

const LIVE_NOTION_API_URL = "https://ugxdmvlynyzfmmgshvyq.supabase.co/functions/v1/tjdft-notion";
// Public Supabase anon key: it gates the read-only function; the Notion token never reaches the browser.
const LIVE_NOTION_API_KEY = "sb_publishable_acJ3KnWmZLidHTFhtTGYUw_RkYu39ca";
let activeDashboardSnapshot: DashboardSnapshot | null = null;

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

function formatSnapshotDate(value: string | null) {
  if (!value) return "aguardando sincronização";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "aguardando sincronização";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function formatMaterialsAudit(value: string | null) {
  if (!value) return "LEITURA LEGISLATIVA · AUDITORIA 10/09/2026";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "LEITURA LEGISLATIVA · AUDITORIA 10/09/2026";
  return `LEITURA LEGISLATIVA · NOTION ATUALIZADO ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date)}`;
}

function formatExecutionPercent(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : `${Math.round(value * 100)}%`;
}

function formatExecutionMinutes(value: number, done: number) {
  if (!value || !done) return "—";
  return `${Math.round(value / done)} min`;
}

const navigation: Array<{ id: SectionId; label: string; icon: LucideIcon }> = [
  { id: "inicio", label: "Visão geral", icon: LayoutDashboard },
  { id: "estudar", label: "Estudar hoje", icon: BookOpen },
  { id: "fases", label: "Fases e ciclos", icon: Route },
  { id: "cargos", label: "Cargos-meta", icon: GraduationCap },
  { id: "progresso", label: "Progresso", icon: BarChart3 },
  { id: "materiais", label: "Materiais", icon: FileText },
];

const jobs = [
  {
    "code": "T",
    "title": "Técnico Judiciário",
    "subtitle": "Área Administrativa — sem especialidade",
    "priority": "Trilha principal",
    "tone": "gold",
    "source": "Edital nº 01/2022 + Manual de Descrição de Cargos"
  },
  {
    "code": "A",
    "title": "Analista Judiciário",
    "subtitle": "Apoio Especializado — Administração",
    "priority": "Trilha própria",
    "tone": "violet",
    "source": "Edital nº 01/2022 + Manual de Descrição de Cargos"
  }
];

const workload = [
  {
    "label": "Núcleo comum",
    "blocks": 14,
    "questions": 124,
    "tone": "gold"
  },
  {
    "label": "Técnico específico",
    "blocks": 5,
    "questions": 0,
    "tone": "teal"
  },
  {
    "label": "Analista específico",
    "blocks": 7,
    "questions": 0,
    "tone": "violet"
  },
  {
    "label": "Execução real",
    "blocks": 0,
    "questions": 0,
    "tone": "slate"
  }
];

const dayRows = [
  {
    "day": "D01",
    "label": "Português: interpretação e coesão + Regimento I",
    "detail": "Próxima ação",
    "state": "next",
    "meta": "8 C/E"
  },
  {
    "day": "D02",
    "label": "Português: sintaxe e concordância + Ética I",
    "detail": "Aguardando execução",
    "state": "ready",
    "meta": "8 C/E"
  },
  {
    "day": "D03",
    "label": "Português: regência e crase + Lei nº 11.697 I",
    "detail": "Aguardando execução",
    "state": "ready",
    "meta": "8 C/E"
  },
  {
    "day": "D04",
    "label": "Português: pontuação e reescrita + Regimento II",
    "detail": "Aguardando execução",
    "state": "ready",
    "meta": "8 C/E"
  },
  {
    "day": "D05",
    "label": "Português: semântica/morfologia + Ética II",
    "detail": "Aguardando execução",
    "state": "ready",
    "meta": "8 C/E"
  },
  {
    "day": "D06",
    "label": "Leitura textual + Lei nº 11.697 II",
    "detail": "Aguardando execução",
    "state": "ready",
    "meta": "8 C/E"
  },
  {
    "day": "D07",
    "label": "Checkpoint 1 | D01–D06",
    "detail": "Revisão adaptativa pelos resultados reais",
    "state": "adaptive",
    "meta": "12 C/E · checkpoint"
  },
  {
    "day": "D08",
    "label": "Português: colocação pronominal + Regimento III",
    "detail": "Aguardando execução",
    "state": "ready",
    "meta": "8 C/E"
  },
  {
    "day": "D09",
    "label": "Português: paralelismo + Ética III",
    "detail": "Aguardando execução",
    "state": "ready",
    "meta": "8 C/E"
  },
  {
    "day": "D10",
    "label": "Português integrado + Lei nº 11.697 III",
    "detail": "Aguardando execução",
    "state": "ready",
    "meta": "8 C/E"
  },
  {
    "day": "D11",
    "label": "Português: subordinação + Regimento IV",
    "detail": "Aguardando execução",
    "state": "ready",
    "meta": "8 C/E"
  },
  {
    "day": "D12",
    "label": "Português: semântica fina + Ética IV",
    "detail": "Aguardando execução",
    "state": "ready",
    "meta": "8 C/E"
  },
  {
    "day": "D13",
    "label": "Integração do núcleo comum + pegadinhas",
    "detail": "Aguardando execução",
    "state": "ready",
    "meta": "10 C/E"
  },
  {
    "day": "D14",
    "label": "Checkpoint final | Fechamento CTJ-002",
    "detail": "Bateria integrada após D01–D13",
    "state": "adaptive",
    "meta": "14 C/E · checkpoint"
  }
];

const sources = [
  {
    "title": "Central de Comando TJDFT",
    "detail": "Ciclo, fila diária, registros e regra de avanço.",
    "tag": "CENTRAL",
    "href": "https://app.notion.com/p/3d5cf5a2673181aa8acbebd128dada89?pvs=204"
  },
  {
    "title": "Legislação e materiais",
    "detail": "D01–D14, Regimento, Ética e Lei nº 11.697.",
    "tag": "BASE",
    "href": "https://app.notion.com/p/3d5cf5a267318119924bebf5bf243d0d?pvs=204"
  },
  {
    "title": "Edital-base e cargos",
    "detail": "Edital nº 01/2022, cargos-meta e trilhas específicas.",
    "tag": "CARGOS",
    "href": "https://app.notion.com/p/3d5cf5a2673181ab902bd1dd84e2b85a?pvs=204"
  },
  {
    "title": "Bancos de questões",
    "detail": "Registro de questões, erros, dúvidas e checkpoints sem fabricar desempenho.",
    "tag": "EXECUÇÃO",
    "href": "https://app.notion.com/p/3d5cf5a267318140ab1af8a2c870e9e2?pvs=204"
  },
  {
    "title": "Portal oficial do concurso",
    "detail": "Página oficial do TJDFT e banca organizadora.",
    "tag": "OFICIAL",
    "href": "https://www.tjdft.jus.br/informacoes/concursos/analista-e-tecnico-judiciario"
  }
];

const notionMaterialsPage = "https://app.notion.com/p/3d5cf5a267318119924bebf5bf243d0d?pvs=204";
const notionSequentialMaterialsPage = "https://app.notion.com/p/3d5cf5a26731811aaf70ea6e75d78dad?pvs=204";
const notionExecutionPage = "https://app.notion.com/p/3d5cf5a26731811e9584e8841d7e4786?pvs=204";
const d01NotionPage = "https://app.notion.com/p/3d6cf5a267318173814ff0d8b20134e5?pvs=204";
const regimentoOfficialUrl = "https://www.tjdft.jus.br/publicacoes/regimentos/regimento-interno-do-tjdft/regimento-interno-do-tjdft";
const studyMaterials: StudyMaterial[] = [
  {
    "day": "D01",
    "title": "Português: interpretação e coesão + Regimento I",
    "detail": "Interpretação, coesão e arts. 1º–6º do Regimento Interno.",
    "meta": "8 C/E · 75–90 min",
    "href": "https://app.notion.com/p/3d6cf5a267318173814ff0d8b20134e5?pvs=204",
    "tone": "gold"
  },
  {
    "day": "D02",
    "title": "Português: sintaxe e concordância + Ética I",
    "detail": "Sintaxe, concordância e princípios iniciais do Código de Ética.",
    "meta": "8 C/E · 75–90 min",
    "href": "https://app.notion.com/p/3d6cf5a267318120a2b7c7d428443d70?pvs=204",
    "tone": "teal"
  },
  {
    "day": "D03",
    "title": "Português: regência e crase + Lei nº 11.697 I",
    "detail": "Regência, crase e primeiro recorte da Lei nº 11.697/2008.",
    "meta": "8 C/E · 75–90 min",
    "href": "https://app.notion.com/p/3d6cf5a26731813da04cd4acf2140130?pvs=204",
    "tone": "violet"
  },
  {
    "day": "D04",
    "title": "Português: pontuação e reescrita + Regimento II",
    "detail": "Pontuação, reescrita e segundo recorte do Regimento Interno.",
    "meta": "8 C/E · 75–90 min",
    "href": "https://app.notion.com/p/3d6cf5a2673181b28359e10ab19b127c?pvs=204",
    "tone": "teal"
  },
  {
    "day": "D05",
    "title": "Português: semântica/morfologia + Ética II",
    "detail": "Semântica, morfologia e segundo recorte do Código de Ética.",
    "meta": "8 C/E · 75–90 min",
    "href": "https://app.notion.com/p/3d6cf5a2673181068af7cf059adbf978?pvs=204",
    "tone": "coral"
  },
  {
    "day": "D06",
    "title": "Leitura textual + Lei nº 11.697 II",
    "detail": "Leitura textual e segundo recorte da Lei nº 11.697/2008.",
    "meta": "8 C/E · 75–90 min",
    "href": "https://app.notion.com/p/3d6cf5a267318190a832f95dc70e9fc4?pvs=204",
    "tone": "violet"
  },
  {
    "day": "D07",
    "title": "Checkpoint 1 | D01–D06",
    "detail": "Recalibração por erros e dúvidas dos seis primeiros dias.",
    "meta": "12 C/E · checkpoint",
    "href": "https://app.notion.com/p/3d6cf5a267318132a688ceb3809f46d9?pvs=204",
    "tone": "violet"
  },
  {
    "day": "D08",
    "title": "Português: colocação pronominal + Regimento III",
    "detail": "Colocação pronominal e terceiro recorte do Regimento Interno.",
    "meta": "8 C/E · 75–90 min",
    "href": "https://app.notion.com/p/3d6cf5a2673181fcb48eda2da1aaadce?pvs=204",
    "tone": "teal"
  },
  {
    "day": "D09",
    "title": "Português: paralelismo + Ética III",
    "detail": "Paralelismo e terceiro recorte do Código de Ética.",
    "meta": "8 C/E · 75–90 min",
    "href": "https://app.notion.com/p/3d6cf5a26731810aa8ffef40a06db715?pvs=204",
    "tone": "teal"
  },
  {
    "day": "D10",
    "title": "Português integrado + Lei nº 11.697 III",
    "detail": "Português integrado e terceiro recorte da Lei nº 11.697/2008.",
    "meta": "8 C/E · 75–90 min",
    "href": "https://app.notion.com/p/3d6cf5a26731819abd3dd678fcab2eda?pvs=204",
    "tone": "coral"
  },
  {
    "day": "D11",
    "title": "Português: subordinação + Regimento IV",
    "detail": "Subordinação e quarto recorte do Regimento Interno.",
    "meta": "8 C/E · 75–90 min",
    "href": "https://app.notion.com/p/3d6cf5a267318121a66bd998b33488f9?pvs=204",
    "tone": "gold"
  },
  {
    "day": "D12",
    "title": "Português: semântica fina + Ética IV",
    "detail": "Semântica fina e quarto recorte do Código de Ética.",
    "meta": "8 C/E · 75–90 min",
    "href": "https://app.notion.com/p/3d6cf5a2673181f9bc63ef40762fa0fe?pvs=204",
    "tone": "teal"
  },
  {
    "day": "D13",
    "title": "Integração do núcleo comum + pegadinhas",
    "detail": "Integração do núcleo comum e resolução de pegadinhas.",
    "meta": "10 C/E · 75–90 min",
    "href": "https://app.notion.com/p/3d6cf5a26731810c87d6e8e94176eaf8?pvs=204",
    "tone": "coral"
  },
  {
    "day": "D14",
    "title": "Checkpoint final | Fechamento CTJ-002",
    "detail": "Fechamento do CTJ-002 com bateria integrada.",
    "meta": "14 C/E · checkpoint",
    "href": "https://app.notion.com/p/3d6cf5a26731817fa254e7b6c895a77c?pvs=204",
    "tone": "violet"
  }
];

const legislationPlan: LegislationItem[] = [
  {
    "day": "D01",
    "title": "Regimento Interno do TJDFT — arts. 1º–6º",
    "detail": "Leitura seca do recorte indicado no D01; conectar organização, competências e estrutura inicial.",
    "status": "Leitura obrigatória",
    "tone": "gold",
    "links": [
      {
        "label": "Regimento oficial",
        "href": "https://www.tjdft.jus.br/publicacoes/regimentos/regimento-interno-do-tjdft/regimento-interno-do-tjdft"
      }
    ]
  },
  {
    "day": "D02",
    "title": "Código de Ética — fundamentos",
    "detail": "Resolução Pleno nº 6/2022: princípios, deveres e condutas esperadas no serviço judiciário.",
    "status": "Leitura obrigatória",
    "tone": "teal",
    "links": [
      {
        "label": "Resolução nº 6/2022",
        "href": "https://www.tjdft.jus.br/publicacoes/publicacoes-oficiais/resolucoes-do-pleno/2022/resolucao-6-de-19-04-2022"
      }
    ]
  },
  {
    "day": "D03",
    "title": "Lei nº 11.697/2008 — organização judiciária I",
    "detail": "Primeiro recorte da Lei de Organização Judiciária do Distrito Federal e dos Territórios.",
    "status": "Leitura obrigatória",
    "tone": "violet",
    "links": [
      {
        "label": "Lei nº 11.697/2008",
        "href": "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2008/lei/l11697.htm"
      }
    ]
  },
  {
    "day": "D04",
    "title": "Regimento Interno do TJDFT — recorte II",
    "detail": "Avanço conforme o roteiro do ciclo; priorizar competências e funcionamento.",
    "status": "Leitura obrigatória",
    "tone": "teal",
    "links": [
      {
        "label": "Regimento oficial",
        "href": "https://www.tjdft.jus.br/publicacoes/regimentos/regimento-interno-do-tjdft/regimento-interno-do-tjdft"
      }
    ]
  },
  {
    "day": "D05",
    "title": "Código de Ética — recorte II",
    "detail": "Revisar deveres, vedações e situações práticas indicadas no material do dia.",
    "status": "Leitura obrigatória",
    "tone": "coral",
    "links": [
      {
        "label": "Resolução nº 6/2022",
        "href": "https://www.tjdft.jus.br/publicacoes/publicacoes-oficiais/resolucoes-do-pleno/2022/resolucao-6-de-19-04-2022"
      }
    ]
  },
  {
    "day": "D06",
    "title": "Lei nº 11.697/2008 — organização judiciária II",
    "detail": "Segundo recorte da lei, com atenção à estrutura e às competências do Tribunal.",
    "status": "Leitura obrigatória",
    "tone": "violet",
    "links": [
      {
        "label": "Lei nº 11.697/2008",
        "href": "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2008/lei/l11697.htm"
      }
    ]
  },
  {
    "day": "D07",
    "title": "Checkpoint 1 — legislação pelos erros",
    "detail": "Reabrir somente artigos, dúvidas e erros registrados em D01–D06.",
    "status": "Revisão pelos dados",
    "tone": "violet",
    "links": []
  },
  {
    "day": "D08",
    "title": "Regimento Interno — recorte III",
    "detail": "Continuar a leitura do Regimento no recorte previsto e transformar pontos finos em questões.",
    "status": "Leitura obrigatória",
    "tone": "teal",
    "links": [
      {
        "label": "Regimento oficial",
        "href": "https://www.tjdft.jus.br/publicacoes/regimentos/regimento-interno-do-tjdft/regimento-interno-do-tjdft"
      }
    ]
  },
  {
    "day": "D09",
    "title": "Código de Ética — recorte III",
    "detail": "Consolidar princípios e deveres em itens de certo/errado.",
    "status": "Leitura obrigatória",
    "tone": "teal",
    "links": [
      {
        "label": "Resolução nº 6/2022",
        "href": "https://www.tjdft.jus.br/publicacoes/publicacoes-oficiais/resolucoes-do-pleno/2022/resolucao-6-de-19-04-2022"
      }
    ]
  },
  {
    "day": "D10",
    "title": "Lei nº 11.697/2008 — organização judiciária III",
    "detail": "Terceiro recorte da lei e integração com as questões do núcleo comum.",
    "status": "Leitura obrigatória",
    "tone": "coral",
    "links": [
      {
        "label": "Lei nº 11.697/2008",
        "href": "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2008/lei/l11697.htm"
      }
    ]
  },
  {
    "day": "D11",
    "title": "Regimento Interno — recorte IV",
    "detail": "Fechar o roteiro principal do Regimento e registrar dúvidas residuais.",
    "status": "Leitura obrigatória",
    "tone": "gold",
    "links": [
      {
        "label": "Regimento oficial",
        "href": "https://www.tjdft.jus.br/publicacoes/regimentos/regimento-interno-do-tjdft/regimento-interno-do-tjdft"
      }
    ]
  },
  {
    "day": "D12",
    "title": "Código de Ética — recorte IV",
    "detail": "Último recorte do ciclo para ética e conduta, com foco em pegadinhas.",
    "status": "Leitura obrigatória",
    "tone": "teal",
    "links": [
      {
        "label": "Resolução nº 6/2022",
        "href": "https://www.tjdft.jus.br/publicacoes/publicacoes-oficiais/resolucoes-do-pleno/2022/resolucao-6-de-19-04-2022"
      }
    ]
  },
  {
    "day": "D13",
    "title": "Núcleo comum integrado",
    "detail": "Sem leitura nova obrigatória; consolidar Regimento, Ética e Lei nº 11.697/2008 nas pegadinhas do ciclo.",
    "status": "Integração + questões",
    "tone": "coral",
    "links": [
      {
        "label": "Regimento oficial",
        "href": "https://www.tjdft.jus.br/publicacoes/regimentos/regimento-interno-do-tjdft/regimento-interno-do-tjdft"
      },
      {
        "label": "Ética TJDFT",
        "href": "https://www.tjdft.jus.br/publicacoes/publicacoes-oficiais/resolucoes-do-pleno/2022/resolucao-6-de-19-04-2022"
      },
      {
        "label": "Lei nº 11.697/2008",
        "href": "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2008/lei/l11697.htm"
      }
    ]
  },
  {
    "day": "D14",
    "title": "Checkpoint final — fechamento CTJ-002",
    "detail": "Nenhuma lei nova; seleção orientada por erros, dúvidas, reincidências e desempenho real.",
    "status": "Checkpoint adaptativo",
    "tone": "violet",
    "links": []
  }
];

const sequentialMaterialsFallback: SequenceMaterial[] = [
  {
    "code": "TJ-MAT-01",
    "order": 1,
    "title": "Núcleo comum e fontes",
    "group": "Base TJDFT",
    "detail": "Português, Regimento, Ética e organização judiciária na base compartilhada.",
    "href": "https://app.notion.com/p/3d5cf5a2673181aa8acbebd128dada89?pvs=204"
  },
  {
    "code": "TJ-MAT-02-T",
    "order": 2,
    "title": "Trilha específica de Técnico",
    "group": "Cargo-meta",
    "detail": "Conteúdos específicos de Técnico Judiciário — Área Administrativa.",
    "href": "https://app.notion.com/p/3d5cf5a2673181ab902bd1dd84e2b85a?pvs=204"
  },
  {
    "code": "TJ-MAT-02-A",
    "order": 3,
    "title": "Trilha específica de Analista",
    "group": "Cargo-meta",
    "detail": "Conteúdos específicos de Analista Judiciário — Administração.",
    "href": "https://app.notion.com/p/3d5cf5a2673181ab902bd1dd84e2b85a?pvs=204"
  },
  {
    "code": "TJ-MAT-03",
    "order": 4,
    "title": "Legislação e atualizações",
    "group": "Fontes oficiais",
    "detail": "Regimento, Ética, Lei nº 11.697/2008 e atualizações normativas.",
    "href": "https://app.notion.com/p/3d5cf5a267318119924bebf5bf243d0d?pvs=204"
  },
  {
    "code": "TJ-MAT-04",
    "order": 5,
    "title": "Provas e gabaritos",
    "group": "Questões",
    "detail": "Bancos de questões, provas históricas e gabaritos para análise.",
    "href": "https://app.notion.com/p/3d5cf5a267318140ab1af8a2c870e9e2?pvs=204"
  },
  {
    "code": "TJ-MAT-05",
    "order": 6,
    "title": "Fichas, revisão e erros",
    "group": "Revisão",
    "detail": "Caderno de Erros, dúvidas, reincidências e checkpoints adaptativos.",
    "href": "https://app.notion.com/p/3d5cf5a2673181ea8dd0f9d326c15ef2?pvs=204"
  }
];

const futureMaterials: FutureMaterial[] = [
  {
    "label": "CTJ-002 · D01–D14",
    "detail": "Ciclo atual de núcleo comum; D01 é a primeira ação real e os demais dias aguardam registro."
  },
  {
    "label": "CTJ-T01 a CTJ-T05",
    "detail": "Cinco ciclos específicos da trilha de Técnico Judiciário."
  },
  {
    "label": "CTJ-A01 a CTJ-A07",
    "detail": "Sete ciclos específicos da trilha de Analista Judiciário — Administração."
  },
  {
    "label": "Revisões e discursiva",
    "detail": "Consolidação posterior, condicionada aos registros reais e ao edital oficial."
  }
];

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "gold" | "teal" | "violet" | "coral" }) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}

function StatCard({ icon: Icon, label, value, detail, tone }: { icon: LucideIcon; label: string; value: string; detail: string; tone: string }) {
  return (
    <article className={`stat-card stat-${tone}`}>
      <div className="stat-icon"><Icon size={18} strokeWidth={2.1} /></div>
      <div>
        <p className="eyebrow">{label}</p>
        <p className="stat-value">{value}</p>
        <p className="stat-detail">{detail}</p>
      </div>
    </article>
  );
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description && <p className="section-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function Overview({ onNavigate, snapshot }: { onNavigate: (section: SectionId) => void; snapshot: DashboardSnapshot | null }) {
  const nextAction = snapshot?.dashboard.next_action ?? "D01 · Português: interpretação e coesão + Regimento I";
  const plannedQuestions = snapshot?.dashboard.planned_questions ?? 124;
  const projectedQuestions = snapshot?.dashboard.projected_questions ?? 124;
  const executedQuestions = snapshot?.dashboard.executed_questions ?? 0;
  const verticalizedAxes = snapshot?.dashboard.verticalized_axes ?? 22;
  const jobsCount = snapshot?.dashboard.jobs ?? 2;
  const executionRate = plannedQuestions > 0 ? Math.round((executedQuestions / plannedQuestions) * 100) : 0;
  return (
    <>
      <section className="hero-grid">
        <div className="hero-card">
          <div className="hero-kicker"><span className="live-dot" /> Fase 1 ativa · CTJ-002 liberado</div>
          <h1>O próximo passo está definido.</h1>
          <p className="hero-copy">Comece pelo D01 e transforme o plano TJDFT em execução real. O painel acompanha o que foi estudado, não o que ficou bonito na planilha.</p>
          <div className="hero-action-row">
            <button className="primary-button" onClick={() => onNavigate("estudar")}>Abrir D01 <ArrowRight size={17} /></button>
            <span className="hero-note"><Clock3 size={15} /> Dias efetivamente estudados</span>
          </div>
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
        </div>
        <div className="focus-card">
          <div className="focus-topline"><span>FOCO DE HOJE</span><StatusPill tone="gold">D01</StatusPill></div>
          <h3>{nextAction}</h3>
          <p>Primeira unidade de execução do CTJ-002. Teoria curta, questões registradas no banco TJDFT e fechamento do dia.</p>
          <div className="focus-rule" />
          <div className="focus-meta"><span><Target size={15} /> Meta inicial</span><strong>8 C/E</strong></div>
          <div className="focus-meta"><span><TimerReset size={15} /> Estado</span><strong>Próximo</strong></div>
        </div>
      </section>

      <section className="stats-grid" aria-label="Resumo do projeto">
        <StatCard icon={Layers3} label="Eixos verticalizados" value={String(verticalizedAxes)} detail="Eixos organizados por cargo e matéria" tone="blue" />
        <StatCard icon={Target} label="Carga fixa do CTJ-002" value={String(plannedQuestions)} detail="Questões sincronizadas do Notion" tone="gold" />
        <StatCard icon={TrendingUp} label="Projeção do CTJ-002" value={`≈ ${projectedQuestions}`} detail="Inclui checkpoints adaptativos" tone="teal" />
        <StatCard icon={GraduationCap} label="Cargos-meta" value={String(jobsCount)} detail="Técnico + Analista" tone="violet" />
      </section>

      <section className="content-grid two-thirds">
        <div className="panel workload-panel">
          <SectionHeading eyebrow="CTJ-002 · SNAPSHOT PRÉ-EXECUÇÃO" title="Onde a energia deve entrar" description="A carga abaixo é planejamento. Ela ainda não é desempenho." action={<StatusPill>{executionRate}% executado</StatusPill>} />
          <div className="workload-list">
            {workload.map((item) => <div className="workload-row" key={item.label}><div className="workload-label"><span className={`workload-dot dot-${item.tone}`} /><strong>{item.label}</strong><span>{item.blocks} blocos</span></div><div className="workload-track"><span className={`workload-fill fill-${item.tone}`} style={{ width: `${item.questions ? Math.max(6, (item.questions / Math.max(1, plannedQuestions)) * 100) : 0}%` }} /></div><strong className="workload-number">{item.questions}</strong></div>)}
          </div>
          <div className="panel-footnote"><CircleAlert size={15} /> Os números só mudam quando você registra questões feitas, acertos, erros e dúvidas no banco detalhado.</div>
        </div>

        <div className="panel integrity-panel">
          <SectionHeading eyebrow="GOVERNANÇA" title="Fonte sob controle" />
          <div className="integrity-status"><span className="check-mark"><Check size={15} /></span><div><strong>Projeto segregado</strong><p>TJDFT não compartilha métricas com outros projetos.</p></div></div>
          <div className="integrity-status"><span className="check-mark"><Check size={15} /></span><div><strong>Fonte operacional</strong><p>Notion TJDFT é a referência; o site é a camada de acompanhamento.</p></div></div>
          <div className="integrity-status"><span className="check-mark"><Check size={15} /></span><div><strong>Sem progresso artificial</strong><p>O painel começa em zero até a primeira sessão real.</p></div></div>
          <button className="text-button" onClick={() => onNavigate("materiais")}>Ver fontes do projeto <ChevronRight size={16} /></button>
        </div>
      </section>

      <section className="panel cycle-panel">
        <SectionHeading eyebrow="ROADMAP" title="Fase 1 · Construção e consolidação" description="CTJ-002 organiza 14 dias lógicos; os ciclos específicos de cada cargo entram na sequência." action={<button className="text-button" onClick={() => onNavigate("fases")}>Abrir fases <ChevronRight size={16} /></button>} />
        <div className="phase-rail"><div className="phase-rail-line" />{["CTJ-002", "CTJ-T01", "CTJ-A01", "Pós-edital"].map((cycle, index) => <div className={`phase-node ${index === 0 ? "phase-active" : "phase-locked"}`} key={cycle}><span className="phase-node-circle">{index === 0 ? <Check size={15} /> : index + 1}</span><strong>{cycle}</strong><span>{index === 0 ? "Ativo · D01" : "Bloqueado pela sequência"}</span></div>)}</div>
      </section>

      <section className="content-grid jobs-grid">
        <div className="panel jobs-panel">
          <SectionHeading eyebrow="CARGOS-META" title="Uma preparação, duas trilhas" description="O núcleo comum sustenta as duas trilhas; o peso de cada cargo continua separado." action={<button className="text-button" onClick={() => onNavigate("cargos")}>Detalhar cargos <ChevronRight size={16} /></button>} />
          <div className="job-cards">{jobs.map((job) => <JobCard job={job} key={job.code} compact />)}</div>
        </div>
        <div className="panel no-data-panel"><div className="empty-icon"><BarChart3 size={22} /></div><p className="eyebrow">DESEMPENHO TJDFT</p><h3>Ainda não há desempenho executado.</h3><p>Isso é correto: o CTJ-002 está preparado, mas o diagnóstico deve nascer das suas próprias sessões.</p><button className="secondary-button" onClick={() => onNavigate("estudar")}>Começar D01 <ArrowRight size={16} /></button></div>
      </section>
    </>
  );
}

function JobCard({ job, compact = false }: { job: typeof jobs[number]; compact?: boolean }) {
  return <article className={`job-card job-${job.tone} ${compact ? "job-compact" : ""}`}><div className="job-code">{job.code}</div><div className="job-content"><div className="job-title-row"><h3>{job.title}</h3><StatusPill tone={job.tone === "gold" ? "gold" : job.tone === "teal" ? "teal" : "violet"}>{job.priority}</StatusPill></div><strong>{job.subtitle}</strong><p>{job.source}</p></div>{!compact && <div className="job-metrics"><span>Domínio inicial</span><strong>Em diagnóstico</strong></div>}</article>;
}

function StudyToday() {
  const [checked, setChecked] = useState<string[]>([]);
  const [sessionStarted, setSessionStarted] = useState(false);
  const checklist = [{ id: "portugues", label: "Executar Português", detail: "Interpretação, coesão e resolução orientada" }, { id: "regimento", label: "Ler o Regimento no recorte do dia", detail: "Leitura seca com marcação de conceitos" }, { id: "questoes", label: "Registrar questões e resultado", detail: "Feitas, acertos, erros e dúvidas" }, { id: "fechamento", label: "Fechar o D01", detail: "Só avançar quando todas as linhas estiverem corrigidas" }];
  const progress = Math.round((checked.length / checklist.length) * 100);
  return <div className="inner-page"><section className="page-intro"><div><p className="eyebrow">EXECUÇÃO DIÁRIA · TJDFT</p><h1>D01 · Português: interpretação e coesão + Regimento I</h1><p>O primeiro dia não precisa ser perfeito. Precisa ser registrado.</p></div><StatusPill tone="gold">Próximo</StatusPill></section><section className="content-grid two-thirds study-layout"><div className="panel study-main-panel"><div className="study-progress-head"><div><p className="eyebrow">CHECKLIST DE EXECUÇÃO</p><h2>Feche o dia na ordem certa</h2></div><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><div className="checklist">{checklist.map((item) => { const isChecked = checked.includes(item.id); return <button className={`check-row ${isChecked ? "is-checked" : ""}`} key={item.id} onClick={() => setChecked((current) => isChecked ? current.filter((id) => id !== item.id) : [...current, item.id])}><span className="checkbox">{isChecked && <Check size={14} />}</span><span className="check-copy"><strong>{item.label}</strong><small>{item.detail}</small></span><ChevronRight size={17} /></button>; })}</div><div className="study-actions"><button className="primary-button" onClick={() => setSessionStarted((value) => !value)}>{sessionStarted ? "Pausar sessão" : "Iniciar sessão"}<TimerReset size={16} /></button><span>{sessionStarted ? "Sessão em andamento neste dispositivo" : "O cronômetro real entra na execução"}</span></div><div className="study-source-links"><p className="eyebrow">MATERIAL DO DIA</p><div><a className="resource-link" href={d01NotionPage} target="_blank" rel="noreferrer">Abrir D01 completo no Notion <ArrowRight size={15} /></a><a className="resource-link" href={regimentoOfficialUrl} target="_blank" rel="noreferrer">Abrir Regimento oficial <ArrowRight size={15} /></a></div></div></div><aside className="panel day-rule-panel"><div className="day-badge">D01</div><p className="eyebrow">REGRA DO DIA</p><h3>Estude, registre, feche.</h3><p>O Banco de Dias agrega os números a partir das linhas detalhadas do Banco de Controle de Questões. Não lance os totais duas vezes.</p><div className="rule-list"><div><Check size={15} /> Dias não estudados não viram atraso.</div><div><Check size={15} /> D07 só nasce dos resultados de D01–D06.</div><div><Check size={15} /> O site não cria desempenho sem dado real.</div></div></aside></section><section className="panel next-days-panel"><SectionHeading eyebrow="SEQUÊNCIA" title="O CTJ-002 já está preparado" description="Os próximos dias permanecem não iniciados até a execução real." /><div className="day-strip">{dayRows.slice(0, 7).map((row) => <DayCard row={row} key={row.day} />)}</div></section></div>;
}

function DayCard({ row }: { row: typeof dayRows[number] }) {
  return <article className={`day-card day-${row.state}`}><div className="day-card-top"><strong>{row.day}</strong><span className="day-state-dot" /></div><h3>{row.label}</h3><p>{row.detail}</p><span>{row.meta}</span></article>;
}

function Phases() {
  const phases = [
    { name: "Fase 1", title: "Núcleo comum pré-edital", detail: "CTJ-002 · 14 dias lógicos, D01–D14", status: "Ativa · CTJ-002", tone: "active" },
    { name: "Fase 2", title: "Trilhas específicas por cargo", detail: "CTJ-T01–CTJ-T05 e CTJ-A01–CTJ-A07", status: "Bloqueada pela sequência", tone: "locked" },
    { name: "Fase 3", title: "Consolidação e pós-edital", detail: "Revisões, discursiva e adaptação ao edital oficial", status: "Aguardando gatilho", tone: "waiting" },
  ];
  return <div className="inner-page"><section className="page-intro"><div><p className="eyebrow">ARQUITETURA DE PREPARAÇÃO</p><h1>Fases e ciclos sem calendário artificial</h1><p>A unidade de avanço é o dia efetivamente estudado. Pausa suspende a sequência; não cria dívida.</p></div><StatusPill tone="teal">Fase 1 ativa</StatusPill></section><section className="panel roadmap-large"><SectionHeading eyebrow="ROADMAP OFICIAL" title="Três fases, um gatilho superior" description="O edital publicado interrompe a lógica pré-edital e passa a comandar o projeto." /><div className="phase-table">{phases.map((phase, index) => <div className={`phase-table-row ${phase.tone}`} key={phase.name}><div className="phase-number">0{index + 1}</div><div><p className="eyebrow">{phase.name}</p><h3>{phase.title}</h3><p>{phase.detail}</p></div><StatusPill tone={phase.tone === "active" ? "teal" : "neutral"}>{phase.status}</StatusPill></div>)}</div></section><section className="panel cycle-detail-panel"><SectionHeading eyebrow="CTJ-002" title="14 dias lógicos de estudo" description="D01 está liberado. D02–D06 e D08–D13 estão preparados. D07 e D14 dependem dos resultados reais." /><div className="day-grid">{dayRows.map((row) => <DayCard row={row} key={row.day} />)}</div></section></div>;
}

function Jobs() {
  return <div className="inner-page"><section className="page-intro"><div><p className="eyebrow">EDITAL-BASE · 2 CARGOS-META</p><h1>Cargos-meta e trilhas de cobrança</h1><p>O núcleo comum é compartilhado; os ciclos específicos de Técnico e Analista permanecem separados.</p></div><StatusPill tone="gold">Base 2022 · revisão 10/09/2026</StatusPill></section><section className="job-list">{jobs.map((job) => <JobCard job={job} key={job.code} />)}</section><section className="content-grid three-columns"><div className="panel mini-metric"><p className="eyebrow">NÚCLEO COMUM</p><strong>14</strong><span>dias no CTJ-002</span></div><div className="panel mini-metric"><p className="eyebrow">TÉCNICO</p><strong>5</strong><span>ciclos específicos previstos</span></div><div className="panel mini-metric"><p className="eyebrow">ANALISTA</p><strong>7</strong><span>ciclos específicos previstos</span></div></section></div>;
}

function Progress({ snapshot = activeDashboardSnapshot }: { snapshot?: DashboardSnapshot | null } = {}) {
  const execution = snapshot?.execution?.c01;
  const totals = execution?.totals;
  const fixedPlanned = totals?.fixed_meta ?? snapshot?.dashboard.planned_questions ?? 124;
  const projectedPlanned = totals?.planned ?? snapshot?.dashboard.projected_questions ?? 124;
  const done = totals?.done ?? snapshot?.dashboard.executed_questions ?? 0;
  const precisionValue = totals?.precision ?? null;
  const errorBank = execution?.error_count ?? 0;
  const averageMinutes = totals ? formatExecutionMinutes(totals.minutes, totals.done) : "—";
  const hasExecutionData = Boolean(execution && (done > 0 || totals?.errors || totals?.doubts));
  const statusLabel = hasExecutionData ? "Execução registrada" : "Sem sessões registradas";
  const subjects = execution?.subjects ?? [];
  const days = execution?.days ?? [];

  return (
    <div className="inner-page">
      <section className="page-intro">
        <div>
          <p className="eyebrow">PAINÉIS E PROGRESSO · CTJ-002</p>
          <h1>Execução real, lida direto do Notion</h1>
          <p>O planejamento aparece separado do que foi efetivamente feito. O painel não transforma histórico de outros projetos em desempenho TJDFT.</p>
        </div>
        <StatusPill tone={hasExecutionData ? "teal" : "gold"}>{statusLabel}</StatusPill>
      </section>

      <section className="stats-grid progress-stats">
        <StatCard icon={Check} label="Questões feitas" value={String(done)} detail={`de ${projectedPlanned} projetadas · ${fixedPlanned} fixas`} tone="blue" />
        <StatCard icon={TrendingUp} label="Precisão" value={formatExecutionPercent(precisionValue)} detail={precisionValue === null ? "Aparece após a primeira correção" : `${totals?.correct ?? 0} acertos em ${done} questões`} tone="teal" />
        <StatCard icon={CircleAlert} label="Caderno de erros" value={String(errorBank)} detail={errorBank ? "Registros no banco de questões" : "Nenhum erro registrado"} tone="coral" />
        <StatCard icon={Clock3} label="Tempo médio" value={averageMinutes} detail={totals?.minutes ? `${totals.minutes} min acumulados` : "Exige registro de tempo"} tone="violet" />
      </section>

      <section className="content-grid two-thirds">
        <div className="panel execution-overview-panel">
          <SectionHeading eyebrow="CTJ-002 · CONSOLIDADO" title="O que já virou evidência" description="A meta do dia é agregada no Banco de Dias; a distribuição por matéria vem do Banco de Controle de Questões." action={<StatusPill tone="teal">{formatExecutionPercent(totals?.progress ?? 0)} do planejado</StatusPill>} />
          <div className="execution-progress-track"><span style={{ width: `${Math.min(100, Math.max(0, (totals?.progress ?? 0) * 100))}%` }} /></div>
          <div className="execution-summary-grid">
            <div><span>Meta projetada</span><strong>{projectedPlanned}</strong></div>
            <div><span>Acertos</span><strong>{totals?.correct ?? 0}</strong></div>
            <div><span>Erros</span><strong>{totals?.errors ?? 0}</strong></div>
            <div><span>Dúvidas</span><strong>{totals?.doubts ?? 0}</strong></div>
          </div>
          <div className="subject-performance">
            <div className="subsection-heading"><p className="eyebrow">DISTRIBUIÇÃO POR MATÉRIA</p><span>{execution?.question_rows ?? 0} linhas ativas</span></div>
            {subjects.length > 0 ? <div className="performance-list">{subjects.map((subject) => <div className="performance-row" key={subject.subject}><div><strong>{subject.subject}</strong><span>{subject.planned} previstas · {subject.rows} linhas</span></div><div className="performance-bar"><span style={{ width: `${subject.planned ? Math.min(100, (subject.done / subject.planned) * 100) : 0}%` }} /></div><strong className="performance-value">{subject.done}/{subject.planned}</strong><StatusPill tone={subject.precision === null ? "neutral" : subject.precision >= .8 ? "teal" : subject.precision >= .6 ? "gold" : "coral"}>{formatExecutionPercent(subject.precision)}</StatusPill></div>)}</div> : <div className="execution-empty"><BarChart3 size={20} /><span>As linhas de questões do CTJ-002 aparecerão aqui quando o banco estiver populado.</span></div>}
          </div>
        </div>

        <div className="panel decision-panel">
          <p className="eyebrow">DECISÃO DO PAINEL</p>
          <h3>{hasExecutionData ? "Use o resultado para recalibrar." : "Agora, estudar. Depois, recalibrar."}</h3>
          <p>{hasExecutionData ? "A próxima revisão deve nascer de erros, dúvidas e reincidências registradas no Caderno de Erros do TJDFT." : "Não ajuste a carga antes de existir evidência TJDFT. O histórico outros projetos serve para o estado inicial dos tópicos, não para fabricar acurácia."}</p>
          <div className="decision-quote">“Métrica sem decisão não entra como KPI principal.”</div>
        </div>
      </section>

      <section className="panel execution-days-panel">
        <SectionHeading eyebrow="BANCO DE DIAS · CTJ-002" title="Andamento por dia efetivamente estudado" description="O painel lê o status e os totais agregados do Notion. D07 e D14 permanecem adaptativos até haver resultados que os alimentem." action={<a className="text-button" href={notionExecutionPage} target="_blank" rel="noreferrer">Abrir execução no Notion <ArrowRight size={15} /></a>} />
        {days.length > 0 ? <div className="execution-day-list">{days.map((day) => <div className="execution-day-row" key={day.day}><div className="execution-day-name"><strong>{day.day}</strong><span>{day.title.replace(/^CTJ-002-D\d{2}\s*[—–-]\s*/i, "")}</span></div><StatusPill tone={day.status === "Próximo" ? "gold" : day.done > 0 ? "teal" : "neutral"}>{day.status}</StatusPill><div className="execution-day-track"><span style={{ width: `${Math.min(100, Math.max(0, day.progress * 100))}%` }} /></div><span className="execution-day-count">{day.done}/{day.planned}</span><span className="execution-day-result">{day.done ? `${day.correct} ac. · ${day.errors} er.` : "Aguardando execução"}</span></div>)}</div> : <div className="execution-empty execution-empty-large"><BarChart3 size={20} /><span>O Banco de Dias do CTJ-002 ainda não foi sincronizado.</span></div>}
      </section>
    </div>
  );
}

function MaterialsLegacy() {
  return <div className="inner-page"><section className="page-intro"><div><p className="eyebrow">BIBLIOTECA TJDFT</p><h1>Fontes que alimentam a preparação</h1><p>O site organiza o acesso. A verdade continua no material oficial e no Notion operacional.</p></div><StatusPill tone="teal">Fonte: Notion TJDFT</StatusPill></section><section className="source-grid">{sources.map((source) => <article className="panel source-card" key={source.title}><div className="source-card-top"><span className="source-icon"><FileCheck2 size={18} /></span><StatusPill>{source.tag}</StatusPill></div><h3>{source.title}</h3><p>{source.detail}</p><a className="text-button" href={source.href} target="_blank" rel="noreferrer">Abrir no Notion <ChevronRight size={16} /></a></article>)}</section><section className="panel materials-roadmap"><SectionHeading eyebrow="CTJ-002 · MATERIAL COMPLETO" title="Materiais do D01 ao D14" description="Cada cartão abre a página correspondente no Notion. A meta e o estado seguem a sequência operacional do CTJ-002." action={<a className="text-button" href={notionMaterialsPage} target="_blank" rel="noreferrer">Abrir biblioteca no Notion <ChevronRight size={16} /></a>} /><div className="material-grid">{studyMaterials.map((material) => <article className={`material-card material-${material.tone}`} key={material.day}><div className="material-card-top"><span className="material-day">{material.day}</span><StatusPill tone={material.tone === "coral" ? "coral" : material.tone === "gold" ? "gold" : material.tone === "violet" ? "violet" : "teal"}>{material.meta}</StatusPill></div><h3>{material.title}</h3><p>{material.detail}</p><a className="text-button" href={material.href} target="_blank" rel="noreferrer">Abrir material <ArrowRight size={15} /></a></article>)}</div></section><section className="panel legislation-panel"><SectionHeading eyebrow="LEITURA LEGISLATIVA · AUDITORIA 10/09/2026" title="Leis e fontes oficiais por dia" description="O roteiro abaixo foi organizado a partir da página de materiais do Notion. “Sem lei seca nuclear” significa que o dia prioriza material técnico, conceitos ou revisão adaptativa." action={<a className="text-button" href={notionMaterialsPage} target="_blank" rel="noreferrer">Ver roteiro no Notion <ChevronRight size={16} /></a>} /><div className="legislation-list">{legislationPlan.map((item) => <article className={`legislation-item legislation-${item.tone}`} key={item.day}><div className="legislation-day">{item.day}</div><div className="legislation-body"><div className="legislation-title-row"><h3>{item.title}</h3><StatusPill tone={item.tone === "coral" ? "coral" : item.tone === "gold" ? "gold" : item.tone === "violet" ? "violet" : "teal"}>{item.status}</StatusPill></div><p>{item.detail}</p>{item.links.length > 0 ? <div className="law-links">{item.links.map((link) => <a href={link.href} target="_blank" rel="noreferrer" key={link.href}>{link.label} <ArrowRight size={13} /></a>)}</div> : <span className="law-empty">Sem lei seca nuclear neste recorte</span>}</div></article>)}</div></section><section className="panel future-materials"><SectionHeading eyebrow="FILA POSTERIOR · NOTION" title="Materiais já previstos para depois do CTJ-002" description="Eles permanecem no repositório, mas não deslocam o D01 nem antecipam um novo ciclo." action={<a className="text-button" href={notionMaterialsPage} target="_blank" rel="noreferrer">Abrir materiais sequenciais <ChevronRight size={16} /></a>} /><div className="future-material-grid">{futureMaterials.map((material) => <div className="future-material" key={material.label}><strong>{material.label}</strong><span>{material.detail}</span></div>)}</div></section><section className="panel materials-note"><div className="note-icon"><CircleAlert size={19} /></div><div><p className="eyebrow">REGRA-MÃE</p><h3>Fonte oficial atualizada prevalece sobre resumo antigo.</h3><p>O Notion mantém o material completo; o site oferece uma visão rápida, com links para a fonte oficial e para cada página do CTJ-002.</p></div></section></div>;
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function toneForSequence(order: number): MaterialsTone {
  if (order <= 4) return "gold";
  if (order <= 9) return "teal";
  if (order <= 14) return "coral";
  if (order <= 17) return "violet";
  return "teal";
}

function Materials({ snapshot = activeDashboardSnapshot }: { snapshot?: DashboardSnapshot | null }) {
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialPreview | null>(null);
  const [materialsView, setMaterialsView] = useState<MaterialsView>("c01");

  useEffect(() => {
    if (!selectedMaterial) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedMaterial(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedMaterial]);

  const liveMaterials = snapshot?.materials;
  const hasLiveMaterials = Boolean(liveMaterials?.days?.length);
  const displayedMaterials = hasLiveMaterials ? liveMaterials!.days : studyMaterials;
  const displayedLegislation = liveMaterials?.legislation?.length ? liveMaterials.legislation : legislationPlan;
  const [lawQuery, setLawQuery] = useState("");
  const [lawFilter, setLawFilter] = useState("Todos");
  const normalizedLawQuery = normalizeSearch(lawQuery.trim());
  const filteredLegislation = displayedLegislation.filter((item) => {
    const searchableText = [
      item.day,
      item.title,
      item.detail,
      item.status,
      ...item.links.flatMap((link) => [link.label, link.href]),
    ].join(" ");
    const matchesQuery =
      !normalizedLawQuery || normalizeSearch(searchableText).includes(normalizedLawQuery);
    const hasOfficialSource = item.links.length > 0;
    const matchesFilter =
      lawFilter === "Todos" ||
      (lawFilter === "Com fonte oficial" && hasOfficialSource) ||
      (lawFilter === "Sem lei seca" && !hasOfficialSource);
    return matchesQuery && matchesFilter;
  });
  const displayedFuture = liveMaterials?.future?.length ? liveMaterials.future : futureMaterials;
  const displayedSequence = liveMaterials?.sequence?.length ? liveMaterials.sequence : sequentialMaterialsFallback;
  const sequenceSource = displayedSequence[0]?.href || notionSequentialMaterialsPage;
  const [sequenceQuery, setSequenceQuery] = useState("");
  const [sequenceGroupFilter, setSequenceGroupFilter] = useState("Todos");
  const sequenceGroups = ["Todos", ...Array.from(new Set(displayedSequence.map((item) => item.group)))];
  const normalizedSequenceQuery = normalizeSearch(sequenceQuery.trim());
  const filteredSequence = displayedSequence.filter((item) => {
    const matchesQuery =
      !normalizedSequenceQuery ||
      normalizeSearch([item.code, item.title, item.group].join(" ")).includes(normalizedSequenceQuery);
    const matchesGroup = sequenceGroupFilter === "Todos" || item.group === sequenceGroupFilter;
    return matchesQuery && matchesGroup;
  });
  const materialSource = liveMaterials?.source_url || notionMaterialsPage;
  const auditLabel = formatMaterialsAudit(liveMaterials?.last_edited_time ?? null);

  return (
    <div className="inner-page">
      <section className="page-intro">
        <div>
          <p className="eyebrow">BIBLIOTECA TJDFT</p>
          <h1>Fontes que alimentam a preparação</h1>
          <p>O site organiza o acesso. A verdade continua no material oficial e no Notion operacional.</p>
        </div>
        <StatusPill tone={hasLiveMaterials ? "teal" : "gold"}>{hasLiveMaterials ? "Notion ao vivo" : "Recorte do Notion"}</StatusPill>
      </section>

      <section className="panel materials-overview">
        <div className="materials-overview-head">
          <div>
            <p className="eyebrow">BIBLIOTECA DE ESTUDO</p>
            <h2>Escolha uma seção</h2>
            <p>Abra apenas o bloco que você quer consultar. O CTJ-002 fica aberto por padrão; os demais continuam disponíveis sem alongar a página.</p>
          </div>
          <StatusPill tone={hasLiveMaterials ? "teal" : "gold"}>{hasLiveMaterials ? "Notion sincronizado" : "Snapshot de segurança"}</StatusPill>
        </div>
        <div className="materials-summary-grid" role="tablist" aria-label="Seções da biblioteca">
          <button
            id="materials-tab-c01"
            className={`materials-summary-card materials-summary-gold ${materialsView === "c01" ? "materials-summary-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={materialsView === "c01"}
            aria-controls="c01-materials"
            onClick={() => setMaterialsView("c01")}
          >
            <span className="materials-summary-icon"><Target size={18} /></span>
            <span><strong>{displayedMaterials.length}</strong><small>Agora · CTJ-002</small></span>
            <ChevronRight size={16} />
          </button>
          <button
            id="materials-tab-sequence"
            className={`materials-summary-card materials-summary-teal ${materialsView === "sequence" ? "materials-summary-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={materialsView === "sequence"}
            aria-controls="sequence-materials"
            onClick={() => setMaterialsView("sequence")}
          >
            <span className="materials-summary-icon"><Layers3 size={18} /></span>
            <span><strong>{displayedSequence.length}</strong><small>Catálogo TJ-MAT</small></span>
            <ChevronRight size={16} />
          </button>
          <button
            id="materials-tab-legislation"
            className={`materials-summary-card materials-summary-violet ${materialsView === "legislation" ? "materials-summary-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={materialsView === "legislation"}
            aria-controls="legislation-materials"
            onClick={() => setMaterialsView("legislation")}
          >
            <span className="materials-summary-icon"><FileText size={18} /></span>
            <span><strong>{displayedLegislation.length}</strong><small>Leis por dia</small></span>
            <ChevronRight size={16} />
          </button>
          <button
            id="materials-tab-future"
            className={`materials-summary-card materials-summary-coral ${materialsView === "future" ? "materials-summary-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={materialsView === "future"}
            aria-controls="future-materials"
            onClick={() => setMaterialsView("future")}
          >
            <span className="materials-summary-icon"><Route size={18} /></span>
            <span><strong>{displayedFuture.length}</strong><small>Depois do CTJ-002</small></span>
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="materials-overview-foot">
          <span><Check size={14} /> Uma seção aberta por vez.</span>
          <div className="materials-source-strip">
            <span>Fontes:</span>
            {sources.map((source) => (
              <a href={source.href} target="_blank" rel="noreferrer" key={source.title}>
                {source.tag} · {source.title} <ChevronRight size={13} />
              </a>
            ))}
            <a className="materials-source-main" href={materialSource} target="_blank" rel="noreferrer">Notion operacional <ArrowRight size={14} /></a>
          </div>
        </div>
      </section>

      <section id="c01-materials" role="tabpanel" aria-labelledby="materials-tab-c01" className={`panel materials-roadmap materials-anchor ${materialsView === "c01" ? "" : "materials-view-hidden"}`}>
        <SectionHeading
          eyebrow="CTJ-002 · MATERIAL COMPLETO"
          title="Materiais do D01 ao D14"
          description="Cada cartão abre um resumo dentro do site. A fonte original do Notion continua disponível nos botões de origem."
          action={<a className="text-button" href={materialSource} target="_blank" rel="noreferrer">Abrir biblioteca no Notion <ChevronRight size={16} /></a>}
        />
        <div className="material-grid">
          {displayedMaterials.map((material) => (
            <article className={`material-card material-${material.tone}`} key={material.day}>
              <div className="material-card-top"><span className="material-day">{material.day}</span><StatusPill tone={material.tone}>{material.meta}</StatusPill></div>
              <h3>{material.title}</h3>
              <p>{material.detail}</p>
              <button
                className="text-button material-open-button"
                type="button"
                onClick={() => {
                  const legislation = displayedLegislation.find((item) => item.day === material.day);
                  setSelectedMaterial({
                    label: material.day,
                    title: material.title,
                    detail: material.detail,
                    meta: material.meta,
                    href: material.href,
                    tone: material.tone,
                    legislation,
                  });
                }}
              >
                Abrir material no site <ArrowRight size={15} />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section id="sequence-materials" role="tabpanel" aria-labelledby="materials-tab-sequence" className={`panel sequence-panel materials-anchor ${materialsView === "sequence" ? "" : "materials-view-hidden"}`}>
        <SectionHeading
          eyebrow="TRILHA ATEMPORAL · NOTION"
          title="Catálogo de materiais TJ-MAT"
          description="Os módulos são a biblioteca estruturante do projeto. O Macro distribui a sequência nos dias dos ciclos sem criar datas artificiais."
          action={<a className="text-button" href={sequenceSource} target="_blank" rel="noreferrer">Abrir sequência no Notion <ChevronRight size={16} /></a>}
        />
        <div className="sequence-toolbar">
          <label className="sequence-search">
            <span className="sr-only">Buscar material sequencial</span>
            <input
              type="search"
              value={sequenceQuery}
              onChange={(event) => setSequenceQuery(event.target.value)}
              placeholder="Buscar por código, matéria ou tema"
              aria-label="Buscar material sequencial"
            />
          </label>
          <select
            className="sequence-filter"
            value={sequenceGroupFilter}
            onChange={(event) => setSequenceGroupFilter(event.target.value)}
            aria-label="Filtrar materiais sequenciais"
          >
            {sequenceGroups.map((group) => <option value={group} key={group}>{group}</option>)}
          </select>
          <span className="sequence-count">{filteredSequence.length} de {displayedSequence.length} materiais</span>
        </div>
        <div className="sequence-grid">
          {filteredSequence.length > 0 ? filteredSequence.map((material) => {
            const tone = toneForSequence(material.order);
            return (
              <article className={`material-card material-${tone} sequence-card`} key={material.code}>
                <div className="material-card-top"><span className="material-day">{material.code}</span><StatusPill tone={tone}>{material.group}</StatusPill></div>
                <h3>{material.title}</h3>
                <p>{material.detail}</p>
                <button
                  className="text-button material-open-button"
                  type="button"
                  onClick={() =>
                    setSelectedMaterial({
                      label: material.code,
                      title: material.title,
                      detail: material.detail,
                      meta: material.group,
                      href: material.href,
                      tone,
                    })
                  }
                >
                  Abrir material no site <ArrowRight size={15} />
                </button>
              </article>
            );
          }) : <div className="sequence-empty">Nenhum material corresponde à busca ou ao filtro atual.</div>}
        </div>
      </section>

      <section id="legislation-materials" role="tabpanel" aria-labelledby="materials-tab-legislation" className={`panel legislation-panel materials-anchor ${materialsView === "legislation" ? "" : "materials-view-hidden"}`}>
        <SectionHeading
          eyebrow={auditLabel}
          title="Leis e fontes oficiais por dia"
          description="O roteiro é lido da página de materiais do Notion quando a API está disponível. “Sem lei seca nuclear” significa que o dia prioriza material técnico, conceitos ou revisão adaptativa."
          action={<a className="text-button" href={materialSource} target="_blank" rel="noreferrer">Ver roteiro no Notion <ChevronRight size={16} /></a>}
        />
        <div className="legislation-toolbar">
          <label className="legislation-search">
            <span className="sr-only">Buscar lei ou fonte oficial</span>
            <input
              type="search"
              value={lawQuery}
              onChange={(event) => setLawQuery(event.target.value)}
              placeholder="Buscar Regimento, Ética, Lei 11.697..."
              aria-label="Buscar lei ou fonte oficial"
            />
          </label>
          <select
            className="legislation-filter"
            value={lawFilter}
            onChange={(event) => setLawFilter(event.target.value)}
            aria-label="Filtrar leis"
          >
            <option value="Todos">Todos os dias</option>
            <option value="Com fonte oficial">Com fonte oficial</option>
            <option value="Sem lei seca">Sem lei seca nuclear</option>
          </select>
          <span className="legislation-count">{filteredLegislation.length} de {displayedLegislation.length} dias</span>
        </div>
        <div className="legislation-list">
          {filteredLegislation.length > 0 ? filteredLegislation.map((item) => (
            <article className={`legislation-item legislation-${item.tone}`} key={item.day}>
              <div className="legislation-day">{item.day}</div>
              <div className="legislation-body">
                <div className="legislation-title-row"><h3>{item.title}</h3><StatusPill tone={item.tone}>{item.status}</StatusPill></div>
                <p>{item.detail}</p>
                {item.links.length > 0 ? <div className="law-links">{item.links.map((link) => <a href={link.href} target="_blank" rel="noreferrer" key={link.href}>{link.label} <ArrowRight size={13} /></a>)}</div> : <span className="law-empty">Sem lei seca nuclear neste recorte</span>}
              </div>
            </article>
          )) : (
            <div className="legislation-empty">Nenhum dia encontrado. Tente buscar por outra lei ou fonte.</div>
          )}
        </div>
      </section>

      <section id="future-materials" role="tabpanel" aria-labelledby="materials-tab-future" className={`panel future-materials materials-anchor ${materialsView === "future" ? "" : "materials-view-hidden"}`}>
        <SectionHeading
          eyebrow="FILA POSTERIOR · NOTION"
          title="Materiais já previstos para depois do CTJ-002"
          description="Eles permanecem no repositório, mas não deslocam o D01 nem antecipam um novo ciclo."
          action={<a className="text-button" href={materialSource} target="_blank" rel="noreferrer">Abrir materiais sequenciais <ChevronRight size={16} /></a>}
        />
        <div className="future-material-grid">{displayedFuture.map((material) => <div className="future-material" key={material.label}><strong>{material.label}</strong><span>{material.detail}</span></div>)}</div>
      </section>

      <section className="panel materials-note">
        <div className="note-icon"><CircleAlert size={19} /></div>
        <div><p className="eyebrow">REGRA-MÃE</p><h3>Fonte oficial atualizada prevalece sobre resumo antigo.</h3><p>O site abre os resumos e as leis vinculadas; o Notion mantém o conteúdo completo e o GitHub conserva o backup quando a consulta ao vivo estiver indisponível.</p></div>
      </section>
      {selectedMaterial ? (
        <div
          className="material-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedMaterial(null);
          }}
        >
          <section
            className={`material-modal material-modal-${selectedMaterial.tone}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="material-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="material-modal-top">
              <div>
                <p className="eyebrow">{selectedMaterial.label} · LEITURA NO SITE</p>
                <h2 id="material-modal-title">{selectedMaterial.title}</h2>
              </div>
              <button
                className="secondary-button material-modal-close"
                type="button"
                onClick={() => setSelectedMaterial(null)}
                aria-label="Fechar visualização do material"
              >
                <X size={17} />
              </button>
            </div>
            <div className="material-modal-meta"><StatusPill tone={selectedMaterial.tone}>{selectedMaterial.meta}</StatusPill></div>
            <p className="material-modal-detail">{selectedMaterial.detail}</p>
            {selectedMaterial.legislation ? (
              <div className="material-modal-reading">
                <p className="eyebrow">ROTEIRO LEGISLATIVO VINCULADO</p>
                <h3>{selectedMaterial.legislation.title}</h3>
                <p>{selectedMaterial.legislation.detail}</p>
                {selectedMaterial.legislation.links.length > 0 ? (
                  <div className="law-links material-modal-links">
                    {selectedMaterial.legislation.links.map((link) => (
                      <a href={link.href} target="_blank" rel="noreferrer" key={link.href}>
                        {link.label} <ArrowRight size={13} />
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="material-modal-note">
              <CircleAlert size={17} />
              <span>Este é o resumo público sincronizado. Para conferir o conteúdo integral e a versão mais recente, use a fonte do Notion.</span>
            </div>
            <div className="material-modal-actions">
              <button className="secondary-button" type="button" onClick={() => setSelectedMaterial(null)}>Fechar</button>
              <a className="primary-button" href={selectedMaterial.href} target="_blank" rel="noreferrer">
                Ver fonte no Notion <ArrowRight size={15} />
              </a>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default function Home() {
  const [section, setSection] = useState<SectionId>("inicio");
  const [menuOpen, setMenuOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [lastUpdated, setLastUpdated] = useState("GitHub · carregando...");
  const [refreshing, setRefreshing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [syncMode, setSyncMode] = useState<"live" | "fallback" | "error">("error");
  const handleNavigate = (next: SectionId) => { setSection(next); setMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const readSnapshot = async (url: string, options: RequestInit = {}) => {
    const separator = url.includes("?") ? "&" : "?";
    const response = await fetch(`${url}${separator}ts=${Date.now()}`, { ...options, cache: "no-store" });
    if (!response.ok) throw new Error("Snapshot indisponível");
    const candidate: unknown = await response.json();
    if (!isDashboardSnapshot(candidate)) throw new Error("Snapshot inválido");
    return candidate;
  };
  const refreshSnapshot = async () => {
    setRefreshing(true);
    setSyncError(false);
    try {
      const candidate = await readSnapshot(`${LIVE_NOTION_API_URL}?refresh=1`, {
        headers: {
          Accept: "application/json",
          apikey: LIVE_NOTION_API_KEY,
          Authorization: `Bearer ${LIVE_NOTION_API_KEY}`,
        },
      });
      setSnapshot(candidate);
      setSyncMode("live");
      setLastUpdated(`GitHub · snapshot · ${formatSnapshotDate(candidate.source.synced_at)}`);
    } catch {
      try {
        const candidate = await readSnapshot("./data/tjdft-snapshot.json");
        setSnapshot(candidate);
        setSyncMode("fallback");
        setLastUpdated(`GitHub · backup · ${formatSnapshotDate(candidate.source.synced_at)}`);
      } catch {
        setSyncMode("error");
        setSyncError(true);
        setLastUpdated("GitHub · indisponível");
      }
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        const fallback = await readSnapshot("./data/tjdft-snapshot.json");
        if (!cancelled) {
          setSnapshot(fallback);
          setSyncMode("fallback");
          setLastUpdated(`GitHub · backup · ${formatSnapshotDate(fallback.source.synced_at)}`);
        }
      } catch {
        // A live request below can still initialize the dashboard when no backup is available.
      }

      if (!cancelled) void refreshSnapshot();
    };

    void initialize();
    return () => { cancelled = true; };
  }, []);
  const activeLabel = navigation.find((item) => item.id === section)?.label ?? "Visão geral";
  const nextAction = snapshot?.dashboard.next_action ?? "D01 · Português: interpretação e coesão + Regimento I";
  activeDashboardSnapshot = snapshot;
  return <main className="site-shell"><aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}><div className="brand-block"><div className="brand-mark">T</div><div><strong>TJDFT</strong><span>Dashboard PRO · pré-edital</span></div><button className="close-menu" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={18} /></button></div><div className="sidebar-context"><span className="live-dot" /> Pré-edital 2026/2027</div><nav className="main-nav" aria-label="Navegação principal">{navigation.map((item) => { const Icon = item.icon; const active = section === item.id; return <button className={`nav-item ${active ? "nav-active" : ""}`} key={item.id} onClick={() => handleNavigate(item.id)}><Icon size={18} /><span>{item.label}</span>{active && <span className="nav-indicator" />}</button>; })}</nav><div className="sidebar-bottom"><div className="sidebar-card"><p className="eyebrow">PRÓXIMA AÇÃO</p><strong>{nextAction}</strong><button onClick={() => handleNavigate("estudar")}>Abrir execução <ArrowRight size={15} /></button></div><div className="sidebar-footer"><span className="source-dot" /> Notion como fonte operacional do TJDFT</div></div></aside>{menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}<div className="main-column"><header className="topbar"><div className="topbar-left"><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button><div><span className="breadcrumb">TJDFT Dashboard</span><strong>{activeLabel}</strong></div></div><div className="topbar-actions"><span className={`sync-label ${syncError ? "sync-error" : syncMode === "fallback" ? "sync-fallback" : ""}`}><span className="source-dot" /> {lastUpdated}</span><button className={`refresh-button ${refreshing ? "is-refreshing" : ""}`} onClick={refreshSnapshot} disabled={refreshing} aria-label="Atualizar snapshot do TJDFT" title="Recarregar snapshot publicado"><RefreshCw size={17} /></button></div></header><div className="page-content">{section === "inicio" && <Overview onNavigate={handleNavigate} snapshot={snapshot} />}{section === "estudar" && <StudyToday />}{section === "fases" && <Phases />}{section === "cargos" && <Jobs />}{section === "progresso" && <Progress />}{section === "materiais" && <Materials />}</div><footer className="site-footer"><span>TJDFT · Projeto exclusivo</span><span>{syncMode === "live" ? `Notion ao vivo · ${formatSnapshotDate(snapshot?.source?.synced_at ?? null)}` : syncMode === "fallback" ? `Backup do GitHub · ${formatSnapshotDate(snapshot?.source?.synced_at ?? null)}` : "GitHub · indisponível"}</span></footer></div></main>;
}
