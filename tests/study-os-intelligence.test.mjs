
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTJDFTIntelligence, evidenceClass } from "../app/intelligence/tjdft-intelligence.mjs";

const seq=["P01","P02","P03","RL01","P04","REV01","P05","P06","RL02","P07","P08","REV02","P09","RL03","P10","P11","P12","REV03","RL04","P13","P14","P15","RL05","REV04","P16","P17","P18","RL06","RL07","REV05","RL08","RL09","RL10","RL11","RL12","REV06","RL13"];
const base=()=>({dashboard:{source:{synced_at:"2026-09-24T09:00:00Z"},dashboard:{phase:"pré-edital",jobs:2},execution:{c01:{days:[],totals:{},subjects:[]}}},portuguese:{sequence:seq,units:seq.map((code,i)=>({code,canonical_order:i+1,title:code,material_ready:i===0,internal_path:`/portugues-rlm/${code.toLowerCase()}/`}))},laws:{laws:[]},edital:{items:[]}});

test("ausência não vira zero de desempenho",()=>{const m=buildTJDFTIntelligence(base(),"2026-09-24T10:00:00Z");assert.equal(m.execution.precision,null);assert.equal(m.strengths.length,0);assert.equal(m.weaknesses.length,0);});
test("3/3 permanece amostra muito pequena",()=>assert.equal(evidenceClass(3,1).key,"very-small"));
test("10 questões isoladas permanecem amostra pequena",()=>assert.equal(evidenceClass(10,1).key,"small"));
test("25 questões e duas sessões permitem amostra moderada",()=>assert.equal(evidenceClass(25,2).key,"moderate"));
test("60 questões e três sessões produzem amostra forte",()=>assert.equal(evidenceClass(60,3).key,"strong"));
test("material pronto não vira estudado",()=>{const m=buildTJDFTIntelligence(base());assert.equal(m.meta.editorialReady,1);assert.equal(m.coverage.tecnico.studied,null);});
test("ordem 1–37 é validada",()=>assert.equal(buildTJDFTIntelligence(base()).sequence.valid,true));
test("ordem divergente é risco de qualidade",()=>{const x=base();x.portuguese.sequence=[...seq].reverse();const m=buildTJDFTIntelligence(x);assert.equal(m.sequence.valid,false);assert.ok(m.quality.issues.some(i=>i.code==="sequence-divergence"));});
test("sessão parcial volta como RETOMAR",()=>{const x=base();x.dashboard.execution.c01.days=[{day:"P01",title:"P01",done:5,correct:4,errors:1,progress:.5,executed_at:"2026-09-24T10:00:00Z"}];const m=buildTJDFTIntelligence(x);assert.equal(m.nextAction.kind,"resume");});
test("amostra robusta pode sustentar força sem 100%",()=>{const x=base();x.dashboard.execution.c01.subjects=[{subject:"Português",done:60,correct:54,errors:6,doubts:0,rows:3}];const m=buildTJDFTIntelligence(x);assert.equal(m.strengths[0].subject,"Português");});
test("dados parciais não geram força",()=>{const x=base();x.dashboard.execution.c01.subjects=[{subject:"RLM",done:5,correct:5,errors:0,doubts:0,rows:1}];assert.equal(buildTJDFTIntelligence(x).strengths.length,0);});
test("fragilidade exige evidência mínima",()=>{const x=base();x.dashboard.execution.c01.subjects=[{subject:"RLM",done:10,correct:5,errors:5,doubts:0,rows:1}];assert.equal(buildTJDFTIntelligence(x).weaknesses.length,1);});
test("acertos + erros divergentes são auditados",()=>{const x=base();x.dashboard.execution.c01.days=[{day:"D1",done:10,correct:7,errors:2,progress:1,executed_at:"2026-09-24T10:00:00Z"}];assert.ok(buildTJDFTIntelligence(x).quality.issues.some(i=>i.code==="question-sum"));});
test("tempo negativo é auditado",()=>{const x=base();x.dashboard.execution.c01.days=[{day:"D1",done:1,correct:1,errors:0,minutes:-2,progress:1,executed_at:"2026-09-24T10:00:00Z"}];assert.ok(buildTJDFTIntelligence(x).quality.issues.some(i=>i.code==="negative-time"));});
test("snapshot envelhecido vira risco, não desempenho",()=>{const x=base();x.dashboard.source.synced_at="2026-09-20T00:00:00Z";const m=buildTJDFTIntelligence(x,"2026-09-24T10:00:00Z");assert.ok(m.risks.some(r=>r.title==="Sincronização envelhecida"));});
test("lei histórica não reaparece ativa",()=>{const x=base();x.laws.laws=[{code:"L24",record_kind:"historical",active:true}];assert.ok(buildTJDFTIntelligence(x).quality.issues.some(i=>i.code==="revoked-active"));});
test("REV permanece nas posições canônicas",()=>{const m=buildTJDFTIntelligence(base());assert.deepEqual(m.reviews.map(r=>r.code),["REV01","REV02","REV03","REV04","REV05","REV06"]);});
test("sem data real tendência é insuficiente",()=>assert.match(buildTJDFTIntelligence(base()).execution.trend,/insuficiente/));


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
    errors:{active_count:0,by_subject:[],top:[]},
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

test("zero erro ativo explícito não é confundido com ausência",()=>{
  const m=buildTJDFTIntelligence(operationalBase());
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
