
const CANONICAL = [
  "P01","P02","P03","RL01","P04","REV01","P05","P06","RL02","P07","P08","REV02",
  "P09","RL03","P10","P11","P12","REV03","RL04","P13","P14","P15","RL05","REV04",
  "P16","P17","P18","RL06","RL07","REV05","RL08","RL09","RL10","RL11","RL12","REV06","RL13",
];

const n = (value) => {
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const pct = (correct,total) => total > 0 && correct != null ? correct / total : null;
const unique = (items) => [...new Set(items.filter(Boolean))];

const sumKnown = (values) => {
  if (!values.length) return null;
  const parsed = values.map(n);
  return parsed.some((value) => value == null) ? null : parsed.reduce((sum, value) => sum + value, 0);
};

function outcomeCountsReconcile(total, correct, errors, annulled) {
  const t = n(total);
  const c = n(correct);
  const e = n(errors);
  const a = n(annulled);
  return t != null && c != null && e != null && a != null && c + e + a === t;
}

export function evidenceClass(questions = null, sessions = null) {
  const q = n(questions);
  const s = n(sessions);
  if ((q == null || q === 0) && (s == null || s === 0)) return { key:"none", label:"sem dados", confidence:"não calculável" };
  if (q == null || q < 10) return { key:"very-small", label:"amostra muito pequena", confidence:"muito baixa" };
  if (q < 25 || s == null || s < 2) return { key:"small", label:"amostra pequena", confidence:"baixa" };
  if (q < 60 || s < 3) return { key:"moderate", label:"amostra moderada", confidence:"moderada" };
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

function reviewState(date, today, status = null) {
  const normalizedStatus = String(status || "");
  if (/dispensad/i.test(normalizedStatus)) return "dispensada";
  if (/cancelad/i.test(normalizedStatus)) return "cancelada";
  if (/concluíd|realizad/i.test(normalizedStatus)) return "concluída";
  if (/em andamento|iniciad/i.test(normalizedStatus)) return "em andamento";
  if (!date) return "programada";
  const key = String(date).slice(0, 10);
  if (!today) return "programada";
  if (key < today) return "vencida";
  if (key === today) return "hoje";
  return "próxima";
}

function trendFromSeries(series, totalQuestions) {
  const dated = [...(series || [])]
    .filter((row) => {
      const total = n(row?.total);
      const correct = n(row?.correct);
      const errors = n(row?.errors);
      const annulled = n(row?.annulled);
      return Boolean(row?.date) && total != null && total > 0 && outcomeCountsReconcile(total, correct, errors, annulled);
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (dated.length < 3 || totalQuestions == null || totalQuestions < 25) {
    return { state:"insuficiente", label:"amostra temporal insuficiente", delta:null, periods:dated.length };
  }
  const split = Math.floor(dated.length / 2);
  const summarize = (rows) => {
    const total = rows.reduce((sum, row) => sum + (n(row.total) - n(row.annulled)), 0);
    const correct = rows.reduce((sum, row) => sum + n(row.correct), 0);
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
  const totals = dashboard.execution?.c01?.totals || {};
  const opQuestions = op?.questions || null;
  const observedDays = executionDays.filter((day) =>
    (n(day.done) != null && n(day.done) > 0) ||
    Boolean(day.executed_at) ||
    /em andamento|em execução|concluíd|executad/i.test(day.status || "")
  );
  const opByDate = opQuestions?.by_date || [];
  const datedSessionKeys = new Set([
    ...opByDate.filter((row) => n(row.total) > 0 && row.date).map((row) => String(row.date).slice(0, 10)),
    ...observedDays.filter((day) => day.executed_at).map((day) => String(day.executed_at).slice(0, 10)),
  ]);
  const sessionKeys = new Set([...datedSessionKeys].map((date) => "date:" + date));
  for (const day of observedDays) {
    if (!day.executed_at) sessionKeys.add("day:" + (day.day || day.title || sessionKeys.size));
  }
  if (op?.continuity?.active) {
    sessionKeys.add(op.continuity.active.day
      ? "day:" + op.continuity.active.day
      : "active:" + (op.continuity.active.activity || "session"));
  }
  const sessions = sessionKeys.size ? sessionKeys.size : null;
  const opTotal = n(opQuestions?.total);
  const legacyTotal = n(totals.done) ?? sumKnown(observedDays.map((day) => day.done));
  const opActivityQuestions = n(op?.continuity?.questions);
  const opHasQuestions = opTotal > 0 || opActivityQuestions > 0;
  const legacyHasQuestions = legacyTotal > 0 || observedDays.some((day) => day.executed_at && n(day.done) === 0);
  const useOperationalQuestions = opHasQuestions || (!legacyHasQuestions && Boolean(opQuestions));
  const hasQuestionEvidence = opHasQuestions || legacyHasQuestions;
  const operationalTotal = opTotal ?? opActivityQuestions ?? sumKnown(opByDate.map((row) => row.total));
  const questions = hasQuestionEvidence
    ? (useOperationalQuestions ? operationalTotal : legacyTotal)
    : null;
  const correct = hasQuestionEvidence
    ? (useOperationalQuestions ? n(opQuestions?.correct) : n(totals.correct) ?? sumKnown(observedDays.map((day) => day.correct)))
    : null;
  const errors = hasQuestionEvidence
    ? (useOperationalQuestions ? n(opQuestions?.errors) : n(totals.errors) ?? sumKnown(observedDays.map((day) => day.errors)))
    : null;
  const doubts = hasQuestionEvidence
    ? (useOperationalQuestions ? n(opQuestions?.doubts) : n(totals.doubts) ?? sumKnown(observedDays.map((day) => day.doubts)))
    : null;
  const recordedActivities = n(op?.continuity?.activities_with_evidence);
  const minutes = recordedActivities > 0
    ? n(op?.continuity?.minutes)
    : observedDays.length
      ? (n(totals.minutes) ?? sumKnown(observedDays.map((day) => day.minutes)))
      : null;
  const annulled = useOperationalQuestions
    ? n(opQuestions?.annulled) ?? sumKnown(opByDate.map((row) => row.annulled))
    : n(totals.annulled) ?? sumKnown(observedDays.map((day) => day.annulled));
  const effectiveQuestions = questions != null && annulled != null
    ? Math.max(0, questions - annulled)
    : questions;
  const legacyCountsValid = outcomeCountsReconcile(questions, correct, errors, annulled);
  const trustedCorrect = legacyCountsValid ? correct : null;
  const trustedErrors = legacyCountsValid ? errors : null;
  const evidence = evidenceClass(effectiveQuestions, sessions);
  const precision = legacyCountsValid ? pct(correct, effectiveQuestions) : null;
  const legacySeries = observedDays
    .filter((day) => day.executed_at && n(day.done) > 0)
    .map((day) => ({ date:day.executed_at, total:day.done, correct:day.correct, annulled:n(day.annulled) }));
  const trend = trendFromSeries(useOperationalQuestions ? opByDate : legacySeries, questions);

  // Editorial availability is not execution evidence.
  const readyUnits = editorialUnits.filter((unit) => unit.material_ready);
  const firstReady = readyUnits[0] || editorialUnits[0] || null;
  const activeActivity = op?.continuity?.active || null;
  const nextTrail = op?.trail?.sequence_valid === false ? null : op?.trail?.next || null;
  const isCompleted = (status) => /concluíd|dominad|dispensad|cancelad|realizad/i.test(status || "");
  const partial = observedDays.find((day) =>
    !isCompleted(day.status) &&
    (/em andamento|em execução/i.test(day.status || "") ||
      (n(day.done) > 0 && (n(day.progress) == null ? n(day.done) < n(day.planned) : n(day.progress) < 1)))
  );
  const canonicalAction = nextTrail ? {
    kind:"canonical",
    label:"PRÓXIMA AÇÃO",
    code:nextTrail.code,
    title:nextTrail.title,
    href:"portugues-rlm/" + String(nextTrail.code).toLowerCase() + "/",
    reason:"É a primeira posição da Ordem 1–37 sem D0 concluído. Material pronto não foi confundido com estudo realizado.",
    confidence:"alta",
    evidence:["Ordem canônica "+nextTrail.order, "D0 ainda não concluído"],
    impact:"Avança uma posição sem mexer nas revisões nem pular a sequência.",
    after_action:"Registrar a execução no Notion; a posição seguinte continua sendo a canônica.",
  } : op?.trail ? {
    kind:"wait", label:"SEM PRÓXIMA UNIDADE", code:null,
    title:op.trail.sequence_valid === false ? "Verificar a integridade da esteira" : "A esteira não informa uma próxima unidade",
    href:op.trail.sequence_valid === false ? "qualidade-dados/" : "trilha/",
    reason:op.trail.sequence_valid === false
      ? "A sequência operacional está inconsistente; o sistema não recomenda reiniciar em uma unidade editorial já publicada."
      : "Todas as posições ou estados de D0 foram lidos sem uma próxima unidade operacional explícita.",
    confidence:"não calculável", evidence:[op.trail.sequence_valid === false ? "sequência divergente" : "sem próxima unidade operacional"],
    impact:"Evita reabrir conteúdo já concluído ou avançar com uma ordem incerta.",
    after_action:op.trail.sequence_valid === false ? "Corrigir o registro da esteira no Notion e sincronizar novamente." : "Consultar a trilha e confirmar o próximo marco no Notion.",
  } : firstReady ? {
    kind:"canonical",
    label:"PRÓXIMA AÇÃO",
    code:firstReady.code,
    title:firstReady.title,
    href:"portugues-rlm/" + String(firstReady.code).toLowerCase() + "/",
    reason:"É a primeira unidade editorial disponível; ainda não há estado operacional suficiente da esteira.",
    confidence:"baixa",
    evidence:["Material editorial disponível", "Sem estado operacional suficiente"],
    impact:"Começa a coleta de evidência TJDFT sem presumir estudo anterior.",
    after_action:"Registrar a unidade e avançar pela Ordem 1–37.",
  } : {
    kind:"wait", label:"SEM AÇÃO AUTOMÁTICA", code:null, title:"Aguardando material e evidência",
    href:null, reason:"Não há material disponível suficiente para recomendar avanço.", confidence:"não calculável",
    evidence:[], impact:"Nenhum avanço automático.", after_action:"Aguardar material ou registro operacional."
  };
  const resumeAction = activeActivity ? {
    kind:"resume", label:"RETOMAR SESSÃO", code:activeActivity.day || null,
    title:activeActivity.next_action || activeActivity.activity || "Retomar atividade em andamento",
    href:"painel-legado/",
    reason:"Existe uma atividade marcada como em andamento no Notion. Conclua esta sessão antes de abrir conteúdo novo.",
    confidence:"alta",
    evidence:[activeActivity.state || activeActivity.status || "atividade em andamento", activeActivity.date || "sem data real de execução"],
    impact:"Conclui o que já foi iniciado e reduz dispersão.",
    after_action:"Depois da sessão: registrar o resultado e retomar a unidade canônica.",
  } : partial ? {
    kind:"resume", label:"RETOMAR UNIDADE", code:partial.day,
    title:partial.title, href:partial.href || "painel-legado/",
    reason:"Há execução parcial registrada. Continuidade prevalece sobre abrir conteúdo novo.",
    confidence:"alta",
    evidence:[partial.status || "registro parcial", n(partial.done) == null ? "questões feitas —" : n(partial.done)+" questões"],
    impact:"Finaliza a sessão parcial antes de iniciar outra unidade.",
    after_action:"Depois da conclusão: voltar à próxima posição canônica.",
  } : null;
  const listedErrors = op?.errors?.top || [];
  const activeErrors = listedErrors.filter((item) => !/resolvid|validado|arquivad|fechado/i.test(item.state || item.status || ""));
  const hasClosedErrorInActiveList = listedErrors.some((item) => /resolvid|validado|arquivad|fechado/i.test(item.state || item.status || ""));
  const rawErrorCount = n(op?.errors?.active_count);
  const rawErrorRecordsPresent = op?.errors?.records_present;
  const errorRecordsPresent = rawErrorRecordsPresent === true ||
    activeErrors.length > 0 || (rawErrorCount != null && rawErrorCount > 0)
    ? true
    : rawErrorRecordsPresent === false
    ? false
    : null;
  const errorCount = errorRecordsPresent === true && !hasClosedErrorInActiveList ? rawErrorCount : null;
  const criticalError = activeErrors.find((item) => /crític|\bP1\b/i.test(item.severity || ""));
  const recurrentError = activeErrors.find((item) => n(item.recurrence) >= 2);
  const today = localDateKey(now);
  const isReviewClosed = (review) => /concluíd|realizad|cancelad|dispensad/i.test((review?.status || "") + " " + (review?.state || ""));
  const dueReview = (op?.reviews?.dated || [])
    .filter((review) => review.date && !isReviewClosed(review) && ["vencida","hoje"].includes(reviewState(review.date, today)))
    .sort((a,b) => String(a.date).localeCompare(String(b.date)))[0] || null;
  let nextAction = resumeAction || canonicalAction;
  if (criticalError) {
    nextAction = {
      kind:"intervention", label:"CORRIGIR ERRO CRÍTICO",
      code:criticalError.topic || criticalError.subject || null,
      title:"Intervenção breve · " + (criticalError.topic || criticalError.subject || "erro crítico"),
      href:"erros/",
      reason:"Um erro crítico/P1 ativo exige correção antes de retomar a esteira.",
      confidence:"alta",
      evidence:[criticalError.severity, criticalError.recurrence ? "reincidência " + criticalError.recurrence : null, criticalError.action || criticalError.causes].filter(Boolean),
      impact:"Evita repetir um erro marcado como crítico no caderno ativo.",
      after_action:resumeAction ? "Depois da correção: " + resumeAction.title : "Depois da correção: " + canonicalAction.title,
    };
  } else if (!resumeAction && recurrentError && !(dueReview && trend.state === "melhora")) {
    nextAction = {
      kind:"intervention", label:"REVER ERRO RECORRENTE",
      code:recurrentError.topic || recurrentError.subject || null,
      title:"Revisão curta · " + (recurrentError.topic || recurrentError.subject || "erro recorrente"),
      href:"erros/",
      reason:"O caderno mantém um erro ativo com reincidência registrada.",
      confidence:"moderada",
      evidence:[recurrentError.severity, "reincidência " + recurrentError.recurrence, recurrentError.action || recurrentError.causes].filter(Boolean),
      impact:"Ataca a repetição antes de avançar para uma unidade nova.",
      after_action:"Depois da revisão: " + canonicalAction.title,
    };
  } else if (!resumeAction && dueReview) {
    nextAction = {
      kind:"intervention", label:"FAZER REVISÃO VENCIDA",
      code:dueReview.subject || null,
      title:"Revisar · " + (dueReview.title || dueReview.subject || "item da agenda"),
      href:"revisoes/",
      reason:"Há uma revisão marcada para " + reviewState(dueReview.date, today) + " no registro operacional.",
      confidence:"moderada",
      evidence:[dueReview.type || "revisão", dueReview.date, dueReview.origin].filter(Boolean),
      impact:"Recupera o item sinalizado na agenda sem alterar a Ordem 1–37.",
      after_action:"Depois da revisão: " + canonicalAction.title,
    };
  } else if (!resumeAction && recurrentError) {
    nextAction = {
      kind:"intervention", label:"REVER ERRO RECORRENTE",
      code:recurrentError.topic || recurrentError.subject || null,
      title:"Revisão curta · " + (recurrentError.topic || recurrentError.subject || "erro recorrente"),
      href:"erros/",
      reason:"O caderno mantém um erro ativo com reincidência registrada.",
      confidence:"moderada",
      evidence:[recurrentError.severity, "reincidência " + recurrentError.recurrence, recurrentError.action || recurrentError.causes].filter(Boolean),
      impact:"Ataca a repetição antes de avançar para uma unidade nova.",
      after_action:"Depois da revisão: " + canonicalAction.title,
    };
  } else if (!resumeAction && trend.state === "queda") {
    nextAction = {
      kind:"intervention", label:"VERIFICAR PIORA RECENTE",
      code:null, title:"Revisão curta da tendência",
      href:"desempenho/",
      reason:"A série de execuções reais mostra queda recente; confirme os tópicos antes de avançar.",
      confidence:"moderada",
      evidence:[trend.label, questions + " questões", trend.periods + " períodos datados"],
      impact:"Direciona atenção à queda observada sem reordenar a trilha.",
      after_action:"Depois de verificar a tendência: " + canonicalAction.title,
    };
  }

  const legacyQuestionData = dashboard.execution?.c01?.questions || null;
  const rawSubjects = useOperationalQuestions && opQuestions?.by_subject?.length
    ? opQuestions.by_subject
    : dashboard.execution?.c01?.subjects || [];
  const subjectDateRows = useOperationalQuestions
    ? opQuestions?.by_subject_date || []
    : legacyQuestionData?.by_subject_date || [];
  const subjectDateMap = new Map();
  for (const row of subjectDateRows) {
    const key = row.subject;
    if (!subjectDateMap.has(key)) subjectDateMap.set(key, []);
    subjectDateMap.get(key).push(row);
  }
  const performance = rawSubjects.map((row) => {
    const operationalRow = Object.hasOwn(row, "total");
    const rawTotal = operationalRow ? n(row.total) : n(row.done);
    const annulled = n(row.annulled);
    const q = rawTotal == null || annulled == null ? null : Math.max(0, rawTotal - annulled);
    const dateSeries = subjectDateMap.get(row.subject || row.key) || [];
    const datedSessions = new Set(dateSeries.map((item) => item.date).filter(Boolean)).size;
    const declaredSessions = n(row.sessions);
    const subjectSessions = datedSessions || (declaredSessions != null && declaredSessions > 0
      ? declaredSessions
      : rawSubjects.length === 1 && sessions != null ? sessions : null);
    const rowOutcomesValid = outcomeCountsReconcile(rawTotal, row.correct, row.errors, row.annulled);
    const rowCorrect = rowOutcomesValid ? n(row.correct) : null;
    const ev = evidenceClass(q, subjectSessions);
    const pr = rowCorrect == null ? null : pct(rowCorrect, q);
    const subjectTrend = dateSeries.length
      ? trendFromSeries(dateSeries, q)
      : rawSubjects.length === 1 ? trend : trendFromSeries([], q);
    return {
      subject:row.subject || row.key || "Sem matéria",
      questions:q,
      sessions:subjectSessions,
      correct:rowCorrect,
      errors:rowOutcomesValid ? n(row.errors) : null,
      doubts:n(row.doubts),
      precision:pr,
      evidence:ev,
      trend:subjectTrend,
    };
  }).filter((row) => row.questions !== 0 || row.sessions > 0);

  const rawCargoRows = useOperationalQuestions
    ? opQuestions?.by_cargo || []
    : legacyQuestionData?.by_cargo || [];
  const cargoDateRows = useOperationalQuestions
    ? opQuestions?.by_cargo_date || []
    : legacyQuestionData?.by_cargo_date || [];
  const cargoDateMap = new Map();
  for (const row of cargoDateRows) {
    if (!cargoDateMap.has(row.cargo)) cargoDateMap.set(row.cargo, []);
    cargoDateMap.get(row.cargo).push(row);
  }
  const cargoGroups = new Map();
  for (const row of rawCargoRows) {
    const name = row.cargo;
    if (!name) continue;
    if (!cargoGroups.has(name)) cargoGroups.set(name, []);
    cargoGroups.get(name).push(row);
  }
  const byCargo = Array.from(cargoGroups.entries()).map(([cargo, rows]) => {
    const dateSeries = cargoDateMap.get(cargo) || [];
    const rawTotals = rows.map((row) => n(row.total));
    const totalByCargo = sumKnown(rawTotals);
    const annulledByCargo = sumKnown(rows.map((row) => row.annulled));
    const effectiveTotals = rows.map((row) => {
      const total = n(row.total);
      const annulled = n(row.annulled);
      return total == null || annulled == null ? null : Math.max(0, total - annulled);
    });
    const q = sumKnown(effectiveTotals);
    const correctByCargo = sumKnown(rows.map((row) => row.correct));
    const errorsByCargo = sumKnown(rows.map((row) => row.errors));
    const outcomesValid = outcomeCountsReconcile(totalByCargo, correctByCargo, errorsByCargo, annulledByCargo);
    const declaredSessions = rows.length === 1 ? n(rows[0].sessions) : null;
    const sessionCount = dateSeries.length
      ? new Set(dateSeries.map((row) => row.date).filter(Boolean)).size
      : declaredSessions != null && declaredSessions > 0 ? declaredSessions : null;
    const cargoTrend = trendFromSeries(dateSeries, q);
    return {
      cargo,
      questions:q,
      correct:outcomesValid ? correctByCargo : null,
      precision:outcomesValid ? pct(correctByCargo, q) : null,
      sessions:sessionCount,
      evidence:evidenceClass(q, sessionCount),
      trend:cargoTrend,
    };
  });

  const strengths = performance.filter(p=>p.precision!=null && p.precision>=0.85 && ["moderate","strong"].includes(p.evidence.key) && ["melhora","estável"].includes(p.trend.state))
    .map(p=>({
      ...p,
      strengthTier:p.evidence.key==="strong" && p.precision>=0.90 ? "robusta" : "consistente",
      reason:"Precisão ≥85%, evidência ao menos moderada e tendência temporal estável ou em melhora.",
    }));
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
    tecnico:{matrix:techItems.length,produced:null,available:null,mapped:null,studied:null,evidence:null,practiced_questions:null,consolidated:null,subjects:[]},
    analista:{matrix:analystItems.length,produced:null,available:null,mapped:null,studied:null,evidence:null,practiced_questions:null,consolidated:null,subjects:[]},
  };
  const cargoCoverage = {
    tecnico:op?.coverage?.tecnico || fallbackCoverage.tecnico,
    analista:op?.coverage?.analista || fallbackCoverage.analista,
  };
  const techSubjects = new Set(cargoCoverage.tecnico.subjects || []);
  const commonSubjects = (cargoCoverage.analista.subjects || []).filter((subject) => techSubjects.has(subject));

  const componentLabels = {
    materials:"materiais",
    execution:"execução e desempenho",
    operational:"trilha, revisões e erros",
  };
  const componentSources = dashboard.source?.component_sources || {};
  const partialComponents = Object.entries(componentSources)
    .filter(([,origin]) => origin !== "notion")
    .map(([name]) => componentLabels[name] || name);
  const issues=[];
  if (!sequenceValid) issues.push({severity:"critical", code:"sequence-divergence", message:"A Ordem 1–37 diverge da sequência canônica."});
  if (!dashboard.source?.synced_at) issues.push({severity:"high",code:"snapshot-date-missing",message:"Snapshot operacional sem data de sincronização."});
  if (dashboard.source?.status === "fallback") issues.push({severity:"medium",code:"snapshot-fallback",message:"O site está usando snapshot de contingência; decisões devem ser lidas com cautela."});
  if (dashboard.source?.status === "partial" || partialComponents.length) {
    const detail = partialComponents.length ? partialComponents.join(", ") : "componentes operacionais";
    issues.push({severity:"high",code:"snapshot-partial",message:"Snapshot parcialmente atualizado pelo Notion: " + detail + " não têm leitura atual íntegra."});
  }
  if (!questions) issues.push({severity:"info",code:"execution-absent",message:"Sem questões respondidas suficientes; ausência não foi convertida em zero de desempenho."});
  if (!datedSessionKeys.size) issues.push({severity:"info",code:"real-date-absent",message:"Sem datas reais de resolução suficientes para calcular tendência."});
  if (sessions != null && sessions > datedSessionKeys.size) issues.push({severity:"medium",code:"execution-without-date",message:"Há execução registrada sem data real; ela conta como continuidade, mas não entra na tendência temporal."});
  if (questions != null && questions > 0 && !legacyCountsValid) issues.push({severity:"high",code:"incomplete-correction",message:"Há questões sem correção completa ou contagens que fechem; o sistema preservou o total, mas não calculou precisão."});
  if (questions != null && correct != null && errors != null && annulled != null && !legacyCountsValid) {
    issues.push({severity:"high",code:"question-total-sum",message:"Acertos, erros e anuladas não fecham com o total respondido."});
  }
  for (const d of executionDays) {
    const done=n(d.done), c=n(d.correct), e=n(d.errors);
    if (done!=null && c!=null && e!=null && c+e!==done) issues.push({severity:"high",code:"question-sum",message:`${d.day}: acertos + erros divergem do total executado.`});
    if (d.invalid_time === true || n(d.minutes)<0) issues.push({severity:"high",code:"negative-time",message:`${d.day}: tempo negativo.`});
  }
  if (n(op?.integrity?.duplicate_trail_orders) > 0) issues.push({severity:"critical",code:"duplicate-trail-order",message:"Há Ordem da esteira duplicada no Notion."});
  if (n(op?.integrity?.invalid_times) > 0) issues.push({severity:"high",code:"invalid-time",message:"Há tempo negativo em registros operacionais."});
  if (n(op?.integrity?.uncorrected_question_rows) > 0) issues.push({severity:"high",code:"uncorrected-questions",message:"Há questões marcadas como feitas sem resultado de correção."});
  if (n(op?.integrity?.unclassified_errors) > 0) issues.push({severity:"medium",code:"unclassified-errors",message:"Há registros no caderno de erros sem estado; não foram tratados como resolvidos nem como fragilidade ativa."});
  if (n(op?.integrity?.missing_trail_orders) > 0) issues.push({severity:"high",code:"missing-trail-order",message:"Há unidades sem posição explícita na esteira; a próxima unidade não pode ser recomendada com segurança."});
  if (lawRegression.length) issues.push({severity:"critical",code:"revoked-active",message:"Norma histórica/revogada reapareceu como ativa."});

  const risks=[
    ...activeErrors.filter((item)=>/Crítica|Alta/i.test(item.severity || "")).map((item)=>({
      severity:/Crítica/i.test(item.severity || "") ? "critical" : "high",
      title:item.topic || item.subject,
      detail:`Erro ${String(item.severity).toLowerCase()}${item.recurrence ? ` · reincidência ${item.recurrence}` : ""}.`,
      evidence:item.action || item.causes || "caderno de erros ativo",
    })),
    ...weaknesses.map((weakness)=>({severity:"high",title:weakness.subject,detail:weakness.reason,evidence:`${weakness.questions} questões · ${weakness.evidence.label}`})),
    ...performance.filter((row)=>row.trend.state==="queda").map((row)=>({severity:"high",title:row.subject+" · queda recente",detail:row.trend.label,evidence:row.questions+" questões · "+row.trend.periods+" períodos datados"})),
    ...(trend.state==="queda" ? [{severity:"high",title:"Queda recente de desempenho",detail:trend.label,evidence:questions+" questões · "+trend.periods+" períodos datados"}] : []),
    ...(dueReview ? [{severity:"medium",title:"Revisão "+reviewState(dueReview.date,today),detail:dueReview.title || dueReview.subject || "Revisão da agenda",evidence:dueReview.date}] : []),
    ...(!questions ? [{severity:"info",title:"Execução ainda sem evidência suficiente",detail:"O sistema não presume fraqueza nem domínio.",evidence:"ausência ≠ zero"}] : []),
  ];

  const formalSource = op?.reviews?.formal || units.filter((unit)=>String(unit.code).startsWith("REV")).map((unit)=>({
    code:unit.code,title:unit.title,order:unit.canonical_order,state:unit.study_state || "Não estudado",
  }));
  const reviews = formalSource.map((review)=>({
    code:review.code,
    title:review.title,
    order:review.order,
    materialReady:units.find((unit)=>unit.code===review.code)?.material_ready ?? true,
    status:review.state || "programada",
    due:review.date || null,
    state:reviewState(review.date,today,review.state),
  }));
  const datedReviews = (op?.reviews?.dated || []).map((review,index)=>({
    code:`${review.type || "REV"}-${index+1}`,
    type:review.type || "REVISÃO",
    title:review.title || review.subject || "Revisão",
    subject:review.subject || null,
    date:review.date || null,
    status:review.status || review.state || null,
    state:reviewState(review.date,today,review.status || review.state),
    origin:review.origin || null,
  }));
  const spacedReviews = units.flatMap((unit)=>[
    ...(unit.d0 === true && unit.d7 === false ? [{type:"D7",code:unit.code+"-D7",title:"D7 · "+unit.title,state:"programada",date:null,origin:unit.code}] : []),
    ...(unit.d0 === true && unit.d20 === false ? [{type:"D20",code:unit.code+"-D20",title:"D20 · "+unit.title,state:"programada",date:null,origin:unit.code}] : []),
  ]);
  const agenda=[
    ...datedReviews,
    ...spacedReviews,
    ...reviews.map((review)=>({
      type:"REV",code:review.code,title:review.title,state:review.state,date:review.due,
    })),
    ...(nextAction.code ? [{
      type:nextAction.kind==="resume" ? "CONTINUIDADE" : nextAction.kind==="intervention" ? "INTERVENÇÃO" : "UNIDADE",
      code:nextAction.code,title:nextAction.title,state:nextAction.kind==="resume" || nextAction.kind==="intervention" ? "hoje" : "próxima",date:null,
    }] : []),
  ];
  const agendaOrder={vencida:0,hoje:1,próxima:2,programada:3,"em andamento":4,concluída:5,dispensada:6,cancelada:7};
  agenda.sort((left,right)=>(agendaOrder[left.state] ?? 9)-(agendaOrder[right.state] ?? 9) || String(left.date || "9999").localeCompare(String(right.date || "9999")));

  const completedD0 = n(op?.trail?.checkpoints?.d0);
  const trailProgress = op?.trail?.total && completedD0 != null ? completedD0 / op.trail.total : null;

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
      sessions,questions:effectiveQuestions,attemptedQuestions:questions,annulled,correct:trustedCorrect,errors:trustedErrors,doubts,minutes,precision,evidence,
      trend:trend.label,
      trendDetail:trend,
      bySubject:performance,
      byCargo,
    },
    nextAction,strengths,weaknesses,risks,reviews,activeErrors,errorCount,errorRecordsPresent,
    coverage:{
      tecnico:cargoCoverage.tecnico,
      analista:cargoCoverage.analista,
      common:{matrix:commonSubjects.length,subjects:commonSubjects},
      laws:{active:activeLaws.length,historical:historicalLaws.length},
    },
    quality:{
      issues,ageHours,sourceSyncedAt:dashboard.source?.synced_at || null,
      sourceStatus:dashboard.source?.status || null,
      partialComponents,
      componentSources:dashboard.source?.component_sources || null,
      componentSyncedAt:dashboard.source?.component_synced_at || null,
      lawRegressionCount:lawRegression.length,
    },
    agenda,
    aliases:op?.aliases || {safe:[],ambiguous:[]},
    meta:{
      phase:dashboard.dashboard?.phase || "Pré-edital",
      editalReference:edital.version === "base-2022" || edital.kind === "historical-base" ? "Edital 2022 · base histórica" : edital.kind === "official" ? "Edital vigente configurado" : "referência editalícia não informada",
      editalOfficial:edital.editorialPolicy?.official === true,
      editalNote:edital.editorialPolicy?.note || "Situação editalícia sem confirmação no snapshot.",
      sourceTitle:dashboard.source?.title || "Notion",
      editorialReady:readyUnits.length,
      lawActive:activeLaws.length,
      jobs:dashboard.dashboard?.jobs ?? 2,
      operationalSchema:op?.schema_version || null,
    }
  };
}
