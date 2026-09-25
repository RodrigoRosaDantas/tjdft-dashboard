
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTJDFTIntelligence, evidenceClass } from "../app/intelligence/tjdft-intelligence.mjs";

const seq=["P01","P02","P03","RL01","P04","REV01","P05","P06","RL02","P07","P08","REV02","P09","RL03","P10","P11","P12","REV03","RL04","P13","P14","P15","RL05","REV04","P16","P17","P18","RL06","RL07","REV05","RL08","RL09","RL10","RL11","RL12","REV06","RL13"];
const base=()=>({dashboard:{source:{synced_at:"2026-09-24T09:00:00Z"},dashboard:{phase:"pré-edital",jobs:2},execution:{c01:{days:[],totals:{},subjects:[]}}},portuguese:{sequence:seq,units:seq.map((code,i)=>({code,canonical_order:i+1,title:code,material_ready:i===0,internal_path:`/portugues-rlm/${code.toLowerCase()}/`}))},laws:{laws:[]},edital:{items:[]}});

test("ausência não vira zero de desempenho",()=>{const m=buildTJDFTIntelligence(base(),"2026-09-24T10:00:00Z");assert.equal(m.execution.precision,null);assert.equal(m.strengths.length,0);assert.equal(m.weaknesses.length,0);});
test("modelo sem sessão operacional renderiza sem fabricar execução",()=>{const m=buildTJDFTIntelligence(base());assert.equal(m.execution.sessions,null);assert.equal(m.execution.questions,null);assert.equal(m.execution.precision,null);});
test("3/3 permanece amostra muito pequena",()=>assert.equal(evidenceClass(3,1).key,"very-small"));
test("10 questões isoladas permanecem amostra pequena",()=>assert.equal(evidenceClass(10,1).key,"small"));
test("25 questões e duas sessões permitem amostra moderada",()=>assert.equal(evidenceClass(25,2).key,"moderate"));
test("60 questões e três sessões produzem amostra forte",()=>assert.equal(evidenceClass(60,3).key,"strong"));
test("material pronto não vira estudado",()=>{const m=buildTJDFTIntelligence(base());assert.equal(m.meta.editorialReady,1);assert.equal(m.coverage.tecnico.studied,null);});
test("ordem 1–37 é validada",()=>assert.equal(buildTJDFTIntelligence(base()).sequence.valid,true));
test("ordem divergente é risco de qualidade",()=>{const x=base();x.portuguese.sequence=[...seq].reverse();const m=buildTJDFTIntelligence(x);assert.equal(m.sequence.valid,false);assert.ok(m.quality.issues.some(i=>i.code==="sequence-divergence"));});
test("sessão parcial volta como RETOMAR",()=>{const x=base();x.dashboard.execution.c01.days=[{day:"P01",title:"P01",done:5,correct:4,errors:1,progress:.5,executed_at:"2026-09-24T10:00:00Z"}];const m=buildTJDFTIntelligence(x);assert.equal(m.nextAction.kind,"resume");});
test("amostra robusta pode sustentar força sem 100% quando a série confirma consistência",()=>{
  const x=base();
  x.dashboard.execution.c01.totals={done:60,correct:54,errors:6,annulled:0,doubts:0,minutes:null};
  x.dashboard.execution.c01.subjects=[{subject:"Português",done:60,correct:54,errors:6,doubts:0,annulled:0,sessions:3,rows:3}];
  x.dashboard.execution.c01.questions={by_subject_date:[
    {subject:"Português",date:"2026-09-20",total:20,correct:18,errors:2,annulled:0},
    {subject:"Português",date:"2026-09-21",total:20,correct:18,errors:2,annulled:0},
    {subject:"Português",date:"2026-09-22",total:20,correct:18,errors:2,annulled:0},
  ]};
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.strengths[0].subject,"Português");
  assert.equal(m.strengths[0].strengthTier,"robusta");
});
test("amostra agregada sem tendência não gera força",()=>{
  const x=base();
  x.dashboard.execution.c01.subjects=[{subject:"Português",done:60,correct:55,errors:5,annulled:0,sessions:3,rows:3}];
  assert.equal(buildTJDFTIntelligence(x).strengths.length,0);
});
test("dados parciais não geram força",()=>{const x=base();x.dashboard.execution.c01.subjects=[{subject:"RLM",done:5,correct:5,errors:0,doubts:0,rows:1}];assert.equal(buildTJDFTIntelligence(x).strengths.length,0);});
test("fragilidade exige evidência mínima",()=>{const x=base();x.dashboard.execution.c01.subjects=[{subject:"RLM",done:10,correct:5,errors:5,doubts:0,annulled:0,rows:1}];assert.equal(buildTJDFTIntelligence(x).weaknesses.length,1);});
test("acertos + erros divergentes são auditados",()=>{const x=base();x.dashboard.execution.c01.days=[{day:"D1",done:10,correct:7,errors:2,progress:1,executed_at:"2026-09-24T10:00:00Z"}];assert.ok(buildTJDFTIntelligence(x).quality.issues.some(i=>i.code==="question-sum"));});
test("tempo negativo é auditado",()=>{const x=base();x.dashboard.execution.c01.days=[{day:"D1",done:1,correct:1,errors:0,minutes:-2,progress:1,executed_at:"2026-09-24T10:00:00Z"}];assert.ok(buildTJDFTIntelligence(x).quality.issues.some(i=>i.code==="negative-time"));});
test("idade do conteúdo não vira risco de sync sem evidência de fallback",()=>{const x=base();x.dashboard.source.synced_at="2026-09-20T00:00:00Z";x.dashboard.source.status="synced";const m=buildTJDFTIntelligence(x,"2026-09-24T10:00:00Z");assert.equal(m.risks.some(r=>r.title==="Sincronização envelhecida"),false);});
test("fallback explícito vira observação de qualidade",()=>{const x=base();x.dashboard.source.status="fallback";const m=buildTJDFTIntelligence(x);assert.ok(m.quality.issues.some(i=>i.code==="snapshot-fallback"));});
test("snapshot parcial identifica dados não atualizados e gera alerta de qualidade",()=>{
  const x=operationalBase();
  x.dashboard.source.status="partial";
  x.dashboard.source.component_sources={materials:"notion",execution:"snapshot",operational:"notion"};
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.quality.sourceStatus,"partial");
  assert.deepEqual(m.quality.partialComponents,["execução e desempenho"]);
  assert.ok(m.quality.issues.some(i=>i.code==="snapshot-partial" && /execução e desempenho/.test(i.message)));
});
test("lei histórica não reaparece ativa",()=>{const x=base();x.laws.laws=[{code:"L24",record_kind:"historical",active:true}];assert.ok(buildTJDFTIntelligence(x).quality.issues.some(i=>i.code==="revoked-active"));});
test("REV permanece nas posições canônicas",()=>{const m=buildTJDFTIntelligence(base());assert.deepEqual(m.reviews.map(r=>r.code),["REV01","REV02","REV03","REV04","REV05","REV06"]);});
test("sem execução registrada não há contagem fabricada de sessões",()=>{const m=buildTJDFTIntelligence(base());assert.equal(m.execution.sessions,null);assert.match(m.execution.trend,/insuficiente/);});


