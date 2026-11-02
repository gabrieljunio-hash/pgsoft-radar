# PGSoft Radar

Painel independente para reunir e comparar **grandes ganhos publicamente divulgados** em jogos PG Soft por diferentes cassinos.

## Estado atual

- Interface responsiva publicada como site estático.
- Cadastro inicial de fontes candidatas para integração.
- Nenhum resultado fictício é exibido.
- As fontes listadas ainda **não estão conectadas**: os sites precisam ser inspecionados e os dados/timestamps validados antes de qualquer ranking.

## Limitação dos dados

Não existe, até onde foi possível confirmar, um feed público global da PG Soft com todos os pagamentos feitos em todos os cassinos. O painel só poderá comparar eventos que cada cassino disponibilizar publicamente. Um ganho publicado não representa todas as rodadas, não mede a chance futura e não permite prever o próximo resultado.

## Próximas etapas

1. Validar cada fonte: acesso público, identificação do jogo, valor, moeda e horário do evento.
2. Criar adaptadores independentes por cassino, respeitando termos de uso e limites de acesso.
3. Implementar coleta agendada e armazenamento histórico.
4. Deduplicar eventos e normalizar moedas/horários.
5. Liberar filtros de 1h, 6h, 24h e 7 dias somente para dados com timestamp verificável.

## Publicação

O projeto pode ser publicado pelo GitHub Pages: **Settings → Pages → Deploy from a branch → main → /(root)**.

## Desenvolvimento

Somente HTML, CSS e JavaScript no estágio inicial. A coleta automática exigirá uma rotina de servidor/agendamento; não é seguro nem confiável fazer scraping diretamente do navegador do visitante.

Projeto independente, sem afiliação à PG Soft ou aos cassinos mencionados.