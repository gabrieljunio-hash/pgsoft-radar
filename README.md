# PGSoft Radar

Painel independente para observar dados públicos de grandes ganhos de jogos PG Soft em diferentes cassinos.

## Funcionamento atual

- O GitHub Actions tenta coletar a cada 15 minutos a página pública [Farra.bet — PG Soft](https://farra.bet/cassino/pg-soft).
- A fonte exibe valores **“Pagou hoje” por jogo**. O coletor salva snapshots desses acumulados.
- O painel compara snapshots e mostra a variação observada no período selecionado.
- O histórico é mantido por até 30 dias.
- O primeiro intervalo só aparece depois de pelo menos duas coletas.

## Limitação essencial

A fonte não fornece, na página pública identificada, uma lista verificável de cada prêmio individual com horário. Portanto, o sistema **não afirma que a diferença entre dois snapshots é um prêmio individual**. É apenas o aumento observado no acumulado diário divulgado pelo cassino. Se o valor cair (por reinício diário ou correção), a variação é descartada.

A coleta é experimental: se o site mudar a estrutura, bloquear requisições automatizadas ou deixar de publicar os valores, a execução falhará e o painel não inventará resultados.

## Próximas integrações

Opataco e PH28 permanecem como candidatas, mas não entram no ranking até ser possível validar nome do jogo, valor e significado/horário do dado. Uma segunda fonte com métrica comparável permitirá verificar se tendências observadas aparecem em mais de um cassino.

## Publicação

No GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root)**.

Site: https://gabrieljunio-hash.github.io/pgsoft-radar/

## Métrica e uso responsável

Os dados são retrospectivos e incompletos. Não medem probabilidade, RTP real, chance de ganho nem preveem resultados futuros. Cada rodada é independente. Projeto independente, sem afiliação à PG Soft ou aos cassinos citados.