function operationalBase() {
  const x=base();
  x.dashboard.operational={
    schema_version:2,
    trail:{
      total:37,sequence_valid:true,
      checkpoints:{d0:0,d7:0,d20:0},
      status_counts:{"Não estudado":37},
      items:seq.map((code,index)=>({code,title:code,order:index+1,state:"Não estudado",material_ready:true,d0:false,d7:false,d20:false})),
      next:{code:"P01",title:"P01",order:1,state:"Não estudado",d0:false},
    },
    continuity:{active:null,activities_with_evidence:0,minutes:0,questions:0},
    questions:{total:0,correct:0,errors:0,doubts:0,annulled:0,precision:null,by_subject:[],by_cargo:[],by_date:[]},
    errors:{records_present:false,active_count:null,by_subject:[],top:[]},
    reviews:{dated:[],formal:seq.filter(code=>code.startsWith("REV")).map((code)=>({code,title:code,order:seq.indexOf(code)+1,state:"Não estudado"}))},
    coverage:{
      tecnico:{matrix:12,mapped:0,studied:0,consolidated:0,practiced_questions:0,subjects:["Língua Portuguesa","Direito Administrativo"]},
      analista:{matrix:9,mapped:0,studied:0,consolidated:0,practiced_questions:0,subjects:["Língua Portuguesa","Administração Geral"]},
      cargos:["Técnico","Analista"],
    },
    integrity:{duplicate_trail_orders:0,invalid_times:0,sequence_valid:true},
    aliases:{safe:[{alias:"portugues",canonical:"Língua Portuguesa"}],ambiguous:[]},
  };
  return x;
}

