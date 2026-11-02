const SOURCES = [
  {name:"Farra.bet",url:"https://farra.bet/",detail:"Exibe uma área de ganhos por jogo; formato, histórico e atualização automática ainda precisam ser validados."},
  {name:"Opataco",url:"https://opataco.com/",detail:"Possui página de maiores ganhos; não tratar exemplos ou dados estáticos como resultados ao vivo."},
  {name:"PH28",url:"https://ph28.com/",detail:"Publica listas de grandes ganhos em janelas maiores; cobertura e timestamps precisam ser conferidos."}
];
const $ = id => document.getElementById(id);
function renderSources(){
  $("sources-list").innerHTML = SOURCES.map(s => `<article class="source-item"><strong>${s.name}</strong><small>${s.detail}</small><br><a href="${s.url}" target="_blank" rel="noopener noreferrer">Abrir fonte ↗</a><div class="tag">NÃO INTEGRADA · AGUARDANDO VALIDAÇÃO</div></article>`).join("");
  $("source-count").textContent = "0";
  $("source-label").textContent = "0 fontes com coleta automática validada";
}
function renderEmpty(){
  $("wins").innerHTML = '<tr><td colspan="5" class="empty">Sem registros reais disponíveis. Nenhuma fonte foi conectada ainda.</td></tr>';
  $("total-wins").textContent = "0";
  $("games-count").textContent = "0";
  $("casinos-count").textContent = "0";
  $("updated").textContent = "Sem coleta";
}
$("refresh").addEventListener("click", () => {
  renderEmpty();
  $("updated").textContent = "Fontes ainda não integradas";
});
$("game-filter").addEventListener("input", () => {
  // O filtro será aplicado quando houver registros reais.
});
$("period").addEventListener("change", () => renderEmpty());
renderSources();
renderEmpty();