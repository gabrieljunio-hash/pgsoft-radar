const SOURCES=[{id:"farra.bet",name:"Farra.bet"},{id:"jogou.io",name:"Jogou"},{id:"cassino365.bet",name:"Cassino10"},{id:"tokyoclubbet.com",name:"Tokyo Club"},{id:"betz1nha.com",name:"Betzinha"},{id:"jogofacil.net.br",name:"Jogo Fácil"},{id:"gigabet.com.br",name:"GigaBet"}];
const $=id=>document.getElementById(id);let history=[],events=[],feedSources=[],feedUpdated="";
const money=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:2}).format(n);
const when=s=>new Date(s).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
const key=s=>String(s).normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
function renderSources(){
 $("source-count").textContent=feedSources.filter(s=>s.status==="ok").length;
 $("source-label").textContent=feedSources.length+" feeds de pagamentos individuais";
 $("sources-list").innerHTML=feedSources.map(s=>'<article class="source-item"><strong>'+escapeHtml(s.name)+'</strong><small>'+(s.status==="ok"?(s.pgsoft_rows||0)+' jogo(s) PG Soft · '+(s.events||0)+' pagamento(s) ≥50x':'Falha na coleta')+'</small></article>').join("");
}
function render(){
 const hours=Number($("period").value),cutoff=Date.now()-(hours<0?30:hours)*3600000,filter=$("game-filter").value.trim().toLowerCase();
 const perGame=new Map();
 for(const snap of history){
  const t=new Date(snap.collected_at).getTime();
  if(!Number.isFinite(t)||t<cutoff)continue;
  const provider=snap.provider||"PG Soft";
  for(const [name,value] of Object.entries(snap.games||{})){
   if(filter&&!name.toLowerCase().includes(filter))continue;
   const k=provider+"|"+key(name);
   if(!perGame.has(k))perGame.set(k,{game:name,provider,bySource:new Map()});
   const g=perGame.get(k),sourceKey=snap.source+"|"+provider;
   if(!g.bySource.has(sourceKey))g.bySource.set(sourceKey,[]);
   g.bySource.get(sourceKey).push({t,value:Number(value)});
  }
 }
 const rows=[];
 for(const g of perGame.values()){
  const sourceStats=[];
  for(const points of g.bySource.values()){
   points.sort((a,b)=>a.t-b.t);
   if(points.length<2)continue;
   let delta=0,rises=0,lastRise=0;
   for(let i=1;i<points.length;i++){
    const d=points[i].value-points[i-1].value;
    if(d>0){delta+=d;rises++;lastRise=points[i].t}
   }
   const elapsed=Math.max((points.at(-1).t-points[0].t)/3600000,1/60);
   sourceStats.push({delta,rises,lastRise,rate:delta/elapsed});
  }
  if(!sourceStats.length)continue;
  const median=arr=>{const x=[...arr].sort((a,b)=>a-b);return x[Math.floor(x.length/2)]||0};
  const activity=median(sourceStats.map(x=>x.rises)),growth=median(sourceStats.map(x=>x.delta)),rate=median(sourceStats.map(x=>x.rate));
  const lastRise=Math.max(...sourceStats.map(x=>x.lastRise));
  if(growth<=0)continue;
  rows.push({...g,activity,growth,rate,lastRise,sourceCount:sourceStats.length});
 }
 rows.sort((a,b)=>b.activity-a.activity||b.rate-a.rate||b.lastRise-a.lastRise);
 const total=rows.reduce((n,g)=>n+g.activity,0);
 $("total-wins").textContent=total.toLocaleString("pt-BR");
 $("total-label").textContent="SINAIS DE ATIVIDADE ESTIMADOS";
 $("games-label").textContent="JOGOS COM ALTA NO ACUMULADO";
 $("sites-label").textContent="FONTES COM HISTÓRICO";
 $("ranking-label").textContent="Ranking unificado · todas as provedoras";
 $("games-count").textContent=rows.length;
 $("casinos-count").textContent=new Set(history.filter(x=>new Date(x.collected_at).getTime()>=cutoff).map(x=>x.source+"|"+(x.provider||"PG Soft"))).size;
 $("common-count").textContent=rows.filter(g=>g.sourceCount>=2).length;
 $("updated").textContent=feedUpdated?"Última análise: "+when(feedUpdated):"Última análise salva";
 $("wins").innerHTML=rows.length?rows.map((g,i)=>'<article class="game-card"><span class="rank">#'+(i+1)+'</span><div class="game-thumb placeholder">'+escapeHtml(g.game.slice(0,2).toUpperCase())+'</div><div class="game-info"><h3>'+escapeHtml(g.game)+'</h3><small class="provider-tag">'+escapeHtml(g.provider)+'</small><strong>'+g.activity+' intervalos com alta · estimativa</strong><small>Crescimento do acumulado: '+money(g.growth)+'</small><small>Ritmo estimado: '+money(g.rate)+'/hora</small><small>Última alta observada: '+(g.lastRise?escapeHtml(when(new Date(g.lastRise).toISOString())):"—")+'</small><small>Comparado em '+g.sourceCount+' fontes · não confirma pagamentos individuais de 50x</small></div></article>').join(""):'<div class="empty">Ainda não há crescimento suficiente no período selecionado para estimar atividade.</div>';
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function load(){$("refresh").disabled=true;$("refresh").textContent="Atualizando…";try{const [h,w]=await Promise.all([fetch("./data/history.json?ts="+Date.now(),{cache:"no-store"}),fetch("./data/wins.json?ts="+Date.now(),{cache:"no-store"})]);if(h.ok){const d=await h.json();history=d.snapshots||[]}if(w.ok){const d=await w.json();events=d.events||[];feedSources=d.sources||[];feedUpdated=d.updated_at||""}renderSources();render()}catch(e){$("wins").innerHTML='<div class="empty">Falha ao carregar dados.</div>';$("updated").textContent="Sem dados"}finally{$("refresh").disabled=false;$("refresh").textContent="Atualizar dados ↻"}}
$("refresh").addEventListener("click",load);$("period").addEventListener("change",render);$("game-filter").addEventListener("input",render);load();