test("D0 concluído avança para a próxima posição canônica",()=>{
  const x=operationalBase();
  x.dashboard.operational.trail.items[0].d0=true;
  x.dashboard.operational.trail.checkpoints.d0=1;
  x.dashboard.operational.trail.next=x.dashboard.operational.trail.items[1];
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.nextAction.code,"P02");
  assert.equal(m.trail.d0,1);
});

test("atividade em andamento prevalece sobre próxima unidade",()=>{
  const x=operationalBase();
  x.dashboard.operational.continuity.active={activity:"Questões de Português",day:"D01",state:"Em andamento",next_action:"Concluir bloco de questões"};
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.nextAction.kind,"resume");
  assert.equal(m.nextAction.code,"D01");
});

test("ausência de registros no Caderno não vira zero erro ativo",()=>{
  const m=buildTJDFTIntelligence(operationalBase());
  assert.equal(m.errorRecordsPresent,false);
  assert.equal(m.errorCount,null);
  assert.equal(m.activeErrors.length,0);
});

test("snapshot legado com zero e sem evidência de registros mantém presença desconhecida",()=>{
  const x=operationalBase();
  x.dashboard.operational.errors={active_count:0,by_subject:[],top:[]};
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.errorRecordsPresent,null);
  assert.equal(m.errorCount,null);
});

test("zero erro ativo requer registros classificados no Caderno",()=>{
  const x=operationalBase();
  x.dashboard.operational.errors={records_present:true,active_count:0,by_subject:[],top:[]};
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.errorRecordsPresent,true);
  assert.equal(m.errorCount,0);
  assert.equal(m.activeErrors.length,0);
});

test("erro crítico ativo vira risco prioritário",()=>{
  const x=operationalBase();
  x.dashboard.operational.errors={active_count:1,by_subject:[{subject:"Português",count:1}],top:[{state:"Aberto",subject:"Língua Portuguesa",topic:"Crase",severity:"Crítica",recurrence:2,action:"Revisar fonte"}]};
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.risks[0].severity,"critical");
  assert.match(m.risks[0].title,/Crase/);
});

test("revisão datada é classificada como vencida, hoje ou próxima",()=>{
  const x=operationalBase();
  x.dashboard.operational.reviews.dated=[
    {type:"ERRO",title:"A",subject:"Português",date:"2026-09-23T12:00:00.000Z"},
    {type:"QUESTÃO",title:"B",subject:"RLM",date:"2026-09-24T12:00:00.000Z"},
    {type:"QUESTÃO",title:"C",subject:"RLM",date:"2026-09-25T12:00:00.000Z"},
  ];
  const m=buildTJDFTIntelligence(x,"2026-09-24T10:00:00-03:00");
  assert.deepEqual(m.agenda.filter(item=>item.date).map(item=>item.state),["vencida","hoje","próxima"]);
});

test("cobertura de Técnico e Analista permanece isolada",()=>{
  const x=operationalBase();
  x.dashboard.operational.coverage.tecnico={...x.dashboard.operational.coverage.tecnico,studied:3,consolidated:1,practiced_questions:20};
  x.dashboard.operational.coverage.analista={...x.dashboard.operational.coverage.analista,studied:1,consolidated:0,practiced_questions:4};
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.coverage.tecnico.studied,3);
  assert.equal(m.coverage.analista.studied,1);
  assert.equal(m.coverage.common.subjects.includes("Língua Portuguesa"),true);
  assert.equal(m.coverage.common.subjects.includes("Direito Administrativo"),false);
});

