
import type { ReactNode } from "react";
import { getStudyOsModel } from "./study-os-model";

type View = "home"|"hoje"|"mentor"|"trilha"|"agenda"|"revisoes"|"erros"|"desempenho"|"riscos"|"tecnico"|"analista"|"qualidade"|"sincronizacao";

const labels: Record<View,string> = {
  home:"Início", hoje:"Hoje", mentor:"Mentor", trilha:"Trilha", agenda:"Agenda", revisoes:"Revisões",
  erros:"Caderno de erros", desempenho:"Desempenho", riscos:"Riscos", tecnico:"Técnico", analista:"Analista",
  qualidade:"Qualidade dos dados", sincronizacao:"Sincronização",
};

function percent(v:number|null){ return v==null ? "—" : `${Math.round(v*100)}%`; }
function count(v:number|null|undefined){ return v==null ? "—" : String(v); }
function shortDate(v:string|null|undefined){
  if(!v) return "data —";
  const date=new Date(v);
  return Number.isNaN(date.valueOf()) ? "data —" : new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeZone:"America/Sao_Paulo"}).format(date);
}
function route(root:boolean, slug:string){ return root ? `./${slug}/` : `../${slug}/`; }

function Metric({label,value,detail}:{label:string;value:string|number;detail:string}) {
  return <article className="os-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}
function Notice({children}:{children:ReactNode}) { return <div className="os-notice">{children}</div>; }

export default function StudyOsPage({view,root=false}:{view:View;root?:boolean}) {
  const m=getStudyOsModel();
  const base = root ? "./" : "../";
  const nav: Array<[View,string]> = [
    ["hoje","hoje"],["mentor","mentor"],["trilha","trilha"],["agenda","agenda"],["revisoes","revisoes"],
    ["erros","erros"],["desempenho","desempenho"],["riscos","riscos"],["tecnico","tecnico"],["analista","analista"],
    ["qualidade","qualidade-dados"],["sincronizacao","sincronizacao"],
  ];
  const actionHref = m.nextAction?.href ? (root ? `./${m.nextAction.href}` : `../${m.nextAction.href}`) : route(root,"portugues-rlm");
  return <main className="study-os">
    <header className="os-topbar">
      <a className="os-brand" href={base}><b>TJDFT</b><span>Study OS</span></a>
      <nav aria-label="Navegação operacional">
        {nav.map(([id,slug])=><a key={id} className={view===id?"active":""} href={route(root,slug)}>{labels[id]}</a>)}
        <a href={route(root,"leis")}>Leis</a><a href={route(root,"portugues-rlm")}>Português + RLM</a>
      </nav>
    </header>

    <section className="os-hero">
      <div><p className="os-kicker">TJDFT · TÉCNICO + ANALISTA · {m.meta.phase}</p>
      <h1>{view==="home"?"Central de comando":labels[view]}</h1>
      <p>Notion é a fonte operacional. O site interpreta apenas evidências disponíveis; ausência nunca vira zero, fraqueza ou domínio.</p></div>
      <div className="os-source"><span>Fonte</span><strong>{m.meta.sourceTitle}</strong><small>{m.quality.sourceSyncedAt ? new Date(m.quality.sourceSyncedAt).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}) : "não informada"}</small></div>
    </section>

    {(view==="home"||view==="hoje"||view==="mentor") && <section className="os-action">
      <div><span className="os-pill">{m.nextAction.label}</span><h2>{m.nextAction.code ? `${m.nextAction.code} · ` : ""}{m.nextAction.title}</h2>
      <p>{m.nextAction.reason}</p><div className="os-evidence"><span>Confiança: <b>{m.nextAction.confidence}</b></span><span>Amostra: <b>{m.execution.evidence.label}</b></span><span>Ordem 1–37: <b>{m.sequence.valid?"íntegra":"divergente"}</b></span></div></div>
      <a className="os-cta" href={actionHref}>Executar agora →</a>
    </section>}

    <section className="os-metrics">
      <Metric label="Questões com evidência" value={m.execution.questions || "—"} detail={m.execution.evidence.label}/>
      <Metric label="Precisão" value={percent(m.execution.precision)} detail={m.execution.precision==null?"não calculável":"sobre execução registrada"}/>
      <Metric label="Progresso D0" value={m.trail.d0==null?"—":`${m.trail.d0}/${m.sequence.total}`} detail="material pronto ≠ estudado"/>
      <Metric label="Erros ativos" value={count(m.errorCount)} detail={m.errorCount==null?"aguardando snapshot operacional":"resolvidos/arquivados ficam fora"}/>
    </section>

    {view==="home" && <div className="os-grid">
      <section className="os-card"><h2>O que faço agora?</h2><p>{m.nextAction.reason}</p><a href={route(root,"hoje")}>Abrir Hoje →</a></section>
      <section className="os-card"><h2>Onde estou?</h2><p>{m.trail.d0==null?"Ainda sem resumo operacional publicado.":`${m.trail.d0} de ${m.sequence.total} posições com D0 concluído.`} D7: {count(m.trail.d7)} · D20: {count(m.trail.d20)}.</p><a href={route(root,"trilha")}>Ver trilha →</a></section>
      <section className="os-card"><h2>Onde estou errando?</h2><p>{m.errorCount!=null?`${m.errorCount} erro(s) ativo(s).`:"Caderno operacional ainda sem resumo público."} {m.weaknesses.length?`${m.weaknesses.length} fragilidade(s) com amostra suficiente.`:"Sem fragilidade estatística sustentada."}</p><a href={route(root,"erros")}>Caderno de erros →</a></section>
      <section className="os-card"><h2>Onde estou bem?</h2><p>{m.strengths.length?m.strengths.map((item:any)=>item.subject).join(", "):"Amostra insuficiente para declarar forças."}</p><a href={route(root,"desempenho")}>Desempenho →</a></section>
      <section className="os-card"><h2>Revisões</h2><p>{m.agenda.filter((item:any)=>item.state==="vencida").length} vencida(s) · {m.agenda.filter((item:any)=>item.state==="hoje").length} para hoje. Itens sem data ficam apenas programados.</p><a href={route(root,"revisoes")}>Abrir revisões →</a></section>
      <section className="os-card"><h2>Sistema e riscos</h2><p>{m.risks.length} sinal(is) · {m.quality.issues.length} observação(ões) de integridade.</p><a href={route(root,"riscos")}>Ver riscos →</a> · <a href={route(root,"qualidade-dados")}>qualidade →</a></section>
    </div>}

    {view==="hoje" && <div className="os-grid">
      <section className="os-card os-wide"><h2>Plano de execução</h2><ol><li>Abrir a unidade recomendada.</li><li>Executar teoria/questões conforme a página.</li><li>Registrar a execução no Notion.</li><li>Fechar erros e revisão sem alterar a sequência canônica.</li></ol></section>
      <section className="os-card"><h2>Revisões</h2><p>REV01–REV06 permanecem nas posições canônicas. Sem data real de execução, D7/D20 não são inventados.</p></section>
      <section className="os-card"><h2>Continuidade</h2><p>{m.nextAction.kind==="resume"?"Há sessão parcial: retomar prevalece.":"Não há sessão parcial pública identificada."}</p></section>
    </div>}

    {view==="mentor" && <div className="os-grid">
      <section className="os-card os-wide"><h2>Por que esta decisão?</h2><p>{m.nextAction.reason}</p><ul><li>sequência canônica preservada: {m.sequence.valid?"sim":"não"}</li><li>confiança: {m.nextAction.confidence}</li><li>amostra: {m.execution.evidence.label}</li><li>tendência: {m.execution.trend}</li></ul></section>
      <section className="os-card"><h2>Impacto</h2><p>O Mentor pode inserir intervenção curta por fragilidade, mas sempre retorna à Ordem 1–37.</p></section>
      <section className="os-card"><h2>Caixa-preta?</h2><p>Não. Motivo, evidência, confiança e próxima ação são exibidos juntos.</p></section>
    </div>}

    {view==="trilha" && <section className="os-card os-table-card"><h2>Português Primeiro + RLM Preventivo</h2><div className="os-list">
      {m.sequence.units.map((u:any)=><a key={u.code} href={root?`./portugues-rlm/${u.code.toLowerCase()}/`:`../portugues-rlm/${u.code.toLowerCase()}/`}><b>{u.canonical_order}. {u.code}</b><span>{u.title}</span><em>{u.material_ready?"material pronto":"em edição"} · execução: —</em></a>)}
    </div></section>}

    {view==="agenda" && <section className="os-card os-table-card"><h2>Agenda unificada</h2><Notice>Sem datas reais suficientes, itens sem vencimento não são classificados artificialmente como atrasados.</Notice><div className="os-list">{m.agenda.map((a:any,i:number)=><div key={a.code+i}><b>{a.code}</b><span>{a.title}</span><em>{a.state}{a.date?` · ${a.date}`:" · data —"}</em></div>)}</div></section>}

    {view==="revisoes" && <section className="os-card os-table-card"><h2>REV01–REV06</h2><Notice>D0/D7/D20 só entram como “hoje” ou “vencida” quando houver data real confiável.</Notice><div className="os-list">{m.reviews.map((r:any)=><div key={r.code}><b>{r.code}</b><span>{r.title}</span><em>{r.materialReady?"material pronto":"em edição"} · execução: —</em></div>)}</div></section>}

    {view==="erros" && <div className="os-grid">
      <section className="os-card os-wide"><h2>Fragilidades ativas</h2>{m.weaknesses.length?m.weaknesses.map((w:any)=><p key={w.subject}><b>{w.subject}</b> · {w.reason}</p>):<Notice>Não há fragilidade sustentada pela amostra pública atual. Isso não significa “zero erros”.</Notice>}</section>
      <section className="os-card"><h2>Regra</h2><p>Erro fechado/validado não continua ativo. Sem status confiável, o site não fabrica reincidência.</p></section>
    </div>}

    {view==="desempenho" && <div className="os-grid">
      <section className="os-card os-wide"><h2>Leitura conservadora</h2><p>Precisão: <b>{percent(m.execution.precision)}</b> · questões: <b>{m.execution.questions||"—"}</b> · sessões datadas: <b>{m.execution.sessions||"—"}</b>.</p><p>Tendência: {m.execution.trend}.</p></section>
      <section className="os-card"><h2>Forças</h2><p>{m.strengths.length?m.strengths.map((x:any)=>x.subject).join(", "):"Nenhuma força declarada com a evidência atual."}</p></section>
      <section className="os-card"><h2>Qualidade da amostra</h2><p>{m.execution.evidence.label} · confiança {m.execution.evidence.confidence}.</p></section>
    </div>}

    {view==="riscos" && <section className="os-card os-table-card"><h2>Riscos sustentados</h2>{!m.risks.length?<Notice>Nenhum risco sustentado.</Notice>:<div className="os-list">{m.risks.map((r:any,i:number)=><div key={i}><b>{r.title}</b><span>{r.detail}</span><em>{r.evidence}</em></div>)}</div>}</section>}

    {(view==="tecnico"||view==="analista") && <div className="os-grid">
      <section className="os-card os-wide"><h2>Cobertura · {labels[view]}</h2><p>Itens da matriz de referência: <b>{m.coverage[view].matrix}</b>.</p><div className="os-evidence"><span>estudado: <b>—</b></span><span>praticado: <b>—</b></span><span>consolidado: <b>—</b></span></div><Notice>Quantidade mapeada não é domínio. Técnico e Analista não contaminam cobertura mutuamente.</Notice></section>
      <section className="os-card"><h2>Núcleo comum</h2><p>{m.coverage.common.matrix} item(ns) explicitamente compartilhados na matriz pública.</p></section>
      <section className="os-card"><h2>Legislação</h2><p>{m.coverage.laws.active} normas ativas · {m.coverage.laws.historical} históricas/fora da fila ativa.</p></section>
    </div>}

    {view==="qualidade" && <section className="os-card os-table-card"><h2>Auditoria de dados</h2><div className="os-list">{m.quality.issues.map((q:any)=><div key={q.code}><b>{q.severity.toUpperCase()} · {q.code}</b><span>{q.message}</span><em>não corrigido silenciosamente no Notion</em></div>)}</div></section>}

    {view==="sincronizacao" && <div className="os-grid">
      <section className="os-card os-wide"><h2>Contrato de fonte</h2><p><b>Notion → GitHub/snapshot → inteligência → site.</b></p><p>Supabase permanece camada auxiliar de leitura/integração; não substitui silenciosamente o Notion.</p></section>
      <section className="os-card"><h2>Snapshot</h2><p>Última sincronização: {m.quality.sourceSyncedAt||"—"}.</p></section>
      <section className="os-card"><h2>Plano B</h2><a href={base+"painel-legado/"}>Abrir painel detalhado →</a></section>
    </div>}

    <footer className="os-footer"><span>Eu estudo → registro → o sistema entende → o Mentor interpreta.</span><div><a href={route(root,"qualidade-dados")}>Qualidade</a><a href={route(root,"sincronizacao")}>Sync</a><a href={base+"painel-legado/"}>Painel detalhado</a></div></footer>
  </main>;
}
