const assert=require("node:assert/strict");
const {groupMirroredSources}=require("../ranking-core.js");
const t=Date.parse("2026-11-04T00:00:00Z");
const series=(id,values,offset=0)=>({id,points:values.map((value,i)=>({t:t+i*300000+offset,value}))});
{
 const groups=groupMirroredSources([
  series("a",[10,11,11,15,17]),
  series("b",[10,11,11,15,17],20000),
  series("c",[5,7,8,8,9])
 ]);
 assert.equal(groups.length,2,"trajetórias iguais devem formar um grupo");
 assert.deepEqual(groups.find(g=>g.members.includes("a")).members,["a","b"]);
}
{
 const groups=groupMirroredSources([
  series("a",[10,10,10,10,10]),
  series("b",[10,10,10,10,10],10000)
 ]);
 assert.equal(groups.length,2,"valores estáticos não provam espelhamento");
}
{
 const groups=groupMirroredSources([
  series("a",[10,11,12,13,14]),
  series("b",[10,11,90,13,14])
 ]);
 assert.equal(groups.length,2,"trajetórias divergentes permanecem separadas");
}
{
 const groups=groupMirroredSources([series("a",[1,2]),series("b",[1,2])]);
 assert.equal(groups.length,2,"amostras curtas não são agrupadas");
}
console.log("4 testes de independência de fontes passaram.");
