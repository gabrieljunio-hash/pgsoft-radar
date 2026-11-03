const $=id=>document.getElementById(id);
let history=[];
const when=s=>new Date(s).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
const key=s=>String(s).normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function median(values){const a=[...values].sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:0}
function calculateScore(sourceStats,now,windowMs){
 const intervals=sourceStats.reduce((n,s)=>n+s.deltas.length,0);
 const rises=sourceStats.reduce((n,s)=>n+s.deltas.filter(d=>d>0).length,0);
 const frequency=intervals?rises/intervals:0;
 let recentTotal=0,recentRises=0;
 for(const s of sourceStats){
  const recent=s.deltas.slice(-3);
  recentTotal+=recent.length;recentRises+=recent.filter(d=>d>0).length;
 }
 const continuity=recentTotal?recentRises/recentTotal:0;
 const confirming=sourceStats.filter(s=>s.deltas.some(d=>d>0)).length;
 const confirmation=sourceStats.length?confirming/sourceStats.length:0;
 const regularities=sourceStats.filter(s=>s.positive.length>=2).map(s=>{
  const avg=s.positive.reduce((a,b)=>a+b,0)/s.positive.length;
  const variance=s.positive.reduce((a,b)=>a+(b-avg)**2,0)/s.positive.length;
  const cv=avg?Math.sqrt(variance)/avg:1;
  return 1/(1+cv);
 });
 const regularity=regularities.length?regularities.reduce((a,b)=>a+b,0)/regularities.length:0;
 const lastRise=Math.max(0,...sourceStats.map(s=>s.lastRise));
 const age=lastRise?Math.max(0,now-lastRise):windowMs*2;
 const recency=Math.exp(-age/Math.max(windowMs*.25,60000));
 const score=100*(.30*frequency+.25*continuity+.20*confirmation+.15*regularity+.10*recency);
 return {score,frequency,continuity,confirmation,regularity,recency,lastRise,rises,intervals};
}
function render(){
 const hours=Number($("period").value),windowHours=hours<0?720:hours,windowMs=windowHours*3600000;
 const cutoff=Date.now()-windowMs,filter=$("game-filter").value.trim().toLowerCase(),now=Date.now();
 const perGame=new Map();
 for(const snap of history){
  const t=new Date(snap.collected_at).getTime();
  if(!Number.isFinite(t)||t<cutoff)continue;
  const provider=snap.provider||"PG Soft";
  for(const [name,value] of Object.entries(snap.games||{})){
   if(filter&&!name.toLowerCase().includes(filter))continue;
   const k=provider+"|"+key(name);
   if(!perGame.has(k))perGame.set(k,{game:name,provider,bySource:new Map(),image:""});
   const g=perGame.get(k),sourceKey=snap.source+"|"+provider;
   if(!g.image&&snap.game_images&&snap.game_images[name])g.image=snap.game_images[name];
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
   const deltas=[];
   let lastRise=0;
   for(let i=1;i<points.length;i++){
    const d=points[i].value-points[i-1].value;
    deltas.push(d);
    if(d>0)lastRise=points[i].t;
   }
   sourceStats.push({deltas,positive:deltas.filter(d=>d>0),lastRise});
  }
  const latestPoints=[...g.bySource.values()].map(p=>[...p].sort((a,b)=>a.t-b.t).at(-1)).filter(Boolean);
  const metrics=calculateScore(sourceStats,now,windowMs);
  rows.push({...g,...metrics,waiting:!sourceStats.length||metrics.rises===0,sourceCount:sourceStats.length});
 }
 rows.sort((a,b)=>(a.waiting?1:0)-(b.waiting?1:0)||b.score-a.score||b.rises-a.rises||b.lastRise-a.lastRise);
 const latest=history.reduce((max,s)=>Math.max(max,new Date(s.collected_at).getTime()||0),0);
 $("updated").textContent=latest?"Dados coletados: "+when(new Date(latest).toISOString()):"Aguardando dados";
 $("ranking-summary").textContent=rows.length?rows.length+" jogos encontrados · pontuação de consistência":"Nenhum jogo encontrado neste período";
 $("wins").innerHTML=rows.length?rows.map((g,i)=>'<article class="game-card"><span class="rank">#'+(i+1)+'</span><div class="game-thumb-wrap">'+(g.image?'<img class="game-thumb" src="'+escapeHtml(g.image)+'" alt="'+escapeHtml(g.game)+'" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><div class="game-thumb placeholder" hidden>'+escapeHtml(g.game.slice(0,2).toUpperCase())+'</div>':'<div class="game-thumb placeholder">'+escapeHtml(g.game.slice(0,2).toUpperCase())+'</div>')+'</div><div class="game-info"><h3>'+escapeHtml(g.game)+'</h3><span class="provider-tag">'+escapeHtml(g.provider)+'</span>'+(g.waiting?'<strong class="waiting-label">Reunindo dados</strong><small>Aguardando novas coletas para avaliar a consistência.</small>':'<strong class="up-label">'+g.score.toFixed(0)+' pontos</strong><small>Altas em '+Math.round(g.frequency*100)+'% das variações · '+g.rises+' altas observadas</small><small>Confirmado em '+g.sourceCount+' fonte(s) · continuidade recente '+Math.round(g.continuity*100)+'%</small>')+'</div></article>').join(""):'<div class="empty">Nenhum jogo encontrado. Tente ampliar o período ou limpar a busca.</div>';
}
async function load(){
 $("refresh").disabled=true;$("refresh").textContent="Carregando…";
 try{
  const response=await fetch("./data/history.json?ts="+Date.now(),{cache:"no-store"});
  if(!response.ok)throw new Error("Não foi possível carregar o histórico");
  const data=await response.json();history=data.snapshots||[];render();
 }catch(e){
  $("wins").innerHTML='<div class="empty">Não foi possível carregar o ranking. Tente novamente.</div>';
  $("ranking-summary").textContent="Falha ao carregar dados";
 }finally{$("refresh").disabled=false;$("refresh").textContent="Atualizar ↻"}
}
$("refresh").addEventListener("click",load);
$("period").addEventListener("change",render);
$("game-filter").addEventListener("input",render);
load();