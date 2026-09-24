
const CANONICAL = [
  "P01","P02","P03","RL01","P04","REV01","P05","P06","RL02","P07","P08","REV02",
  "P09","RL03","P10","P11","P12","REV03","RL04","P13","P14","P15","RL05","REV04",
  "P16","P17","P18","RL06","RL07","REV05","RL08","RL09","RL10","RL11","RL12","REV06","RL13",
];

const n = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const pct = (correct,total) => total > 0 && correct != null ? correct / total : null;
const unique = (items) => [...new Set(items.filter(Boolean))];

export function evidenceClass(questions = 0, sessions = 0) {
  if (!questions && !sessions) return { key:"none", label:"sem dados", confidence:"não calculável" };
  if (questions < 10) return { key:"very-small", label:"amostra muito pequena", confidence:"muito baixa" };
  if (questions < 25 || sessions < 2) return { key:"small", label:"amostra pequena", confidence:"baixa" };
  if (questions < 60 || sessions < 3) return { key:"moderate", label:"amostra moderada", confidence:"moderada" };
  return { key:"strong", label:"amostra forte", confidence:"alta" };
}

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone:"America/Sao_Paulo", year:"numeric", month:"2-digit", day:"2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return [part("year"), part("month"), part("day")].join("-");
}

function reviewState(date, today) {
  if (!date) return "programada";
  const key = String(date).slice(0, 10);
  if (!today) return "programada";
  if (key < today) return "vencida";
  if (key === today) return "hoje";
  return "próxima";
}