test("tendência só aparece com série temporal minimamente robusta",()=>{
  const x=operationalBase();
  x.dashboard.operational.questions={
    total:32,correct:27,errors:5,doubts:0,annulled:0,precision:27/32,
    by_subject:[{subject:"Língua Portuguesa",total:32,correct:27,errors:5,doubts:0,annulled:0}],
    by_cargo:[],
    by_date:[
      {date:"2026-09-20",total:8,correct:6,errors:2,annulled:0},
      {date:"2026-09-21",total:8,correct:6,errors:2,annulled:0},
      {date:"2026-09-22",total:8,correct:7,errors:1,annulled:0},
      {date:"2026-09-23",total:8,correct:8,errors:0,annulled:0},
    ],
  };
  const m=buildTJDFTIntelligence(x);
  assert.notEqual(m.execution.trend,"amostra temporal insuficiente");
  assert.equal(m.execution.trendDetail.state,"melhora");
});

test("alias seguro é exposto sem criar fusão ambígua",()=>{
  const m=buildTJDFTIntelligence(operationalBase());
  assert.equal(m.aliases.safe[0].canonical,"Língua Portuguesa");
  assert.deepEqual(m.aliases.ambiguous,[]);
});

test("campos nulos e vazios continuam ausentes, sem virar zero",()=>{
  const x=base();
  x.dashboard.execution.c01.totals={done:null,correct:"",errors:undefined,doubts:null,minutes:null};
  x.dashboard.execution.c01.days=[{day:"D01",status:"Planejado",planned:8,done:null,correct:null,errors:null,doubts:null,minutes:null,progress:null,executed_at:null}];
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.execution.questions,null);
  assert.equal(m.execution.correct,null);
  assert.equal(m.execution.errors,null);
  assert.equal(m.execution.minutes,null);
  assert.equal(m.execution.evidence.key,"none");
});

test("zeros planejados sem data ou estado de execução continuam ausentes",()=>{
  const x=base();
  x.dashboard.execution.c01.totals={done:0,correct:0,errors:0,doubts:0,minutes:0,annulled:0};
  x.dashboard.execution.c01.days=[
    {day:"D01",status:"Próximo",planned:8,done:0,correct:0,errors:0,doubts:0,minutes:0,progress:0,executed_at:null},
    {day:"D02",status:"Planejado",planned:8,done:0,correct:0,errors:0,doubts:0,minutes:0,progress:0,executed_at:null},
  ];
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.execution.questions,null);
  assert.equal(m.execution.correct,null);
  assert.equal(m.execution.errors,null);
  assert.equal(m.execution.minutes,null);
  assert.equal(m.execution.precision,null);
});

test("zero exportado sem sessão nem resposta não aparece como desempenho",()=>{
  const x=operationalBase();
  x.dashboard.operational.questions={total:0,correct:0,errors:0,doubts:0,precision:null,by_subject:[],by_date:[]};
  x.dashboard.operational.continuity={active:null,activities_with_evidence:0,minutes:0,questions:0};
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.execution.questions,null);
  assert.equal(m.execution.correct,null);
  assert.equal(m.execution.minutes,null);
});

test("sessão real sem questões permanece amostra muito pequena, sem inventar erros",()=>{
  const x=base();
  x.dashboard.execution.c01.days=[{day:"D01",status:"Concluído",planned:8,done:0,correct:null,errors:null,doubts:null,minutes:null,progress:0,executed_at:"2026-09-24T12:00:00Z"}];
  x.dashboard.execution.c01.totals={done:0,correct:null,errors:null,doubts:null,minutes:null,annulled:null};
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.execution.questions,0);
  assert.equal(m.execution.sessions,1);
  assert.equal(m.execution.evidence.key,"very-small");
  assert.equal(m.execution.correct,null);
  assert.equal(m.execution.errors,null);
});

test("erro P1 crítico interrompe até uma sessão iniciada e registra retorno",()=>{
  const x=operationalBase();
  x.dashboard.operational.continuity.active={activity:"P01",day:"P01",state:"Em andamento"};
  x.dashboard.operational.errors={active_count:1,top:[{state:"Aberto",subject:"Português",topic:"Crase",severity:"P1",recurrence:1,action:"Rever regra"}]};
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.nextAction.kind,"intervention");
  assert.match(m.nextAction.label,/CRÍTICO/);
  assert.match(m.nextAction.after_action,/P01/);
  assert.ok(m.nextAction.evidence.includes("P1"));
});

