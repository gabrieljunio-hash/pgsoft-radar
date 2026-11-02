const SOURCES = [{name:"Farra.bet",url:"https://farra.bet/cassino/pg-soft",detail:"Página PG Soft com acumulados diários por jogo. A coleta experimental compara snapshots; não identifica apostas individuais."}];
const $ = id => document.getElementById(id);
let history = [];
const money = n => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
const when = s => new Date(s).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
function renderSources(status="Aguardando primeira coleta"){
  $("sources-list").innerHTML=SOURCES.map(s=>`<article class="source-item"><strong>${s.name}</strong><small>${s.detail}</small><br><a href="${s.url}" target="_blank" rel="noopener noreferrer">Abrir fonte ↗</a><div class="tag">${status.toUpperCase()}</div></article>`).join("");
}
function render(){
  const hours=Number($("period").value), cutoff=Date.now()-hours*3600000;
  const current=history.at(-1);
  const base=[...history].reverse().find(x=>new Date(x.collected_at).getTime()<=cutoff);
  const filter=$("game-filter").value.trim().toLocaleLowerCase("pt-BR");
  if(!current){empty("Aguardando a primeira coleta automática.");return;}
  $("updated").textContent="Última coleta: "+when(current.collected_at);
  if(!base || base===current){empty("Ainda não há duas coletas que cubram esse período. O sistema precisa acumular histórico antes de calcular variações.");return;}
  const rows=[];
  for(const [game,latest] of Object.entries(current.games||{})){
    if(filter&&!game.toLocaleLowerCase("pt-BR").includes(filter))continue;
    const previous=base.games?.[game];
    if(typeof previous!=="number"||latest<previous)continue;
    const delta=latest-previous;
    if(delta>0)rows.push({game,delta,latest});
  }
  rows.sort((a,b)=>b.delta-a.delta);
  $("total-wins").textContent=money(rows.reduce((s,r)=>s+r.delta,0));
  $("games-count").textContent=String(rows.length);
  $("casinos-count").textContent=rows.length?"1":"0";
  $("wins").innerHTML=rows.length?rows.map(r=>`<tr><td><b>${escapeHtml(r.game)}</b></td><td>Farra.bet</td><td>${money(r.delta)}</td><td>${when(current.collected_at)}</td><td><a href="https://farra.bet/cassino/pg-soft" target="_blank" rel="noopener noreferrer">Abrir ↗</a></td></tr>`).join(""):'<tr><td colspan="5" class="empty">Nenhum aumento positivo observado nesse intervalo.</td></tr>';
}
function empty(message){
  $("total-wins").textContent="—";$("games-count").textContent="—";$("casinos-count").textContent="—";
  $("wins").innerHTML=`<tr><td colspan="5" class="empty">${message}</td></tr>`;
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function load(){
  $("refresh").disabled=true;$("refresh").textContent="Atualizando…";
  try{
    const response=await fetch("./data/history.json?ts="+Date.now(),{cache:"no-store"});
    if(!response.ok)throw new Error("Histórico ainda não publicado");
    const data=await response.json();history=Array.isArray(data.snapshots)?data.snapshots:[];
    renderSources(history.length?"COLETA AUTOMÁTICA EXPERIMENTAL":"AGUARDANDO COLETA");render();
  }catch(e){renderSources("COLETA NÃO DISPONÍVEL");empty("Histórico ainda não publicado. A primeira execução do coletor precisa ser concluída.");$("updated").textContent="Sem dados";}
  finally{$("refresh").disabled=false;$("refresh").textContent="Atualizar dados ↻";}
}
$("refresh").addEventListener("click",load);
$("period").addEventListener("change",render);
$("game-filter").addEventListener("input",render);
load();
