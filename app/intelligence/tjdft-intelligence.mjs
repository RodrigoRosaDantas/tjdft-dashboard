
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
  const executed = executionDays.filter((day) => (n(day.done) || 0) > 0 || Boolean(day.executed_at));
  const totals = dashboard.execution?.c01?.totals || {};
  const opQuestions = op?.questions || null;
  const questions = opQuestions ? (n(opQuestions.total) || 0) : (n(totals.done) ?? executed.reduce((sum, day) => sum + (n(day.done) || 0), 0));
  const correct = opQuestions ? (n(opQuestions.correct) || 0) : (n(totals.correct) ?? executed.reduce((sum, day) => sum + (n(day.correct) || 0), 0));
  const errors = opQuestions ? (n(opQuestions.errors) || 0) : (n(totals.errors) ?? executed.reduce((sum, day) => sum + (n(day.errors) || 0), 0));
  const doubts = opQuestions ? (n(opQuestions.doubts) || 0) : (n(totals.doubts) ?? executed.reduce((sum, day) => sum + (n(day.doubts) || 0), 0));
  const minutes = op?.continuity ? (n(op.continuity.minutes) || 0) : (n(totals.minutes) ?? executed.reduce((sum, day) => sum + (n(day.minutes) || 0), 0));
  const sessions = opQuestions
    ? (opQuestions.by_date || []).filter((row) => Number(row.total) > 0).length
    : executed.filter((day) => day.executed_at).length;
  const evidence = evidenceClass(questions, sessions);
  const precision = opQuestions?.precision ?? pct(correct, questions);
  const trend = trendFromSeries(opQuestions?.by_date || [], questions);

  // Editorial availability is not execution evidence.
  const readyUnits = editorialUnits.filter((unit) => unit.material_ready);
  const firstReady = readyUnits[0] || editorialUnits[0] || null;
  const activeActivity = op?.continuity?.active || null;
  const nextTrail = op?.trail?.next || null;
  const partial = executed.find((day) => (n(day.done) || 0) > 0 && (n(day.progress) || 0) < 1);
  const nextAction = activeActivity ? {
    kind:"resume",
    label:"RETOMAR SESSÃO",
    code:activeActivity.day || null,
    title:activeActivity.next_action || activeActivity.activity || "Retomar atividade em andamento",
    href:"painel-legado/",
    reason:"Existe uma atividade marcada como em andamento no Notion. Continuidade prevalece sobre abrir conteúdo novo.",
    confidence:"alta",
  } : partial ? {
    kind:"resume",
    label:"RETOMAR UNIDADE",
    code:partial.day,
    title:partial.title,
    href:partial.href || "painel-legado/",
    reason:"Há execução parcial registrada. Continuidade prevalece sobre abrir conteúdo novo.",
    confidence:"alta",
  } : nextTrail ? {
    kind:"canonical",
    label:"PRÓXIMA AÇÃO",
    code:nextTrail.code,
    title:nextTrail.title,
    href:`portugues-rlm/${String(nextTrail.code).toLowerCase()}/`,
    reason:"É a primeira posição da Ordem 1–37 sem D0 concluído. Material pronto não foi confundido com estudo realizado.",
    confidence:"alta",
  } : firstReady ? {
    kind:"canonical",
    label:"PRÓXIMA AÇÃO",
    code:firstReady.code,
    title:firstReady.title,
    href:`portugues-rlm/${String(firstReady.code).toLowerCase()}/`,
    reason:"É a primeira unidade editorial disponível; ainda não há estado operacional suficiente da esteira.",
    confidence:"baixa",
  } : {
    kind:"wait", label:"SEM AÇÃO AUTOMÁTICA", code:null, title:"Aguardando material e evidência",
    href:null, reason:"Não há material disponível suficiente para recomendar avanço.", confidence:"não calculável"
  };

  const subjects = op?.questions?.by_subject || dashboard.execution?.c01?.subjects || [];
  const performance = subjects.map((row) => {
    const operationalRow = Object.hasOwn(row, "total");
    const annulled = operationalRow ? (n(row.annulled) || 0) : 0;
    const q = operationalRow ? Math.max(0, (n(row.total) || 0) - annulled) : (n(row.done) || 0);
    const subjectSessions = operationalRow ? Math.max(1, sessions) : (n(row.rows) || 0);
    const rowCorrect = n(row.correct) || 0;
    const ev = evidenceClass(q, subjectSessions);
    const pr = pct(rowCorrect, q);
    return {
      subject:row.subject || row.key || "Sem matéria",
      questions:q,
      sessions:subjectSessions,
      correct:rowCorrect,
      errors:n(row.errors)||0,
      doubts:n(row.doubts)||0,
      precision:pr,
      evidence:ev,
    };
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
  const techItems=editalItems.filter((item)=>JSON.stringify(item.cargos||[]).includes("Técnico"));
  const analystItems=editalItems.filter((item)=>JSON.stringify(item.cargos||[]).includes("Analista"));
  const fallbackCoverage = {
    tecnico:{matrix:techItems.length,mapped:null,studied:null,practiced_questions:null,consolidated:null,subjects:[]},
    analista:{matrix:analystItems.length,mapped:null,studied:null,practiced_questions:null,consolidated:null,subjects:[]},
  };
  const cargoCoverage = {
    tecnico:op?.coverage?.tecnico || fallbackCoverage.tecnico,
    analista:op?.coverage?.analista || fallbackCoverage.analista,
  };
  const techSubjects = new Set(cargoCoverage.tecnico.subjects || []);
  const commonSubjects = (cargoCoverage.analista.subjects || []).filter((subject) => techSubjects.has(subject));

  const issues=[];
  if (!sequenceValid) issues.push({severity:"critical", code:"sequence-divergence", message:"A Ordem 1–37 diverge da sequência canônica."});
  if (!dashboard.source?.synced_at) issues.push({severity:"high",code:"snapshot-date-missing",message:"Snapshot operacional sem data de sincronização."});
  if (dashboard.source?.status === "fallback") issues.push({severity:"medium",code:"snapshot-fallback",message:"O site está usando snapshot de contingência; decisões devem ser lidas com cautela."});
  if (!questions) issues.push({severity:"info",code:"execution-absent",message:"Sem questões respondidas suficientes; ausência não foi convertida em zero de desempenho."});
  if (!sessions) issues.push({severity:"info",code:"real-date-absent",message:"Sem datas reais de resolução suficientes para calcular tendência."});
  for (const d of executionDays) {
    const done=n(d.done), c=n(d.correct), e=n(d.errors);
    if (done!=null && c!=null && e!=null && c+e!==done) issues.push({severity:"high",code:"question-sum",message:`${d.day}: acertos + erros divergem do total executado.`});
    if ((n(d.minutes)||0)<0) issues.push({severity:"high",code:"negative-time",message:`${d.day}: tempo negativo.`});
  }
  if ((op?.integrity?.duplicate_trail_orders || 0) > 0) issues.push({severity:"critical",code:"duplicate-trail-order",message:"Há Ordem da esteira duplicada no Notion."});
  if ((op?.integrity?.invalid_times || 0) > 0) issues.push({severity:"high",code:"invalid-time",message:"Há tempo negativo em registros operacionais."});
  if (lawRegression.length) issues.push({severity:"critical",code:"revoked-active",message:"Norma histórica/revogada reapareceu como ativa."});

  const activeErrors = op?.errors?.top || [];
  const errorCount = n(op?.errors?.active_count);
  const risks=[
    ...activeErrors.filter((item)=>/Crítica|Alta/i.test(item.severity || "")).map((item)=>({
      severity:/Crítica/i.test(item.severity || "") ? "critical" : "high",
      title:item.topic || item.subject,
      detail:`Erro ${String(item.severity).toLowerCase()}${item.recurrence ? ` · reincidência ${item.recurrence}` : ""}.`,
      evidence:item.action || item.causes || "caderno de erros ativo",
    })),
    ...weaknesses.map((weakness)=>({severity:"high",title:weakness.subject,detail:weakness.reason,evidence:`${weakness.questions} questões · ${weakness.evidence.label}`})),
    ...(!questions ? [{severity:"info",title:"Execução ainda sem evidência suficiente",detail:"O sistema não presume fraqueza nem domínio.",evidence:"ausência ≠ zero"}] : []),
  ];

  const today = localDateKey(now);
  const formalSource = op?.reviews?.formal || units.filter((unit)=>String(unit.code).startsWith("REV")).map((unit)=>({
    code:unit.code,title:unit.title,order:unit.canonical_order,state:unit.study_state || "Não estudado",
  }));
  const reviews = formalSource.map((review)=>({
    code:review.code,
    title:review.title,
    order:review.order,
    materialReady:units.find((unit)=>unit.code===review.code)?.material_ready ?? true,
    status:review.state || "programada",
    due:null,
    state:"programada",
  }));
  const datedReviews = (op?.reviews?.dated || []).map((review,index)=>({
    code:`${review.type || "REV"}-${index+1}`,
    type:review.type || "REVISÃO",
    title:review.title || review.subject || "Revisão",
    subject:review.subject || null,
    date:review.date || null,
    state:reviewState(review.date,today),
    origin:review.origin || null,
  }));
  const agenda=[
    ...datedReviews,
    ...reviews.filter((review)=>!/Dominado|Concluído/i.test(review.status)).map((review)=>({
      type:"REV",code:review.code,title:review.title,state:"programada",date:null,
    })),
    ...(nextAction.code ? [{
      type:nextAction.kind==="resume" ? "CONTINUIDADE" : "UNIDADE",
      code:nextAction.code,title:nextAction.title,state:nextAction.kind==="resume" ? "hoje" : "próxima",date:null,
    }] : []),
  ];
  const agendaOrder={vencida:0,hoje:1,próxima:2,programada:3};
  agenda.sort((left,right)=>(agendaOrder[left.state] ?? 9)-(agendaOrder[right.state] ?? 9) || String(left.date || "9999").localeCompare(String(right.date || "9999")));

  const completedD0 = n(op?.trail?.checkpoints?.d0);
  const trailProgress = op?.trail?.total ? (completedD0 || 0) / op.trail.total : null;

  return {
    generatedAt:new Date(now).toISOString(),
    sequence:{valid:sequenceValid,total:units.length,canonical:CANONICAL,units},
    trail:{
      progress:trailProgress,
      d0:completedD0,
      d7:n(op?.trail?.checkpoints?.d7),
      d20:n(op?.trail?.checkpoints?.d20),
      statusCounts:op?.trail?.status_counts || {},
      next:nextTrail,
    },
    execution:{
      sessions,questions,correct,errors,doubts,minutes,precision,evidence,
      trend:trend.label,
      trendDetail:trend,
      bySubject:performance,
    },
    nextAction,strengths,weaknesses,risks,reviews,activeErrors,errorCount,
    coverage:{
      tecnico:cargoCoverage.tecnico,
      analista:cargoCoverage.analista,
      common:{matrix:commonSubjects.length,subjects:commonSubjects},
      laws:{active:activeLaws.length,historical:historicalLaws.length},
    },
    quality:{
      issues,ageHours,sourceSyncedAt:dashboard.source?.synced_at || null,
      sourceStatus:dashboard.source?.status || null,lawRegressionCount:lawRegression.length,
    },
    agenda,
    aliases:op?.aliases || {safe:[],ambiguous:[]},
    meta:{
      phase:dashboard.dashboard?.phase || "Pré-edital",
      sourceTitle:dashboard.source?.title || "Notion",
      editorialReady:readyUnits.length,
      lawActive:activeLaws.length,
      jobs:dashboard.dashboard?.jobs ?? 2,
      operationalSchema:op?.schema_version || null,
    }
  };
}
