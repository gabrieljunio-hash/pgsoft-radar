# PGSoft Radar

Painel independente para observar dados públicos de acumulados diários de jogos PG Soft em diferentes sites.

## Fontes monitoradas

- [Farra.bet](https://farra.bet/cassino/pg-soft)
- [Jogou](https://jogou.io/cassino/pg-soft)
- [Cassino10](https://www.cassino365.bet/cassino/pg-soft)
- [Tokyo Club](https://tokyoclubbet.com/cassino/pg-soft)
- [Betzinha](https://betz1nha.com/cassino/pg-soft)
- [Jogo Fácil](https://jogofacil.net.br/cassino/pg-soft)

O coletor consulta seis fontes a cada 15 minutos. Uma falha em um site não impede a coleta dos demais. Fontes só entram no histórico quando o parser encontra pelo menos cinco jogos com valores válidos. A página da Cazé Bet foi testada, mas não forneceu valores legíveis pelo coletor e ficou fora da lista ativa.

## Métrica e comparação

As páginas exibem valores "Pagou hoje" por jogo. O sistema salva snapshots por fonte e compara o valor mais recente com o registro anterior ao início do período selecionado. O painel mostra variações por jogo e site, além de destacar jogos que apresentaram aumento em duas ou mais fontes no mesmo intervalo.

**Importante:** a diferença entre snapshots não é um prêmio individual. Os sites podem compartilhar fornecedores, infraestrutura ou dados, portanto fontes distintas não significam necessariamente operadores independentes. A soma entre fontes não deve ser interpretada como pagamentos únicos. Se o acumulado cair por reinício diário ou correção, essa variação não é contabilizada como aumento.

## Histórico e automação

- GitHub Actions executa a cada 15 minutos e também aceita acionamento manual.
- O histórico mantém até 30 dias.
- Testes unitários verificam os dois formatos de página conhecidos.
- Uma fonte indisponível é registrada como falha no log, sem descartar os dados válidos das demais.

## Publicação

GitHub Pages: https://gabrieljunio-hash.github.io/pgsoft-radar/

## Uso responsável

Os dados são retrospectivos e incompletos. Não medem probabilidade, RTP real, chance de ganho nem preveem resultados futuros. Cada rodada é independente. Projeto independente, sem afiliação aos sites ou à PG Soft. 18+.