test("erro reincidente eleva prioridade antes da próxima unidade",()=>{
  const x=operationalBase();
  x.dashboard.operational.errors={active_count:1,top:[{state:"Aberto",subject:"RLM",topic:"Proposições",severity:"Média",recurrence:3}]};
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.nextAction.label,"REVER ERRO RECORRENTE");
  assert.match(m.nextAction.reason,/reincidência/);
  assert.equal(m.sequence.units[0].code,"P01");
});

test("melhora recente reduz a prioridade relativa do erro reincidente frente à revisão vencida",()=>{
  const x=operationalBase();
  x.dashboard.operational.errors={active_count:1,top:[{state:"Aberto",subject:"RLM",topic:"Proposições",severity:"Média",recurrence:3}]};
  x.dashboard.operational.reviews.dated=[{type:"REV",title:"Revisão vencida",subject:"Português",date:"2026-09-23"}];
  x.dashboard.operational.questions={
    total:32,correct:27,errors:5,doubts:0,annulled:0,precision:27/32,
    by_subject:[{subject:"Português",total:32,correct:27,errors:5,doubts:0,annulled:0,sessions:4}],
    by_date:[
      {date:"2026-09-20",total:8,correct:6,errors:2,annulled:0},
      {date:"2026-09-21",total:8,correct:6,errors:2,annulled:0},
      {date:"2026-09-22",total:8,correct:7,errors:1,annulled:0},
      {date:"2026-09-23",total:8,correct:8,errors:0,annulled:0},
    ],
  };
  const m=buildTJDFTIntelligence(x,"2026-09-24T10:00:00-03:00");
  assert.equal(m.execution.trendDetail.state,"melhora");
  assert.equal(m.nextAction.label,"FAZER REVISÃO VENCIDA");
});

test("revisão vencida entra na decisão e revisão concluída sai da fila prioritária",()=>{
  const x=operationalBase();
  x.dashboard.operational.reviews.dated=[
    {type:"QUESTÃO",title:"A",subject:"Português",date:"2026-09-23"},
    {type:"QUESTÃO",title:"B",subject:"RLM",date:"2026-09-22",status:"Concluído"},
  ];
  const m=buildTJDFTIntelligence(x,"2026-09-24T12:00:00-03:00");
  assert.equal(m.nextAction.label,"FAZER REVISÃO VENCIDA");
  assert.equal(m.agenda.find(item=>item.title==="B")?.state,"concluída");
});

test("sessão iniciada prevalece sobre erro recorrente e revisão vencida",()=>{
  const x=operationalBase();
  x.dashboard.operational.continuity.active={activity:"P01",day:"P01",state:"Em andamento"};
  x.dashboard.operational.errors={active_count:1,top:[{state:"Aberto",topic:"Crase",severity:"Média",recurrence:3}]};
  x.dashboard.operational.reviews.dated=[{type:"REV",title:"Revisar",date:"2026-09-23"}];
  assert.equal(buildTJDFTIntelligence(x,"2026-09-24T12:00:00-03:00").nextAction.kind,"resume");
});

test("queda real eleva atenção e bloqueia força baseada em agregado",()=>{
  const x=operationalBase();
  x.dashboard.operational.questions={
    total:60,correct:54,errors:6,doubts:0,annulled:0,precision:.9,
    by_subject:[{subject:"Português",total:60,correct:54,errors:6,doubts:0,annulled:0,sessions:4}],
    by_date:[
      {date:"2026-09-20",total:15,correct:14,errors:1,annulled:0},
      {date:"2026-09-21",total:15,correct:14,errors:1,annulled:0},
      {date:"2026-09-22",total:15,correct:9,errors:6,annulled:0},
      {date:"2026-09-23",total:15,correct:9,errors:6,annulled:0},
    ],
  };
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.execution.trendDetail.state,"queda");
  assert.equal(m.strengths.length,0);
  assert.equal(m.nextAction.label,"VERIFICAR PIORA RECENTE");
  assert.ok(m.risks.some(risk=>risk.title==="Queda recente de desempenho"));
});

