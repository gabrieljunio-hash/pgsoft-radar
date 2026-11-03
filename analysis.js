function renderAdvancedAnalysis(){
 const root=document.getElementById("advanced-analysis");if(!root)return;
 const groups=new Map(),stats=new Map(),winCount=(window.winEvents||[]).length;
 for(const s of window.history||[]){
  const t=Date.parse(s.collected_at);if(!Number.isFinite(t))continue;
  const id=(s.source||"")+"|"+(s.provider||"PG Soft");
  if(!groups.has(id))groups.set(id,[]);
  groups.get(id).push({t,games:s.games||{}});
 }
 for(const points of groups.values()){
  points.sort((a,b)=>a.t-b.t);
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i];if(b.t<=a.t)continue;
   const row=[];
   for(const name of new Set([...Object.keys(a.games),...Object.keys(b.games)])){
    const old=Number(a.games[name]),cur=Number(b.games[name]);
    if(!Number.isFinite(old)||!Number.isFinite(cur)||!old)continue;
    const id=String(name).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    const pct=(cur-old)/Math.abs(old)*100;
    if(!stats.has(id))stats.set(id,{name,changes:[],gaps:[],last:0});
    const g=stats.get(id);g.changes.push(pct);
    if(pct>0){if(g.last)g.gaps.push((b.t-g.last)/3600000);g.last=b.t;}
    row.push({id,pct});
   }
   if(!window._radarRows)window._radarRows=[];
   window._radarRows.push(row);
  }
 }
 const all=[...stats.values()],n=all.reduce((v,g)=>v+g.changes.length,0);
 const cycles=all.filter(g=>g.gaps.length>=2).map(g=>{const m=g.gaps.reduce((a,b)=>a+b,0)/g.gaps.length,sd=Math.sqrt(g.gaps.reduce((a,b)=>a+(b-m)**2,0)/g.gaps.length);return {...g,avg:m,cv:m?sd/m:99};}).sort((a,b)=>a.cv-b.cv);
 const anomalies=all.filter(g=>g.changes.length>=5).map(g=>{const a=[...g.changes].sort((x,y)=>x-y),med=a[Math.floor(a.length/2)],d=a.map(x=>Math.abs(x-med)).sort((x,y)=>x-y),mad=d[Math.floor(d.length/2)]||0,z=mad?Math.abs(g.changes.at(-1)-med)/(1.4826*mad):0;return {...g,z};}).filter(g=>g.z>=3).sort((a,b)=>b.z-a.z);
 const volatility=all.filter(g=>g.changes.length>=5).map(g=>{const m=g.changes.reduce((a,b)=>a+b,0)/g.changes.length;return {...g,sd:Math.sqrt(g.changes.reduce((a,b)=>a+(b-m)**2,0)/g.changes.length)};}).sort((a,b)=>b.sd-a.sd);
 const pairs=new Map();
 for(const row of window._radarRows||[])for(let i=0;i<row.length;i++)for(let j=i+1;j<row.length;j++){
  const a=row[i],b=row[j],key=a.id<b.id?a.id+"~"+b.id:b.id+"~"+a.id;
  if(!pairs.has(key))pairs.set(key,{a:a.id,b:b.id,x:[],y:[]});
  const p=pairs.get(key);if(a.id<b.id){p.x.push(a.pct);p.y.push(b.pct);}else{p.x.push(b.pct);p.y.push(a.pct);}
 }
 const correlations=[];
 for(const p of pairs.values()){if(p.x.length<4)continue;const mx=p.x.reduce((a,b)=>a+b,0)/p.x.length,my=p.y.reduce((a,b)=>a+b,0)/p.y.length;let xy=0,xx=0,yy=0;for(let i=0;i<p.x.length;i++){xy+=(p.x[i]-mx)*(p.y[i]-my);xx+=(p.x[i]-mx)**2;yy+=(p.y[i]-my)**2;}if(xx&&yy)correlations.push({...p,r:xy/Math.sqrt(xx*yy)});}
 correlations.sort((a,b)=>Math.abs(b.r)-Math.abs(a.r));
 const simulations=all.filter(g=>g.changes.length>=5).map(g=>{const results=[];for(let i=0;i<1000;i++){let sum=0;for(let j=0;j<3;j++)sum+=g.changes[Math.floor(Math.random()*g.changes.length)];results.push(sum);}results.sort((a,b)=>a-b);return {...g,lo:results[49],hi:results[949]};}).sort((a,b)=>b.hi-a.hi);
 const stars=k=>"★".repeat(k)+"☆".repeat(5-k),rating=k=>'<span class="analysis-stars" aria-label="'+k+' de 5">'+stars(k)+'</span>';
 const cards=[
 {id:"cycles",name:"Ciclos",tags:"intervalos · recorrência · ritmo",k:n>=500?4:n>=100?3:n>=30?2:1,result:cycles.length?cycles.slice(0,3).map(g=>g.name+" · "+g.avg.toFixed(1)+"h").join("<br>"):"Amostra insuficiente",info:"Intervalo médio entre aumentos e regularidade dos intervalos. Não indica que um novo aumento esteja próximo."},
 {id:"before",name:"Antes/depois",tags:"pagamentos · janelas · comparação",k:winCount>=100?5:winCount>=30?4:winCount>=10?3:winCount?2:1,result:winCount?winCount+" eventos individuais disponíveis":"Sem eventos individuais registrados",info:"Compara as coletas antes e depois de pagamentos individuais com horário identificado. O histórico atual não possui esses eventos; acumulados não substituem pagamentos."},
 {id:"anomaly",name:"Anomalias",tags:"picos · desvios · exceções",k:n>=1000?5:n>=300?4:n>=100?3:n>=30?2:1,result:anomalies.length?anomalies.slice(0,3).map(g=>g.name+" · "+g.z.toFixed(1)+"x").join("<br>"):"Nenhum desvio forte detectado",info:"Detecta variações fora do padrão histórico do próprio jogo usando desvio absoluto mediano. Pode apontar ruído ou mudança na fonte."},
 {id:"correlation",name:"Correlação",tags:"jogos relacionados · sincronia",k:correlations.length>=100?5:correlations.length>=30?4:correlations.length>=10?3:correlations.length>=3?2:1,result:correlations.length?correlations.slice(0,3).map(p=>{const a=all.find(g=>g.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()===p.a),b=all.find(g=>g.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()===p.b);return (a?.name||p.a)+" + "+(b?.name||p.b)+" · "+p.r.toFixed(2);}).join("<br>"):"Poucas coletas simultâneas",info:"Compara variações percentuais de jogos presentes na mesma coleta. Correlação não prova causa nem relação entre jogadores."},
 {id:"volatility",name:"Volatilidade",tags:"estabilidade · oscilação · amplitude",k:n>=1000?5:n>=300?4:n>=100?3:n>=30?2:1,result:volatility.length?volatility.slice(0,3).map(g=>g.name+" · "+g.sd.toFixed(3)+"%").join("<br>"):"Histórico insuficiente",info:"Mede a dispersão das variações percentuais. Alta volatilidade significa maior oscilação dos dados, não maior chance de prêmio."},
 {id:"simulation",name:"Cenários",tags:"reamostragem · 1.000 simulações · faixa",k:n>=1000?5:n>=300?4:n>=100?3:n>=30?2:1,result:simulations.length?simulations.slice(0,3).map(g=>g.name+" · "+g.lo.toFixed(3)+"% a "+g.hi.toFixed(3)+"%").join("<br>"):"Amostra insuficiente",info:"Reamostra três variações históricas por rodada, 1.000 vezes. A faixa descreve cenários da distribuição passada; não é previsão nem probabilidade de pagamento."}
 ];
 root.innerHTML=cards.map(c=>'<article class="insight-card"><div class="insight-top"><h3>'+c.name+'</h3>'+rating(c.k)+'</div><div class="insight-tags">'+c.tags.split(" · ").map(t=>'<span>'+t+'</span>').join("")+'</div><div class="insight-result">'+c.result+'</div><button class="info-button" type="button" data-info="'+c.id+'" aria-expanded="false">i</button><div class="insight-detail" id="detail-'+c.id+'" hidden>'+c.info+'</div></article>').join("");
 root.querySelectorAll(".info-button").forEach(b=>b.addEventListener("click",()=>{const d=document.getElementById("detail-"+b.dataset.info),open=d.hidden;d.hidden=!open;b.setAttribute("aria-expanded",String(open));b.textContent=open?"×":"i";}));
 window._radarRows=[];
}