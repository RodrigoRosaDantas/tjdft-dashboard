
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTJDFTIntelligence, evidenceClass } from "../app/intelligence/tjdft-intelligence.mjs";

const seq=["P01","P02","P03","RL01","P04","REV01","P05","P06","RL02","P07","P08","REV02","P09","RL03","P10","P11","P12","REV03","RL04","P13","P14","P15","RL05","REV04","P16","P17","P18","RL06","RL07","REV05","RL08","RL09","RL10","RL11","RL12","REV06","RL13"];
const base=()=>({dashboard:{source:{synced_at:"2026-09-24T09:00:00Z"},dashboard:{phase:"pré-edital",jobs:2},execution:{c01:{days:[],totals:{},subjects:[]}}},portuguese:{sequence:seq,units:seq.map((code,i)=>({code,canonical_order:i+1,title:code,material_ready:i===0,internal_path:\`/portugues-rlm/\${code.toLowerCase()}/\`}))},laws:{laws:[]},edital:{items:[]}});

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