test("data planejada nunca alimenta tendência de execução",()=>{
  const x=base();
  x.dashboard.execution.c01.days=[
    {day:"D01",status:"Concluído",planned:8,done:8,correct:8,errors:0,progress:1,planned_at:"2026-09-20",executed_at:null},
    {day:"D02",status:"Concluído",planned:8,done:8,correct:8,errors:0,progress:1,planned_at:"2026-09-21",executed_at:null},
    {day:"D03",status:"Concluído",planned:8,done:8,correct:8,errors:0,progress:1,planned_at:"2026-09-22",executed_at:null},
  ];
  x.dashboard.execution.c01.totals={done:24,correct:24,errors:0,doubts:null,minutes:null};
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.execution.sessions,3);
  assert.match(m.execution.trend,/insuficiente/);
  assert.equal(m.execution.trendDetail.periods,0);
  assert.ok(m.quality.issues.some((issue)=>issue.code==="execution-without-date"));
});

test("execução sem data conta como continuidade, não como tendência",()=>{
  const x=base();
  x.dashboard.execution.c01.days=[{day:"D01",status:"Concluído",done:10,correct:8,errors:2,annulled:0,progress:1,executed_at:null}];
  x.dashboard.execution.c01.totals={done:10,correct:8,errors:2,annulled:0,doubts:null,minutes:null};
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.execution.sessions,1);
  assert.equal(m.execution.trendDetail.periods,0);
  assert.ok(m.quality.issues.some((issue)=>issue.code==="execution-without-date"));
});

test("D7 e D20 aparecem depois de D0 sem receber data inventada",()=>{
  const x=operationalBase();
  x.dashboard.operational.trail.items[0].d0=true;
  x.dashboard.operational.trail.items[0].d7=false;
  x.dashboard.operational.trail.items[0].d20=false;
  const m=buildTJDFTIntelligence(x);
  assert.ok(m.agenda.some(item=>item.code==="P01-D7"&&item.date===null&&item.state==="programada"));
  assert.ok(m.agenda.some(item=>item.code==="P01-D20"&&item.date===null&&item.state==="programada"));
});

test("erro fechado sai das fragilidades e invalida uma contagem contraditória",()=>{
  const x=operationalBase();
  x.dashboard.operational.errors={records_present:true,active_count:1,top:[{state:"Resolvido",subject:"Português",topic:"Crase",severity:"Crítica",recurrence:4}]};
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.activeErrors.length,0);
  assert.equal(m.errorCount,null);
  assert.equal(m.risks.some(risk=>risk.title==="Crase"),false);
});

test("edital histórico é identificado sem se chamar edital atual",()=>{
  const m=buildTJDFTIntelligence({...base(),edital:{version:"base-2022",kind:"historical-base",editorialPolicy:{official:false,note:"Pré-edital; base histórica."}}});
  assert.equal(m.meta.editalReference,"Edital 2022 · base histórica");
  assert.equal(m.meta.editalOfficial,false);
});

test("esteira sem próxima unidade não recicla P01",()=>{
  const x=operationalBase();
  x.dashboard.operational.trail.items.forEach((item)=>{item.d0=true;});
  x.dashboard.operational.trail.checkpoints.d0=37;
  x.dashboard.operational.trail.next=null;
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.nextAction.kind,"wait");
  assert.equal(m.nextAction.code,null);
  assert.equal(m.nextAction.href,"trilha/");
});

test("sequência operacional inválida bloqueia recomendação da próxima unidade",()=>{
  const x=operationalBase();
  x.dashboard.operational.trail.sequence_valid=false;
  x.dashboard.operational.trail.next={code:"P03",title:"P03",order:3,d0:false};
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.nextAction.kind,"wait");
  assert.equal(m.nextAction.href,"qualidade-dados/");
});

