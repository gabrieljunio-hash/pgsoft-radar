const $=id=>document.getElementById(id);
let history=[];
const money=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0}).format(n);
const when=s=>new Date(s).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
const key=s=>String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
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
   let delta=0,rises=0,lastRise=0;
   for(let i=1;i<points.length;i++){
    const d=points[i].value-points[i-1].value;
    if(d>0){delta+=d;rises++;lastRise=points[i].t}
   }
   const elapsed=Math.max((points.at(-1).t-points[0].t)/3600000,1/60);
   sourceStats.push({delta,rises,lastRise,rate:delta/elapsed});
  }
  const latestPoints=[...g.bySource.values()].map(points=>[...points].sort((a,b)=>a.t-b.t).at(-1)).filter(Boolean);
  const current=latestPoints.sort((a,b)=>b.t-a.t)[0]?.value||0;
  if(!sourceStats.length){rows.push({...g,waiting:true,current,activity:0,growth:0,lastRise:0,sourceCount:latestPoints.length});continue}
  const median=arr=>{const x=[...arr].sort((a,b)=>a-b);return x[Math.floor(x.length/2)]||0};
  const activity=median(sourceStats.map(x=>x.rises)),growth=median(sourceStats.map(x=>x.delta));
  const lastRise=Math.max(...sourceStats.map(x=>x.lastRise));
  if(growth<=0){rows.push({...g,waiting:true,current,activity:0,growth:0,lastRise:0,sourceCount:sourceStats.length});continue}
  rows.push({...g,waiting:false,current,activity,growth,lastRise,sourceCount:sourceStats.length});
 }
 rows.sort((a,b)=>(a.waiting?1:0)-(b.waiting?1:0)||b.activity-a.activity||b.growth-a.growth||b.lastRise-a.lastRise);
 const latest=history.reduce((max,s)=>Math.max(max,new Date(s.collected_at).getTime()||0),0);
 $("updated").textContent=latest?"Dados coletados: "+when(new Date(latest).toISOString()):"Aguardando dados";
 $("ranking-summary").textContent=rows.length?rows.length+" jogos encontrados · todas as provedoras":"Nenhum jogo encontrado neste período";
 $("wins").innerHTML=rows.length?rows.map((g,i)=>'<article class="game-card"><span class="rank">#'+(i+1)+'</span><div class="game-thumb-wrap">'+(g.image?'<img class="game-thumb" src="'+escapeHtml(g.image)+'" alt="'+escapeHtml(g.game)+'" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><div class="game-thumb placeholder" hidden>'+escapeHtml(g.game.slice(0,2).toUpperCase())+'</div>':'<div class="game-thumb placeholder">'+escapeHtml(g.game.slice(0,2).toUpperCase())+'</div>')+'</div><div class="game-info"><h3>'+escapeHtml(g.game)+'</h3><span class="provider-tag">'+escapeHtml(g.provider)+'</span>'+(g.waiting?'<strong class="waiting-label">Reunindo dados</strong><small>Precisamos de novas coletas para avaliar este jogo.</small>':'<strong class="up-label">Em alta</strong><small>Variação acumulada observada: <b>'+money(g.growth)+'</b></small><small>Comparado em '+g.sourceCount+' fonte(s)</small>')+'</div></article>').join(""):'<div class="empty">Nenhum jogo encontrado. Tente ampliar o período ou limpar a busca.</div>';
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