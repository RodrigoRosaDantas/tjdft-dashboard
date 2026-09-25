
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
  const navGroups: Array<{label:string;items:Array<{label:string;href:string;symbol:string;active:boolean}>}> = [
    {label:"Operação",items:[
      {label:"Dashboard",href:base,symbol:"⌂",active:view==="home"},
      {label:"Hoje",href:route(root,"hoje"),symbol:"◷",active:view==="hoje"},
      {label:"Trilha",href:route(root,"trilha"),symbol:"⇢",active:view==="trilha"},
      {label:"Português + RLM",href:route(root,"portugues-rlm"),symbol:"P/R",active:false},
      {label:"Leis Primeiro",href:route(root,"leis"),symbol:"§",active:false},
      {label:"Revisões",href:route(root,"revisoes"),symbol:"↻",active:view==="revisoes"},
      {label:"Agenda",href:route(root,"agenda"),symbol:"▦",active:view==="agenda"},
    ]},
    {label:"Diagnóstico",items:[
      {label:"Mentor",href:route(root,"mentor"),symbol:"✳",active:view==="mentor"},
      {label:"Caderno de erros",href:route(root,"erros"),symbol:"!",active:view==="erros"},
      {label:"Desempenho",href:route(root,"desempenho"),symbol:"▥",active:view==="desempenho"},
      {label:"Riscos",href:route(root,"riscos"),symbol:"△",active:view==="riscos"},
    ]},
    {label:"Cobertura",items:[
      {label:"Técnico",href:route(root,"tecnico"),symbol:"T",active:view==="tecnico"},
      {label:"Analista",href:route(root,"analista"),symbol:"A",active:view==="analista"},
    ]},
    {label:"Sistema",items:[
      {label:"Qualidade dos dados",href:route(root,"qualidade-dados"),symbol:"✓",active:view==="qualidade"},
      {label:"Sincronização",href:route(root,"sincronizacao"),symbol:"⟳",active:view==="sincronizacao"},
    ]},
  ];
  const renderNavGroups=()=>navGroups.map((group)=><section className="os-nav-group" key={group.label}>
    <h2>{group.label}</h2>
    {group.items.map((item)=><a key={item.label} className={item.active?"os-nav-link active":"os-nav-link"} href={item.href} aria-current={item.active?"page":undefined}>
      <span className="os-nav-symbol" aria-hidden="true">{item.symbol}</span><span>{item.label}</span>
    </a>)}
  </section>);
  const actionHref = m.nextAction?.href ? (root ? `./${m.nextAction.href}` : `../${m.nextAction.href}`) : route(root,"portugues-rlm");
  const sourceUpdated=m.quality.sourceSyncedAt?new Date(m.quality.sourceSyncedAt).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}):"atualização não informada";
  return <div className="study-os-shell">
    <aside className="os-sidebar">
      <a className="os-side-brand" href={base}>
        <span className="os-brand-mark" aria-hidden="true">T</span>
        <span><b>TJDFT</b><small>Dashboard · Área administrativa</small></span>
      </a>
      <div className="os-side-context"><span className="os-state-dot" aria-hidden="true"/><span><b>{m.meta.phase}</b><small>{m.meta.editalReference}</small></span></div>
      <nav className="os-side-nav" aria-label="Navegação principal">{renderNavGroups()}</nav>
      <div className="os-side-footer"><span className="os-state-dot" aria-hidden="true"/><span>Notion é a fonte operacional do TJDFT.</span></div>
    </aside>
    <div className="os-main-column">
      <header className="os-topbar">
        <details className="os-mobile-menu">
          <summary aria-label="Abrir menu de navegação"><span aria-hidden="true">☰</span><b>Menu</b></summary>
          <div className="os-menu-panel"><nav aria-label="Navegação do site">{renderNavGroups()}</nav><small>Notion · {sourceUpdated}</small></div>
        </details>
        <div className="os-page-context"><span>TJDFT · ÁREA ADMINISTRATIVA</span><strong>{view==="home"?"Dashboard":labels[view]}</strong></div>
        <div className="os-topbar-end">
          <div className="os-source" aria-label={`Fonte operacional: ${m.meta.sourceTitle}; ${sourceUpdated}`}>
            <span className="os-state-dot" aria-hidden="true"/><span><b>{m.meta.sourceTitle}</b><small>{sourceUpdated}</small></span>
          </div>
          <a className="os-law-link" href={route(root,"leis")}><span aria-hidden="true">§</span> Leis Primeiro</a>
        </div>
      </header>
      <main className="study-os">
        <section className="os-hero">
          <div><p className="os-kicker">TJDFT · Técnico + Analista · {m.meta.phase} · {m.meta.editalReference}</p>
          <h1>{view==="home"?"Central de comando":labels[view]}</h1>
          <p>Próxima ação e evidências do TJDFT em um só lugar. Ausência nunca vira zero.</p></div>
        </section>

    {(view==="home"||view==="hoje"||view==="mentor") && <section className="os-action">
      <div><span className="os-pill">{m.nextAction.label}</span><h2>{m.nextAction.code ? `${m.nextAction.code} · ` : ""}{m.nextAction.title}</h2>
      <p>{m.nextAction.reason}</p><div className="os-evidence"><span>Confiança: <b>{m.nextAction.confidence}</b></span><span>Amostra: <b>{m.execution.evidence.label}</b></span><span>Ordem 1–37: <b>{m.sequence.valid?"íntegra":"divergente"}</b></span></div></div>
      <a className="os-cta" href={actionHref}>Executar agora →</a>
    </section>}

    <section className="os-metrics">
      <Metric label="Questões consideradas" value={count(m.execution.questions)} detail={m.execution.annulled > 0 ? `${m.execution.annulled} anulada(s) excluída(s) · ${count(m.execution.attemptedQuestions)} respondidas` : m.execution.evidence.label}/>
      <Metric label="Precisão" value={percent(m.execution.precision)} detail={m.execution.precision==null?"não calculável":"sobre execução registrada"}/>
      <Metric label="Progresso D0" value={m.trail.d0==null?"—":`${m.trail.d0}/${m.sequence.total}`} detail="material pronto ≠ estudado"/>
      <Metric label="Erros ativos" value={count(m.errorCount)} detail={m.errorCount==null?"aguardando snapshot operacional":"resolvidos/arquivados ficam fora"}/>
    </section>

    {view==="home" && <div className="os-grid">
      <section className="os-card"><h2>O que faço agora?</h2><p>{m.nextAction.reason}</p><a href={route(root,"hoje")}>Abrir Hoje →</a></section>
      <section className="os-card"><h2>Onde estou?</h2><p>{m.trail.d0==null?"Ainda sem resumo operacional publicado.":`${m.trail.d0} de ${m.sequence.total} posições com D0 concluído.`} D7: {count(m.trail.d7)} · D20: {count(m.trail.d20)}.</p><a href={route(root,"trilha")}>Ver trilha →</a></section>
      <section className="os-card"><h2>Onde estou errando?</h2><p>{m.errorCount!=null?`${m.errorCount} erro(s) ativo(s).`:"Caderno operacional ainda sem resumo público."} {m.weaknesses.length?`${m.weaknesses.length} fragilidade(s) com amostra suficiente.`:"Sem fragilidade estatística sustentada."}</p><a href={route(root,"erros")}>Caderno de erros →</a></section>
      <section className="os-card"><h2>Onde estou bem?</h2><p>{m.strengths.length?m.strengths.map((item:any)=>item.subject).join(", "):"Amostra insuficiente para declarar forças."}</p><a href={route(root,"desempenho")}>Desempenho →</a></section>
      <section className="os-card"><h2>O que mudou?</h2><p>{m.execution.trendDetail.delta==null?"Amostra temporal insuficiente.":m.execution.trend+" · "+(m.execution.trendDetail.delta*100).toFixed(1)+" p.p."}</p><a href={route(root,"desempenho")}>Ver evolução →</a></section>
      <section className="os-card"><h2>Revisões</h2><p>{m.agenda.filter((item:any)=>item.state==="vencida").length} vencida(s) · {m.agenda.filter((item:any)=>item.state==="hoje").length} para hoje. Itens sem data ficam apenas programados.</p><a href={route(root,"revisoes")}>Abrir revisões →</a></section>
      <section className="os-card"><h2>Sistema e riscos</h2><p>{m.risks.length} sinal(is) · {m.quality.issues.length} observação(ões) de integridade.</p><a href={route(root,"riscos")}>Ver riscos →</a> · <a href={route(root,"qualidade-dados")}>qualidade →</a></section>
    </div>}

    {view==="hoje" && <div className="os-grid">
      <section className="os-card os-wide"><h2>Plano de execução</h2><ol><li>{m.nextAction.kind==="resume"?"Retomar a sessão em andamento.":"Abrir a próxima unidade canônica."}</li><li>Executar teoria e questões conforme a página.</li><li>Registrar a execução real no Notion.</li><li>Fechar erros e D0; D7/D20 seguem em paralelo sem quebrar a Ordem 1–37.</li></ol></section>
      <section className="os-card"><h2>Ponto mais fraco</h2><p>{m.weaknesses[0]?<><b>{m.weaknesses[0].subject}</b> · {m.weaknesses[0].reason}</>:"Nenhum ponto fraco declarado sem amostra suficiente."}</p><a href={route(root,"desempenho")}>Ver evidências →</a></section>
      <section className="os-card"><h2>Revisões do dia</h2><p>{m.agenda.filter((item:any)=>item.state==="vencida").length} vencida(s) · {m.agenda.filter((item:any)=>item.state==="hoje").length} para hoje.</p><a href={route(root,"revisoes")}>Abrir fila →</a></section>
      <section className="os-card"><h2>Erro prioritário</h2><p>{m.activeErrors[0]?<><b>{m.activeErrors[0].topic||m.activeErrors[0].subject}</b> · {m.activeErrors[0].severity} {m.activeErrors[0].action?"· "+m.activeErrors[0].action:""}</>:"Nenhum erro ativo no resumo operacional."}</p><a href={route(root,"erros")}>Caderno de erros →</a></section>
      <section className="os-card"><h2>Acessos rápidos</h2><p><a href={route(root,"portugues-rlm")}>Português + RLM →</a><br/><a href={route(root,"leis")}>Leis Primeiro →</a><br/><a href={route(root,"painel-legado")}>Painel detalhado →</a></p></section>
    </div>}

    {view==="mentor" && <div className="os-grid">
      <section className="os-card os-wide"><h2>Por que esta decisão?</h2><p>{m.nextAction.reason}</p><div className="os-decision-grid"><div><span>Ação</span><b>{m.nextAction.label}</b></div><div><span>Confiança</span><b>{m.nextAction.confidence}</b></div><div><span>Amostra</span><b>{m.execution.evidence.label}</b></div><div><span>Tendência</span><b>{m.execution.trend}</b></div></div></section>
      <section className="os-card"><h2>Impacto esperado</h2><p>{m.nextAction.impact|| (m.nextAction.kind==="resume"?"Evitar dispersão e concluir o que já começou.":m.weaknesses[0]?"Avançar a esteira sem ignorar "+m.weaknesses[0].subject+", que permanece como intervenção curta.":"Avançar a esteira sem criar uma fragilidade artificial.")}</p><p><b>{m.nextAction.after_action||"A próxima ação segue a Ordem 1–37."}</b></p></section>
      <section className="os-card"><h2>Proteções da decisão</h2><ul><li>Ordem 1–37: {m.sequence.valid?"íntegra":"divergente"}</li><li>Material pronto não conta como estudo.</li><li>Erro resolvido/arquivado não entra como risco ativo.</li><li>Técnico e Analista não compartilham domínio por inferência.</li></ul></section>
      <section className="os-card os-wide"><h2>Evidências usadas</h2><p>{m.execution.questions!=null?String(m.execution.questions)+" questões · "+count(m.execution.sessions)+" sessão(ões) registrada(s) · "+percent(m.execution.precision)+" de precisão.":"Sem amostra de questões suficiente."} {m.errorCount!=null?String(m.errorCount)+" erro(s) ativo(s).":"Caderno ativo ainda sem resumo."}</p>{m.nextAction.evidence?.length?<ul>{m.nextAction.evidence.map((item:string,i:number)=><li key={i}>{item}</li>)}</ul>:null}</section>
    </div>}

    {view==="trilha" && <section className="os-card os-table-card"><h2>Português Primeiro + RLM Preventivo</h2><Notice>A Ordem da esteira continua canônica. D0 fecha a passagem inicial; D7 e D20 seguem em paralelo.</Notice><div className="os-list">
      {m.sequence.units.map((u:any)=><a key={u.code} href={(root?"./":"../")+"portugues-rlm/"+u.code.toLowerCase()+"/"}><b>{u.canonical_order}. {u.code}</b><span>{u.title}</span><em>{u.study_state||"sem estado operacional"} · D0 {u.d0==null?"—":u.d0?"✓":"○"} · D7 {u.d7==null?"—":u.d7?"✓":"○"} · D20 {u.d20==null?"—":u.d20?"✓":"○"} · {u.material_ready?"material pronto":"em edição"}</em></a>)}
    </div></section>}

    {view==="agenda" && <section className="os-card os-table-card"><h2>Agenda unificada</h2><Notice>Vencida/hoje só existe quando há data real. REV sem data permanece programada.</Notice><div className="os-list">{m.agenda.map((a:any,i:number)=><div key={a.code+i}><b>{a.code}</b><span>{a.title}</span><em>{a.state} · {shortDate(a.date)}</em></div>)}</div></section>}

    {view==="revisoes" && <div className="os-grid">
      <section className="os-card os-wide"><h2>REV01–REV06 · revisões formais</h2><div className="os-list">{m.reviews.map((r:any)=><div key={r.code}><b>{r.code}</b><span>{r.title}</span><em>{r.status} · {r.materialReady?"material pronto":"em edição"}</em></div>)}</div></section>
      <section className="os-card os-wide"><h2>Revisões datadas</h2><Notice>D0/D7/D20 não recebem datas inventadas. Questões e erros entram aqui apenas quando o Notion traz Próxima revisão.</Notice><div className="os-list">{m.agenda.filter((item:any)=>item.date).map((item:any,i:number)=><div key={item.code+i}><b>{item.type}</b><span>{item.title}</span><em>{item.state} · {shortDate(item.date)}</em></div>)}</div></section>
    </div>}

    {view==="erros" && <div className="os-grid">
      <section className="os-card os-wide"><h2>Erros ativos</h2>{m.activeErrors.length?<div className="os-list">{m.activeErrors.map((item:any,i:number)=><div key={i}><b>{item.severity||"Sem gravidade"}</b><span>{item.topic||item.subject}{item.pattern?" · "+item.pattern:""}</span><em>{item.state}{item.recurrence?" · reincidência "+item.recurrence:""}{item.review_at?" · "+shortDate(item.review_at):""}</em></div>)}</div>:<Notice>{m.errorCount===0?"O Notion confirma zero erro ativo.":"Não há erro ativo publicável com evidência suficiente."}</Notice>}</section>
      <section className="os-card"><h2>Fragilidades estatísticas</h2><p>{m.weaknesses.length?m.weaknesses.map((w:any)=>w.subject+" ("+w.questions+" questões)").join(", "):"Nenhuma fragilidade declarada por amostra."}</p></section>
      <section className="os-card"><h2>Regra de fechamento</h2><p>Resolvido e Arquivado saem da fila ativa. Reincidência e gravidade aumentam prioridade; ausência de registro não vira “zero erro”.</p></section>
    </div>}

    {view==="desempenho" && <div className="os-grid">
      <section className="os-card os-wide"><h2>Leitura conservadora</h2><p>Precisão: <b>{percent(m.execution.precision)}</b> · questões: <b>{count(m.execution.questions)}</b> · sessões: <b>{count(m.execution.sessions)}</b> · tempo: <b>{m.execution.minutes==null?"—":m.execution.minutes+" min"}</b>.</p><p>Tendência: <b>{m.execution.trend}</b>{m.execution.trendDetail.delta==null?"":" · variação "+(m.execution.trendDetail.delta*100).toFixed(1)+" p.p."}.</p></section>
      <section className="os-card os-wide"><h2>Por matéria</h2>{m.execution.bySubject.length?<div className="os-list">{m.execution.bySubject.map((row:any)=><div key={row.subject}><b>{row.subject}</b><span>{count(row.questions)} questões · {percent(row.precision)}</span><em>{row.evidence.label} · {count(row.sessions)} sessões · {row.trend.label}</em></div>)}</div>:<Notice>Sem questões respondidas para comparar matérias.</Notice>}</section>
      <section className="os-card os-wide"><h2>Por cargo</h2>{m.execution.byCargo.length?<div className="os-list">{m.execution.byCargo.map((row:any)=><div key={row.cargo}><b>{row.cargo}</b><span>{count(row.questions)} questões · {percent(row.precision)}</span><em>{row.evidence.label} · {count(row.sessions)} sessões · {row.trend.label}</em></div>)}</div>:<Notice>Sem vínculo seguro de questões a Técnico ou Analista. A cobertura dos cargos permanece separada.</Notice>}</section>
      <section className="os-card"><h2>Forças sustentadas</h2><p>{m.strengths.length?m.strengths.map((x:any)=>x.subject).join(", "):"Nenhuma força declarada com a evidência atual."}</p></section>
      <section className="os-card"><h2>Qualidade da amostra</h2><p>{m.execution.evidence.label} · confiança {m.execution.evidence.confidence}.</p></section>
    </div>}

    {view==="riscos" && <section className="os-card os-table-card"><h2>Riscos sustentados</h2>{!m.risks.length?<Notice>Nenhum risco sustentado.</Notice>:<div className="os-list">{m.risks.map((r:any,i:number)=><div key={i}><b>{r.title}</b><span>{r.detail}</span><em>{r.evidence}</em></div>)}</div>}</section>}

    {(view==="tecnico"||view==="analista") && <div className="os-grid">
      <section className="os-card os-wide"><h2>Cobertura · {labels[view]}</h2><div className="os-decision-grid"><div><span>Matriz</span><b>{count(m.coverage[view].matrix)}</b></div><div><span>Material produzido</span><b>{count(m.coverage[view].produced)}</b></div><div><span>Disponível</span><b>{count(m.coverage[view].available)}</b></div><div><span>Mapeado</span><b>{count(m.coverage[view].mapped)}</b></div><div><span>Estudado</span><b>{count(m.coverage[view].studied)}</b></div><div><span>Com evidência</span><b>{count(m.coverage[view].evidence)}</b></div><div><span>Praticado</span><b>{count(m.coverage[view].practiced_questions)} q.</b></div><div><span>Consolidado</span><b>{count(m.coverage[view].consolidated)}</b></div></div><Notice>{m.meta.editalNote} Produção, disponibilidade, estudo, prática e consolidação são dimensões diferentes. Um cargo não herda domínio do outro.</Notice></section>
      <section className="os-card"><h2>Núcleo comum detectado</h2><p>{m.coverage.common.subjects?.length?m.coverage.common.subjects.join(", "):"Sem interseção operacional declarada suficiente."}</p></section>
      <section className="os-card"><h2>Legislação</h2><p>{m.coverage.laws.active} normas ativas · {m.coverage.laws.historical} históricas/fora da fila ativa.</p></section>
      <section className="os-card os-wide"><h2>Matérias mapeadas</h2><p>{m.coverage[view].subjects?.length?m.coverage[view].subjects.join(" · "):"Matriz ainda sem matérias sanitizadas publicadas."}</p></section>
    </div>}

    {view==="qualidade" && <div className="os-grid">
      <section className="os-card os-wide"><h2>Auditoria de dados</h2>{m.quality.issues.length?<div className="os-list">{m.quality.issues.map((q:any)=><div key={q.code}><b>{q.severity.toUpperCase()} · {q.code}</b><span>{q.message}</span><em>não corrigido silenciosamente no Notion</em></div>)}</div>:<Notice>Nenhuma inconsistência detectada pelos gates atuais.</Notice>}</section>
      <section className="os-card"><h2>Vocabulário seguro</h2><p>{m.aliases.safe?.length??"—"} alias(es) explícito(s). Alias ambíguo nunca é fundido automaticamente.</p></section>
      <section className="os-card"><h2>Snapshot</h2><p>Status: <b>{m.quality.sourceStatus||"—"}</b> · schema operacional: <b>{m.meta.operationalSchema||"—"}</b>.</p></section>
    </div>}

    {view==="sincronizacao" && <div className="os-grid">
      <section className="os-card os-wide"><h2>Contrato de fonte</h2><p><b>Notion → snapshot sanitizado no GitHub → inteligência → site.</b></p><p>Supabase é camada auxiliar para leitura ao vivo e persistência de contingência; não substitui silenciosamente o Notion.</p></section>
      <section className="os-card"><h2>Snapshot público</h2><p>Versão operacional: {m.meta.operationalSchema||"legada"} · conteúdo sincronizado: {m.quality.sourceSyncedAt||"—"}.</p></section>
      <section className="os-card"><h2>Privacidade operacional</h2><p>Histórico pessoal e texto bruto de questões/erros não entram no snapshot de inteligência. O site recebe agregados e sinais necessários à decisão.</p></section>
      <section className="os-card"><h2>Plano B</h2><a href={base+"painel-legado/"}>Abrir painel detalhado →</a></section>
    </div>}

    <footer className="os-footer"><span>Eu estudo → registro → o sistema entende → o Mentor interpreta.</span><div><a href={route(root,"qualidade-dados")}>Qualidade</a><a href={route(root,"sincronizacao")}>Sync</a><a href={base+"painel-legado/"}>Painel detalhado</a></div></footer>

      </main>
      <nav className="os-bottom-nav" aria-label="Navegação rápida">
        <a className={view==="home"?"active":""} href={base} aria-current={view==="home"?"page":undefined}><span aria-hidden="true">⌂</span><small>Dashboard</small></a>
        <a className={view==="hoje"?"active":""} href={route(root,"hoje")} aria-current={view==="hoje"?"page":undefined}><span aria-hidden="true">◷</span><small>Hoje</small></a>
        <a className={view==="trilha"?"active":""} href={route(root,"trilha")} aria-current={view==="trilha"?"page":undefined}><span aria-hidden="true">⇢</span><small>Trilha</small></a>
        <a className={view==="mentor"?"active":""} href={route(root,"mentor")} aria-current={view==="mentor"?"page":undefined}><span aria-hidden="true">✳</span><small>Mentor</small></a>
        <a href={route(root,"leis")}><span aria-hidden="true">§</span><small>Leis Primeiro</small></a>
      </nav>
    </div>
  </div>;
}