function trendFromSeries(series, totalQuestions) {
  const dated = [...(series || [])]
    .filter((row) => row?.date && Number(row.total) > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (dated.length < 3 || totalQuestions < 25) {
    return { state:"insuficiente", label:"amostra temporal insuficiente", delta:null, periods:dated.length };
  }
  const split = Math.floor(dated.length / 2);
  const summarize = (rows) => {
    const total = rows.reduce((sum, row) => sum + (Number(row.total) || 0) - (Number(row.annulled) || 0), 0);
    const correct = rows.reduce((sum, row) => sum + (Number(row.correct) || 0), 0);
    return total > 0 ? correct / total : null;
  };
  const previous = summarize(dated.slice(0, split));
  const recent = summarize(dated.slice(split));
  if (previous == null || recent == null) {
    return { state:"insuficiente", label:"amostra temporal insuficiente", delta:null, periods:dated.length };
  }
  const delta = recent - previous;
  const state = Math.abs(delta) < 0.05 ? "estável" : delta > 0 ? "melhora" : "queda";
  return {
    state,
    label: state === "estável" ? "estável" : state === "melhora" ? "melhora recente" : "queda recente",
    delta,
    periods:dated.length,
  };
}

export function buildTJDFTIntelligence({ dashboard = {}, portuguese = {}, laws = {}, edital = {} }, now = new Date()) {
  const op = dashboard.operational || null;
  const editorialUnits = [...(portuguese.units || [])].sort((a,b)=>(a.canonical_order||0)-(b.canonical_order||0));
  const opTrail = new Map((op?.trail?.items || []).map((item) => [item.code, item]));
  const units = editorialUnits.map((unit) => {
    const live = opTrail.get(unit.code);
    return {
      ...unit,
      study_state: live?.state || null,
      d0: live?.d0 ?? null,
      d7: live?.d7 ?? null,
      d20: live?.d20 ?? null,
    };
  });
  const sequence = op?.trail?.items?.length
    ? op.trail.items.map((item) => item.code)
    : (portuguese.sequence || editorialUnits.map((unit) => unit.code));
  const sequenceValid = op?.trail?.sequence_valid ?? (JSON.stringify(sequence) === JSON.stringify(CANONICAL));
  const executionDays = dashboard.execution?.c01?.days || [];
  const executed = executionDays.filter(d => (n(d.done) || 0) > 0 || Boolean(d.executed_at));
  const totals = dashboard.execution?.c01?.totals || {};
  const questions = n(totals.done) ?? executed.reduce((s,d)=>s+(n(d.done)||0),0);
  const correct = n(totals.correct) ?? executed.reduce((s,d)=>s+(n(d.correct)||0),0);
  const errors = n(totals.errors) ?? executed.reduce((s,d)=>s+(n(d.errors)||0),0);
  const minutes = n(totals.minutes) ?? executed.reduce((s,d)=>s+(n(d.minutes)||0),0);
  const sessions = executed.filter(d=>d.executed_at).length;
  const evidence = evidenceClass(questions, sessions);
  const precision = pct(correct, questions);

  // Editorial availability is not execution evidence.
  const readyUnits = units.filter(u=>u.material_ready);
  const firstReady = readyUnits[0] || units[0] || null;
  const partial = executed.find(d => (n(d.done)||0) > 0 && (n(d.progress)||0) < 1);
  const nextAction = partial ? {
    kind:"resume",
    label:"RETOMAR UNIDADE",
    code:partial.day,
    title:partial.title,
    href:partial.href || null,
    reason:"Há execução parcial registrada. Continuidade prevalece sobre abrir conteúdo novo.",
    confidence:"alta",
  } : firstReady ? {
    kind:"canonical",
    label:"PRÓXIMA AÇÃO",
    code:firstReady.code,
    title:firstReady.title,
    href:`portugues-rlm/${String(firstReady.code).toLowerCase()}/`,
    reason: executed.length
      ? "É a primeira unidade disponível da sequência canônica sem evidência pública de conclusão desta trilha."
      : "É a primeira unidade canônica com material disponível; o snapshot público ainda não traz execução da esteira 1–37.",
    confidence: executed.length ? "moderada" : "baixa",
  } : {
    kind:"wait", label:"SEM AÇÃO AUTOMÁTICA", code:null, title:"Aguardando material e evidência",
    href:null, reason:"Não há material disponível suficiente para recomendar avanço.", confidence:"não calculável"
  };

  const subjects = dashboard.execution?.c01?.subjects || [];
  const performance = subjects.map(row => {
    const q=n(row.done)||0, s=n(row.rows)||0, c=n(row.correct)||0;
    const ev=evidenceClass(q,s), pr=pct(c,q);
    return { subject:row.subject, questions:q, sessions:s, correct:c, errors:n(row.errors)||0, doubts:n(row.doubts)||0, precision:pr, evidence:ev };
  });

  const strengths = performance.filter(p=>p.precision!=null && p.precision>=0.85 && ["moderate","strong"].includes(p.evidence.key))
    .map(p=>({ ...p, reason:"Precisão ≥85% com evidência ao menos moderada." }));
  const weaknesses = performance.filter(p=>p.precision!=null && p.questions>=10 && p.precision<0.70)
    .map(p=>({ ...p, reason:"Precisão <70% com ao menos 10 questões." }));

  const sourceTime = dashboard.source?.synced_at ? new Date(dashboard.source.synced_at) : null;
  const ageHours = sourceTime && !Number.isNaN(sourceTime.valueOf()) ? (new Date(now).valueOf()-sourceTime.valueOf())/36e5 : null;
  const activeLaws=(laws.laws||[]).filter(l=>l.record_kind==="active");
  const historicalLaws=(laws.laws||[]).filter(l=>l.record_kind==="historical");
  const lawRegression = historicalLaws.filter(l=>l.active===true);
  const editalItems=edital.items || edital.axes || [];
  const techItems=editalItems.filter(i=>JSON.stringify(i.cargos||[]).includes("Técnico"));
  const analystItems=editalItems.filter(i=>JSON.stringify(i.cargos||[]).includes("Analista"));
  const commonItems=editalItems.filter(i=>{
    const c=JSON.stringify(i.cargos||[]);
    return c.includes("Técnico") && c.includes("Analista");
  });

  const issues=[];
  if (!sequenceValid) issues.push({severity:"critical", code:"sequence-divergence", message:"A Ordem 1–37 diverge da sequência canônica."});
  if (!dashboard.source?.synced_at) issues.push({severity:"high",code:"snapshot-date-missing",message:"Snapshot operacional sem data de sincronização."});
  if (ageHours!=null && ageHours>48) issues.push({severity:"medium",code:"snapshot-stale",message:`Snapshot operacional com aproximadamente ${Math.floor(ageHours)} h desde a sincronização.`});
  if (!executed.length) issues.push({severity:"info",code:"execution-absent",message:"Sem execução pública suficiente; ausência não foi convertida em zero de desempenho."});
  if (!executionDays.some(d=>d.executed_at)) issues.push({severity:"info",code:"real-date-absent",message:"Sem datas reais de execução suficientes para calcular tendência."});
  for (const d of executionDays) {
    const done=n(d.done), c=n(d.correct), e=n(d.errors);
    if (done!=null && c!=null && e!=null && c+e!==done) issues.push({severity:"high",code:"question-sum",message:`${d.day}: acertos + erros divergem do total executado.`});
    if ((n(d.minutes)||0)<0) issues.push({severity:"high",code:"negative-time",message:`${d.day}: tempo negativo.`});
  }
  if (lawRegression.length) issues.push({severity:"critical",code:"revoked-active",message:"Norma histórica/revogada reapareceu como ativa."});

  const risks=[
    ...weaknesses.map(w=>({severity:"high",title:w.subject,detail:w.reason,evidence:`${w.questions} questões · ${w.evidence.label}`})),
    ...(ageHours!=null && ageHours>48 ? [{severity:"medium",title:"Sincronização envelhecida",detail:"A decisão usa snapshot versionado que precisa ser atualizado.",evidence:`${Math.floor(ageHours)} h desde a última sincronização`}] : []),
    ...(!executed.length ? [{severity:"info",title:"Execução ainda sem evidência pública",detail:"O sistema não presume fraqueza nem domínio.",evidence:"ausência ≠ zero"}] : []),
  ];

  const reviews = units.filter(u=>String(u.code).startsWith("REV")).map(u=>({
    code:u.code,title:u.title,order:u.canonical_order,materialReady:Boolean(u.material_ready),
    status:"programada", due:null,
  }));

  return {
    generatedAt:new Date(now).toISOString(),
    sequence:{ valid:sequenceValid, total:units.length, canonical:CANONICAL, units },
    execution:{ sessions, questions, correct, errors, minutes, precision, evidence, trend:sessions>=2?"calculável apenas com datas reais detalhadas":"amostra temporal insuficiente" },
    nextAction, strengths, weaknesses, risks, reviews,
    coverage:{
      tecnico:{matrix:techItems.length, studied:null, practiced:null, consolidated:null},
      analista:{matrix:analystItems.length, studied:null, practiced:null, consolidated:null},
      common:{matrix:commonItems.length},
      laws:{active:activeLaws.length,historical:historicalLaws.length},
    },
    quality:{ issues, ageHours, sourceSyncedAt:dashboard.source?.synced_at||null, lawRegressionCount:lawRegression.length },
    agenda:[
      ...reviews.map(r=>({type:"REV",code:r.code,title:r.title,state:"próximo",date:null})),
      ...(nextAction.code?[{type:"UNIDADE",code:nextAction.code,title:nextAction.title,state:nextAction.kind==="resume"?"hoje":"próximo",date:null}]:[]),
    ],
    aliases:{ safe:[], ambiguous:[] },
    meta:{
      phase:dashboard.dashboard?.phase || "Pré-edital",
      sourceTitle:dashboard.source?.title || "Notion",
      editorialReady:readyUnits.length,
      lawActive:activeLaws.length,
      jobs:dashboard.dashboard?.jobs ?? 2,
    }
  };
}
