const SOURCES = [
  {id:"farra.bet",name:"Farra.bet",url:"https://farra.bet/cassino/pg-soft"},
  {id:"jogou.io",name:"Jogou",url:"https://jogou.io/cassino/pg-soft"},
  {id:"cassino365.bet",name:"Cassino10",url:"https://www.cassino365.bet/cassino/pg-soft"},
  {id:"tokyoclubbet.com",name:"Tokyo Club",url:"https://tokyoclubbet.com/cassino/pg-soft"},
  {id:"betz1nha.com",name:"Betzinha",url:"https://betz1nha.com/cassino/pg-soft"},
  {id:"jogofacil.net.br",name:"Jogo Fácil",url:"https://jogofacil.net.br/cassino/pg-soft"}
];
const $ = id => document.getElementById(id);
let history = [];
const money = n => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
const when = s => new Date(s).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
const gameKey = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g," ").trim();

function renderSources(){
  const bySource = new Map();
  for(const snapshot of history){
    const item=bySource.get(snapshot.source)||{count:0,last:null,name:snapshot.source_name||snapshot.source};
    item.count++;
    if(!item.last||snapshot.collected_at>item.last.collected_at)item.last=snapshot;
    bySource.set(snapshot.source,item);
  }
  $("source-count").textContent=String(bySource.size);
  $("source-label").textContent=bySource.size+" fonte(s) com dados históricos";
  $("sources-list").innerHTML=SOURCES.map(source=>{
    const item=bySource.get(source.id);
    const status=item?("ÚLTIMA COLETA: "+when(item.last.collected_at)+" · "+Object.keys(item.last.games||{}).length+" jogos"):"AGUARDANDO DADOS";
    return `<article class="source-item"><strong>${escapeHtml(source.name)}</strong><small>${status}</small><br><a href="${source.url}" target="_blank" rel="noopener noreferrer">Abrir fonte ↗</a></article>`;
  }).join("");
}

function render(){
  const hours=Number($("period").value), cutoff=Date.now()-hours*3600000;
  const filter=$("game-filter").value.trim().toLocaleLowerCase("pt-BR");
  if(!history.length){empty("Aguardando a primeira coleta automática.");return;}
  const bySource=new Map();
  for(const snapshot of history){
    if(!bySource.has(snapshot.source))bySource.set(snapshot.source,[]);
    bySource.get(snapshot.source).push(snapshot);
  }
  const rows=[];
  for(const [source,snapshots] of bySource){
    snapshots.sort((a,b)=>new Date(a.collected_at)-new Date(b.collected_at));
    const current=snapshots.at(-1);
    const base=[...snapshots].reverse().find(s=>new Date(s.collected_at).getTime()<=cutoff);
    if(!base||base===current)continue;
    for(const [game,latest] of Object.entries(current.games||{})){
      if(filter&&!game.toLocaleLowerCase("pt-BR").includes(filter))continue;
      const previousByKey=new Map(Object.entries(base.games||{}).map(([name,value])=>[gameKey(name),value]));
      const previous=previousByKey.get(gameKey(game));
      if(typeof previous!=="number"||latest<previous)continue;
      const delta=latest-previous;
      if(delta>0)rows.push({game,source,sourceName:current.source_name||source,url:current.source_url||SOURCES.find(s=>s.id===source)?.url,delta,latest,time:current.collected_at});
    }
  }
  const matches=new Map();
  for(const row of rows){
    const key=gameKey(row.game);
    if(!matches.has(key))matches.set(key,new Set());
    matches.get(key).add(row.source);
  }
  for(const row of rows)row.convergence=matches.get(gameKey(row.game))?.size||1;
  rows.sort((a,b)=>b.delta-a.delta);
  $("total-wins").textContent=money(rows.reduce((sum,row)=>sum+row.delta,0));
  $("games-count").textContent=String(new Set(rows.map(r=>gameKey(r.game))).size);
  $("casinos-count").textContent=String(new Set(rows.map(r=>r.source)).size);
  $("common-count").textContent=String([...matches.values()].filter(set=>set.size>=2).length);
  $("updated").textContent="Últimos dados: "+when(history.at(-1).collected_at);
  $("wins").innerHTML=rows.length?rows.map(r=>`<tr><td><b>${escapeHtml(r.game)}</b></td><td>${escapeHtml(r.sourceName)}</td><td>${money(r.delta)}</td><td>${r.convergence} fonte(s)</td><td>${when(r.time)}</td><td><a href="${r.url}" target="_blank" rel="noopener noreferrer">Abrir ↗</a></td></tr>`).join(""):'<tr><td colspan="6" class="empty">Ainda não há duas coletas por fonte que cubram o período selecionado. O histórico está sendo formado.</td></tr>';
}
function empty(message){
  $("total-wins").textContent="—";$("games-count").textContent="—";$("casinos-count").textContent="—";$("common-count").textContent="—";
  $("wins").innerHTML=`<tr><td colspan="6" class="empty">${message}</td></tr>`;
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function load(){
  $("refresh").disabled=true;$("refresh").textContent="Atualizando…";
  try{
    const response=await fetch("./data/history.json?ts="+Date.now(),{cache:"no-store"});
    if(!response.ok)throw new Error("Histórico ainda não publicado");
    const data=await response.json();history=Array.isArray(data.snapshots)?data.snapshots:[];
    renderSources();render();
  }catch(e){history=[];renderSources();empty("Histórico ainda não publicado. A primeira execução do coletor precisa ser concluída.");$("updated").textContent="Sem dados";}
  finally{$("refresh").disabled=false;$("refresh").textContent="Atualizar dados ↻";}
}
$("refresh").addEventListener("click",load);
$("period").addEventListener("change",render);
$("game-filter").addEventListener("input",render);
load();
