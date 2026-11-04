(function(root,factory){
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 root.RadarCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 function groupMirroredSources(entries,toleranceMs=10*60*1000){
  const sources=(entries||[]).map(entry=>({
   id:entry.id,
   points:(entry.points||[]).filter(p=>Number.isFinite(Number(p.value))&&Number.isFinite(Number(p.t))).map(p=>({t:Number(p.t),value:Number(p.value)})).sort((a,b)=>a.t-b.t)
  }));
  const parent=sources.map((_,i)=>i);
  const find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
  const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
  const trajectoryMatch=(a,b)=>{
   if(a.length<3||b.length<3)return false;
   let i=0,j=0,matches=0,distinct=new Set();
   while(i<a.length&&j<b.length){
    const diff=a[i].t-b[j].t;
    if(Math.abs(diff)<=toleranceMs){
     if(Math.abs(a[i].value-b[j].value)<=0.000001){matches++;distinct.add(a[i].value);}
     i++;j++;
    }else if(diff<0)i++;else j++;
   }
   const coverage=matches/Math.min(a.length,b.length);
   return matches>=3&&coverage>=0.85&&distinct.size>=2;
  };
  for(let i=0;i<sources.length;i++)for(let j=i+1;j<sources.length;j++){
   if(trajectoryMatch(sources[i].points,sources[j].points))join(i,j);
  }
  const groups=new Map();
  sources.forEach((source,i)=>{
   const root=find(i);
   if(!groups.has(root))groups.set(root,[]);
   groups.get(root).push(source);
  });
  return [...groups.values()].map(members=>{
   const representative=[...members].sort((a,b)=>b.points.length-a.points.length)[0];
   return {members:members.map(s=>s.id),representative};
  });
 }
 return {groupMirroredSources};
});
