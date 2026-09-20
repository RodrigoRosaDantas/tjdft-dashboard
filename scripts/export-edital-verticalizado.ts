const token=(Deno.env.get('TJDFT_NOTION_TOKEN')||'').trim();
const apiVersion='2026-03-11';
const dataSourceId='01da7685-5903-4a48-ae8e-987a7d35b447';
const sourcePageUrl='https://app.notion.com/p/4c8fd5d72b4d42bd8dbf972b4896e64b';
const outputPath='public/data/tjdft-edital.json';
if(!token)throw new Error('TJDFT_NOTION_TOKEN não configurado.');

const plain=(items:any[]=[])=>(items||[]).map(item=>item?.plain_text||item?.text?.content||'').join('').trim();
function propValue(prop:any):any{
  if(!prop)return '';
  if(prop.type==='title'||prop.title)return plain(prop.title);
  if(prop.type==='rich_text'||prop.rich_text)return plain(prop.rich_text);
  if(prop.type==='select'||prop.select)return prop.select?.name||'';
  if(prop.type==='multi_select'||prop.multi_select)return (prop.multi_select||[]).map((item:any)=>item.name).filter(Boolean);
  if(prop.type==='url'||Object.prototype.hasOwnProperty.call(prop,'url'))return prop.url||'';
  if(prop.type==='checkbox'||Object.prototype.hasOwnProperty.call(prop,'checkbox'))return Boolean(prop.checkbox);
  return '';
}
async function request(cursor:string|null=null){
  const body:any={page_size:100};
  if(cursor)body.start_cursor=cursor;
  const response=await fetch(`https://api.notion.com/v1/data_sources/${dataSourceId}/query`,{
    method:'POST',
    headers:{Authorization:`Bearer ${token}`,'Notion-Version':apiVersion,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  if(!response.ok)throw new Error(`Notion ${response.status}: ${(await response.text()).slice(0,300)}`);
  return response.json();
}

let cursor:string|null=null;
const pages:any[]=[];
do{
  const payload=await request(cursor);
  pages.push(...(payload.results||[]));
  cursor=payload.has_more?payload.next_cursor:null;
}while(cursor);

const axes=pages.map(page=>{
  const p=page.properties||{};
  const cargo=String(propValue(p['Cargo-alvo'])||'').trim();
  return {
    id:page.id,
    topic:String(propValue(p['Conteúdo'])||'').trim(),
    subtopic:String(propValue(p['Subtópico'])||'').trim(),
    subject:String(propValue(p['Matéria'])||'').trim(),
    cargos:cargo?[cargo]:[],
    sourceBase:String(propValue(p['Fonte-base'])||'').trim(),
    layer:String(propValue(p['Camada de evidência'])||'').trim(),
    level:String(propValue(p['Nível'])||'').trim(),
    sourceUrl:String(propValue(p['Fonte do edital'])||'').trim(),
    sourceLastEditedAt:page.last_edited_time||null,
    status:String(propValue(p['Status'])||'').trim()
  };
}).filter(axis=>axis.topic&&axis.subject&&axis.status!=='Fora da versão').map(({status,...axis})=>axis).sort((a,b)=>(a.cargos[0]||'').localeCompare(b.cargos[0]||'','pt-BR')||a.subject.localeCompare(b.subject,'pt-BR')||a.topic.localeCompare(b.topic,'pt-BR'));

const layers=Object.fromEntries([...axes.reduce((map,axis)=>map.set(axis.layer||'Sem camada',(map.get(axis.layer||'Sem camada')||0)+1),new Map<string,number>())]);
const subjects=Object.fromEntries([...axes.reduce((map,axis)=>map.set(axis.subject,(map.get(axis.subject)||0)+1),new Map<string,number>())]);
const snapshotWithoutTimestamp={
  schemaVersion:1,
  competitionId:'tjdft',
  title:'TJDFT — Edital verticalizado',
  version:'base-2022',
  kind:'historical-base',
  source:{type:'notion',dataSourceId,pageUrl:sourcePageUrl,apiVersion},
  editorialPolicy:{
    official:false,
    note:'Pré-edital. O Edital 2022 é base histórica; alterações legais e eventual edital futuro prevalecem quando publicados.'
  },
  axisCount:axes.length,
  layers,
  subjects,
  axes
};

let previousSnapshot:any=null;
try{previousSnapshot=JSON.parse(await Deno.readTextFile(outputPath));}catch{/* primeiro snapshot */}
const generatedAt=previousSnapshot?.generatedAt&&stableSnapshot(previousSnapshot)===stableSnapshot(snapshotWithoutTimestamp)
  ? previousSnapshot.generatedAt
  : new Date().toISOString();
const snapshot={...snapshotWithoutTimestamp,generatedAt};

await Deno.mkdir('public/data',{recursive:true});
await Deno.writeTextFile(outputPath,JSON.stringify(snapshot,null,2)+'\n');
console.log(`Edital TJDFT sanitizado: ${axes.length} eixos exportados para ${outputPath}.`);

function stableSnapshot(value:any){
  const normalize=(nested:any):any=>{
    if(Array.isArray(nested))return nested.map(normalize);
    if(nested&&typeof nested==='object'){
      return Object.fromEntries(
        Object.entries(nested)
          .filter(([key])=>key!=='generatedAt')
          .sort(([left],[right])=>left.localeCompare(right))
          .map(([key,item])=>[key,normalize(item)])
      );
    }
    return nested;
  };
  return JSON.stringify(normalize(value));
}
