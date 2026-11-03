const $=id=>document.getElementById(id);
let history=[];
let winEvents=[];
const when=s=>new Date(s).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
const key=s=>String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function nextGameImage(img){
 const candidates=JSON.parse(img.dataset.candidates||"[]");
 const next=Number(img.dataset.nextCandidate||1);
 if(next<candidates.length){
  img.dataset.nextCandidate=String(next+1);
  img.src=candidates[next];
 }else{
  img.hidden=true;
  const fallback=img.parentElement.querySelector(".game-thumb-fallback");
  if(fallback)fallback.hidden=false;
 }
}
function calculateScore(sourceStats,now,windowMs,observedSourceCount){
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
 const confirmation=observedSourceCount?confirming/observedSourceCount:0;
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
 const confidence=Math.min(1,intervals/6);
 const score=100*(.30*frequency+.25*continuity+.20*confirmation+.15*regularity+.10*recency)*confidence;
 return {score,frequency,continuity,confirmation,regularity,recency,lastRise,rises,intervals,confidence};
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
   if(!perGame.has(k))perGame.set(k,{game:name,provider,bySource:new Map(),images:[]});
   const g=perGame.get(k),sourceKey=snap.source+"|"+provider;
   if(snap.game_images&&snap.game_images[name]){const image=snap.game_images[name];if((image.startsWith("https://")||image.startsWith("http://"))&&!g.images.includes(image))g.images.push(image);}
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
  const metrics=calculateScore(sourceStats,now,windowMs,g.bySource.size);
  const recentLabel=metrics.continuity>=.67?"As altas continuaram nas coletas recentes.":metrics.continuity>=.34?"Houve novas altas, mas sem constância.":"Poucas altas nas coletas mais recentes.";
  const regularLabel=metrics.regularity>=.65?"Aumentos distribuídos ao longo das coletas.":"Aumentos concentrados em alguns momentos.";
  const confirmedSources=sourceStats.filter(s=>s.deltas.some(d=>d>0)).length;
  const hourly=Array.from({length:24},()=>({count:0,rises:0,total:0}));
  for(const points of g.bySource.values()){
   points.sort((a,b)=>a.t-b.t);
   for(let i=1;i<points.length;i++){
    if(points[i].t<cutoff)continue;
    const hour=(new Date(points[i].t).getUTCHours()+21)%24;
    const d=points[i].value-points[i-1].value;
    hourly[hour].count++;
    if(d>0){hourly[hour].rises++;hourly[hour].total+=d;}
   }
  }
  const peak=hourly.map((h,hour)=>({...h,hour,average:h.count?h.total/h.count:0}))
   .filter(h=>h.count>=2&&h.rises>0).sort((a,b)=>b.average-a.average)[0]||null;
  const gameWins=g.provider==="PG Soft"?winEvents.filter(e=>key(e.game)===key(g.game)&&Date.parse(e.occurred_at)>=cutoff):[];
  rows.push({...g,...metrics,waiting:metrics.intervals===0,sourceCount:g.bySource.size,confirmedSources,peak,gameWins});
 }
 rows.sort((a,b)=>(a.waiting?1:0)-(b.waiting?1:0)||b.score-a.score||b.rises-a.rises||b.lastRise-a.lastRise);
 const latest=history.reduce((max,s)=>Math.max(max,new Date(s.collected_at).getTime()||0),0);
 $("updated").textContent=latest?"Dados coletados: "+when(new Date(latest).toISOString()):"Aguardando dados";
 $("ranking-summary").textContent=rows.length?rows.length+" jogos encontrados · pontuação de consistência":"Nenhum jogo encontrado neste período";
 $("wins").innerHTML=rows.length?rows.map((g,i)=>'<article class="game-card"><span class="rank">#'+(i+1)+'</span><div class="game-thumb-wrap">'+(g.images.length?'<img class="game-thumb" src="'+escapeHtml(g.images[0])+'" data-candidates="'+escapeHtml(JSON.stringify(g.images))+'" data-next-candidate="1" alt="'+escapeHtml(g.game)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="nextGameImage(this)"><div class="game-thumb game-thumb-fallback placeholder" hidden>'+escapeHtml(g.game.slice(0,2).toUpperCase())+'</div>':'<div class="game-thumb placeholder">'+escapeHtml(g.game.slice(0,2).toUpperCase())+'</div>')+'</div><div class="game-info"><h3>'+escapeHtml(g.game)+'</h3><span class="provider-tag">'+escapeHtml(g.provider)+'</span>'+(g.waiting?'<strong class="waiting-label">Reunindo histórico</strong><small>Ainda não há comparações suficientes neste período.</small>':'<strong class="up-label">'+(g.score>=60?'Movimento frequente':g.score>=30?'Movimento moderado':'Movimento baixo')+'</strong><small>O acumulado aumentou em '+g.rises+' de '+g.intervals+' comparações.</small><small>Alta confirmada em '+g.confirmedSources+' de '+g.sourceCount+' fontes monitoradas.</small><small>'+g.recentLabel+'</small><small>'+g.regularLabel+'</small><small>'+(g.peak?'Horário de maior movimento: '+String(g.peak.hour).padStart(2,'0')+'h–'+String((g.peak.hour+1)%24).padStart(2,'0')+'h.':'Horário de pico ainda não identificado.')+'</small>'+(g.provider==='PG Soft'?'<small>Pagamentos individuais 50x+ encontrados: '+g.gameWins.length+(g.gameWins.length?' · maior: '+Math.max(...g.gameWins.map(e=>e.multiplier)).toLocaleString('pt-BR')+'x':' · nenhum registro nas fontes consultadas')+'</small>':'<small>Pagamentos individuais: sem fonte disponível para esta provedora.</small>'))+'</div></article>').join(""):'<div class="empty">Nenhum jogo encontrado. Tente ampliar o período ou limpar a busca.</div>';
 renderTimeAnalysis();
}

function renderTimeAnalysis(){
 const cutoff=Date.now()-24*3600000, games=new Map();
 for(const snap of history){
  const t=Date.parse(snap.collected_at);if(!Number.isFinite(t))continue;
  const provider=snap.provider||"PG Soft";
  for(const [name,value] of Object.entries(snap.games||{})){
   const id=provider+"|"+key(name);
   if(!games.has(id))games.set(id,{name,provider,sources:new Map(),hours:Array.from({length:24},()=>({samples:0,rises:0,sum:0}))});
   const g=games.get(id),source=snap.source+"|"+provider;
   if(!g.sources.has(source))g.sources.set(source,[]);
   g.sources.get(source).push({t,value:Number(value)});
  }
 }
 const ranked=[];
 for(const g of games.values()){
  let rises=0,intervals=0;
  const recentStats=[];
  for(const points of g.sources.values()){
   points.sort((a,b)=>a.t-b.t);const recentDeltas=[];
   for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],delta=b.value-a.value;
    const localHour=(new Date(b.t).getUTCHours()+21)%24;
    const bin=g.hours[localHour];bin.samples++;if(delta>0){bin.rises++;bin.sum+=delta;}
    if(b.t>=cutoff){recentDeltas.push(delta);intervals++;if(delta>0)rises++;}
   }
   if(recentDeltas.length)recentStats.push({deltas:recentDeltas,positive:recentDeltas.filter(x=>x>0),lastRise:0});
  }
  const score=calculateScore(recentStats,Date.now(),24*3600000,g.sources.size).score;
  ranked.push({...g,rises,intervals,score});
 }
 ranked.sort((a,b)=>b.score-a.score||b.rises-a.rises);
 const top=ranked.slice(0,10);
 $("time-analysis").innerHTML=top.length?'<div class="analysis-intro">Os 10 jogos mais bem colocados no ranking de 24 horas, comparados por horário usando todo o histórico disponível.</div>'+top.map((g,i)=>{
  const eligible=g.hours.map((h,hour)=>({...h,hour,avg:h.samples?h.sum/h.samples:0})).filter(h=>h.samples>=2).sort((a,b)=>b.avg-a.avg);
  const best=eligible[0];
  const range=best?String(best.hour).padStart(2,"0")+"h–"+String((best.hour+1)%24).padStart(2,"0")+"h":"Padrão ainda não identificado";
  const hoursSeen=g.hours.filter(h=>h.samples>0).length;
  return '<article class="time-game"><div class="time-game-head"><b>#'+(i+1)+' '+escapeHtml(g.name)+'</b><span>'+escapeHtml(g.provider)+'</span></div><div class="time-game-result"><strong>'+range+'</strong><small>'+(best?best.rises+' aumentos em '+best.samples+' comparações nessa hora':'Precisamos de mais coletas por horário')+'</small></div><small class="time-game-foot">Histórico: '+g.intervals+' comparações nas últimas 24h · '+hoursSeen+'/24 horários com dados</small></article>';
 }).join(""):'<div class="empty">Ainda não há dados suficientes para comparar horários.</div>';
}
async function load(){
 $("refresh").disabled=true;$("refresh").textContent="Carregando…";
 try{
  const response=await fetch("./data/history.json?ts="+Date.now(),{cache:"no-store"});
  if(!response.ok)throw new Error("Não foi possível carregar o histórico");
  const data=await response.json();history=data.snapshots||[];
  try{const wr=await fetch("./data/wins.json?ts="+Date.now(),{cache:"no-store"});if(wr.ok){const wd=await wr.json();winEvents=wd.events||[];}}catch(_){winEvents=[];}
  render();if(window.renderAdvancedAnalysis)renderAdvancedAnalysis(history,winEvents);
 }catch(e){
  $("wins").innerHTML='<div class="empty">Não foi possível carregar o ranking. Tente novamente.</div>';
  $("ranking-summary").textContent="Falha ao carregar dados";
 }finally{$("refresh").disabled=false;$("refresh").textContent="Atualizar ↻"}
}
$("refresh").addEventListener("click",load);
$("period").addEventListener("change",render);
$("game-filter").addEventListener("input",render);
load();