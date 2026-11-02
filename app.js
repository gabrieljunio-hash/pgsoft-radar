const SOURCES=[
{id:"farra.bet",name:"Farra.bet"},{id:"jogou.io",name:"Jogou"},{id:"cassino365.bet",name:"Cassino10"},{id:"tokyoclubbet.com",name:"Tokyo Club"},{id:"betz1nha.com",name:"Betzinha"},{id:"jogofacil.net.br",name:"Jogo Fácil"}];
const $=id=>document.getElementById(id);let history=[];
const money=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0}).format(n);
const when=s=>new Date(s).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
const gameKey=s=>String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
function renderSources(){
 const by=new Map();for(const s of history){const x=by.get(s.source)||{last:null};if(!x.last||s.collected_at>x.last.collected_at)x.last=s;by.set(s.source,x)}
 $("source-count").textContent=by.size;$("source-label").textContent=by.size+" fonte(s) com dados históricos";
 $("sources-list").innerHTML=SOURCES.map(s=>{const x=by.get(s.id);return '<article class="source-item"><strong>'+s.name+'</strong><small>'+(x?'ÚLTIMA COLETA: '+when(x.last.collected_at)+' · '+Object.keys(x.last.games||{}).length+' jogos':'AGUARDANDO DADOS')+'</small></article>'}).join("");
}
function render(){
 const hours=Number($("period").value),cutoff=Date.now()-hours*3600000,filter=$("game-filter").value.trim().toLowerCase();
 if(!history.length){empty("Aguardando a primeira coleta automática.");return}
 const bySource=new Map();for(const s of history){if(!bySource.has(s.source))bySource.set(s.source,[]);bySource.get(s.source).push(s)}
 const grouped=new Map();
 for(const [source,snaps] of bySource){
  snaps.sort((a,b)=>new Date(a.collected_at)-new Date(b.collected_at));const current=snaps.at(-1);
  const base=hours===-1?null:(hours===0?snaps.at(-2):[...snaps].reverse().find(s=>new Date(s.collected_at).getTime()<=cutoff));
  if(hours!==-1&&(!base||base===current))continue;
  const prev=base?new Map(Object.entries(base.games||{}).map(([n,v])=>[gameKey(n),v])):null;
  for(const [name,latest] of Object.entries(current.games||{})){
   if(filter&&!name.toLowerCase().includes(filter))continue;
   const value=hours===-1?latest:latest-(prev.get(gameKey(name))??latest);if(hours!==-1&&value<=0)continue;
   const key=gameKey(name);if(!grouped.has(key))grouped.set(key,{game:name,value:0,sources:new Set(),bestSource:"",time:current.collected_at,image:""});
   const row=grouped.get(key);row.sources.add(source);
   if(value>row.value){row.value=value;row.bestSource=current.source_name||source;row.time=current.collected_at;}
  }
 }
 const rows=[...grouped.values()].sort((a,b)=>b.value-a.value);
 $("total-wins").textContent=money(rows.reduce((n,r)=>n+r.value,0));
 $("total-label").textContent=hours===-1?"SOMA DOS MAIORES VALORES":"SOMA DAS MAIORES VARIAÇÕES";
 $("games-label").textContent="JOGOS NO RANKING";$("sites-label").textContent="SITES COM DADOS";
 $("ranking-label").textContent=hours===-1?"Ranking de acumulados por jogo":"Ranking de aumentos por jogo";
 $("value-heading").textContent=hours===-1?"ACUMULADO":"AUMENTO";
 $("games-count").textContent=rows.length;$("casinos-count").textContent=new Set([...grouped.values()].flatMap(r=>[...r.sources])).size;
 $("common-count").textContent=rows.filter(r=>r.sources.size>=2).length;$("updated").textContent="Últimos dados: "+when(history.at(-1).collected_at);
 $("wins").innerHTML=rows.length?rows.map((r,i)=>'<article class="game-card"><span class="rank">#'+(i+1)+'</span>'+(r.image?'<img class="game-thumb" src="'+escapeHtml(r.image)+'" alt="" loading="lazy">':'<div class="game-thumb placeholder">'+escapeHtml(r.game.slice(0,2).toUpperCase())+'</div>')+'<div class="game-info"><h3>'+escapeHtml(r.game)+'</h3><strong>'+money(r.value)+'</strong><small>'+(hours===-1?'Acumulado publicado':'Aumento observado')+' · '+r.sources.size+' site(s)</small><small>Maior valor: '+escapeHtml(r.bestSource)+'</small><small>Última análise: '+escapeHtml(when(r.time))+'</small></div></article>').join(""):'<div class="empty">'+(hours===-1?'Nenhum jogo encontrado nas últimas coletas.':'Ainda não há aumento registrado para esse período.')+'</div>';
}
function empty(m){$("total-wins").textContent="—";$("games-count").textContent="—";$("casinos-count").textContent="—";$("common-count").textContent="—";$("wins").innerHTML='<div class="empty">'+m+'</div>'}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function load(){$("refresh").disabled=true;$("refresh").textContent="Atualizando…";try{const r=await fetch("./data/history.json?ts="+Date.now(),{cache:"no-store"});if(!r.ok)throw Error();const d=await r.json();history=Array.isArray(d.snapshots)?d.snapshots:[];renderSources();render()}catch(e){history=[];renderSources();empty("Histórico ainda não publicado.");$("updated").textContent="Sem dados"}finally{$("refresh").disabled=false;$("refresh").textContent="Atualizar dados ↻"}}
$("refresh").addEventListener("click",load);$("period").addEventListener("change",render);$("game-filter").addEventListener("input",render);load();