test("tendência por matéria usa datas reais e pode divergir da visão geral",()=>{
  const x=operationalBase();
  x.dashboard.operational.questions={
    total:152,correct:136,errors:16,doubts:0,annulled:0,precision:136/152,
    by_subject:[
      {subject:"Língua Portuguesa",total:120,correct:114,errors:6,doubts:0,annulled:0,sessions:4},
      {subject:"Raciocínio Lógico-Matemático",total:32,correct:28,errors:4,doubts:0,annulled:0,sessions:4},
    ],
    by_cargo:[],
    by_date:[
      {date:"2026-09-20",total:38,correct:32,errors:6,annulled:0},
      {date:"2026-09-21",total:38,correct:32,errors:6,annulled:0},
      {date:"2026-09-22",total:38,correct:36,errors:2,annulled:0},
      {date:"2026-09-23",total:38,correct:36,errors:2,annulled:0},
    ],
    by_subject_date:[
      {subject:"Língua Portuguesa",date:"2026-09-20",total:30,correct:24,errors:6,annulled:0},
      {subject:"Língua Portuguesa",date:"2026-09-21",total:30,correct:24,errors:6,annulled:0},
      {subject:"Língua Portuguesa",date:"2026-09-22",total:30,correct:30,errors:0,annulled:0},
      {subject:"Língua Portuguesa",date:"2026-09-23",total:30,correct:30,errors:0,annulled:0},
      {subject:"Raciocínio Lógico-Matemático",date:"2026-09-20",total:8,correct:8,errors:0,annulled:0},
      {subject:"Raciocínio Lógico-Matemático",date:"2026-09-21",total:8,correct:8,errors:0,annulled:0},
      {subject:"Raciocínio Lógico-Matemático",date:"2026-09-22",total:8,correct:6,errors:2,annulled:0},
      {subject:"Raciocínio Lógico-Matemático",date:"2026-09-23",total:8,correct:6,errors:2,annulled:0},
    ],
  };
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.execution.trendDetail.state,"melhora");
  assert.equal(m.execution.bySubject.find((row)=>row.subject==="Raciocínio Lógico-Matemático").trend.state,"queda");
  assert.equal(m.strengths.some((row)=>row.subject==="Língua Portuguesa"),true);
  assert.equal(m.strengths.some((row)=>row.subject==="Raciocínio Lógico-Matemático"),false);
  assert.ok(m.risks.some((risk)=>risk.title.includes("Raciocínio Lógico-Matemático · queda")));
});

test("resultados por Técnico e Analista permanecem separados",()=>{
  const x=operationalBase();
  x.dashboard.operational.questions={
    total:120,correct:108,errors:12,doubts:0,annulled:0,precision:.9,
    by_subject:[],by_date:[],
    by_cargo:[
      {cargo:"Técnico Judiciário — Área Administrativa",total:40,correct:32,errors:8,doubts:0,annulled:0,sessions:3},
      {cargo:"Analista Judiciário — Área Administrativa",total:80,correct:76,errors:4,doubts:0,annulled:0,sessions:4},
    ],
  };
  const m=buildTJDFTIntelligence(x);
  const tech=m.execution.byCargo.find((row)=>row.cargo.startsWith("Técnico"));
  const analyst=m.execution.byCargo.find((row)=>row.cargo.startsWith("Analista"));
  assert.deepEqual([tech.questions,tech.correct,tech.precision],[40,32,.8]);
  assert.deepEqual([analyst.questions,analyst.correct,analyst.precision],[80,76,.95]);
});

test("sem total de anuladas conhecido não há precisão por disciplina",()=>{
  const x=base();
  x.dashboard.execution.c01.totals={done:60,correct:55,errors:5,doubts:null,minutes:null};
  x.dashboard.execution.c01.subjects=[{subject:"Português",done:60,correct:55,errors:5,sessions:4}];
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.execution.precision,null);
  assert.equal(m.execution.bySubject[0].questions,null);
  assert.equal(m.execution.bySubject[0].precision,null);
  assert.equal(m.strengths.length,0);
});

test("questões anuladas fecham o total bruto e saem da precisão",()=>{
  const x=operationalBase();
  x.dashboard.operational.questions={
    total:12,correct:8,errors:3,doubts:null,annulled:1,precision:8/11,
    by_subject:[{subject:"Português",total:12,correct:8,errors:3,annulled:1,sessions:2}],
    by_cargo:[],by_date:[],
  };
  const m=buildTJDFTIntelligence(x);
  assert.equal(m.execution.questions,11);
  assert.equal(m.execution.attemptedQuestions,12);
  assert.equal(m.execution.annulled,1);
  assert.equal(m.execution.precision,8/11);
  assert.equal(m.execution.bySubject[0].questions,11);
  assert.equal(m.execution.bySubject[0].precision,8/11);
});

test("tempo negativo preservado como inválido continua visível após normalização",()=>{
  const x=base();
  x.dashboard.execution.c01.days=[{day:"D01",status:"Concluído",done:null,correct:null,errors:null,minutes:null,invalid_time:true}];
  assert.ok(buildTJDFTIntelligence(x).quality.issues.some((issue)=>issue.code==="negative-time"));
});
