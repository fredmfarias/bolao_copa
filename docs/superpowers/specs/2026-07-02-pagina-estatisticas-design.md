# Página de Estatísticas do Bolão — Design

**Data:** 2026-07-02
**Status:** Aprovado em brainstorming, aguardando plano de implementação

## Objetivo

Criar uma página de estatísticas e curiosidades por bolão, exibindo recordes, rankings informais e padrões de apostas dos membros. A página é uma vitrine de leitura: sem filtros, comparações ou interações além da navegação.

## Decisões de design

| Decisão | Escolha | Justificativa |
|---|---|---|
| Escopo | **Por bolão** (cada bolão tem sua página) | Posições (1º/lanterna) já existem por bolão nos `RankingSnapshot`; rankings de posição só fazem sentido nesse contexto |
| Atualização | **Só rodadas publicadas** | Consistente com a filosofia de publicação do app; participantes nunca veem dados que o ranking ainda não mostrou |
| Arquitetura | **On-demand + cache em memória** | Volume minúsculo (~65 usuários, ~6.800 apostas no máximo); cache chaveado por publicação renova sozinho, sem tabela nova nem mudança no fluxo de publicação |

## As 20 estatísticas

Todas as consultas consideram apenas **jogos com `publicacaoId != null`** e **usuários ativos**.

### 🏆 A. Posições (fonte: `RankingSnapshot` do bolão)

1. **Rei da liderança** — mais snapshots com `posicao = 1`; top 3 usuários.
2. **Lanterna** — para cada publicação, lanterna = maior `posicao`; contagem por usuário, top 3.
3. **Foguete da rodada** — maior `posicoesGanhas` positivo já registrado (usuário, publicação, valor).
4. **Queda livre** — menor `posicoesGanhas` (mais negativo) já registrado.
5. **Mais regular** — menor desvio padrão de `posicao` entre publicações (exige ≥ 2 publicações).
6. **Frequência no top 5** — mais snapshots com `posicao <= 5`; top 3.

### 📈 B. Recordes de pontuação (fonte: `RankingSnapshot` + `Aposta × Jogo` no item 10)

7. **Maior pontuação numa rodada** — máximo de `pontuacaoRodada` (usuário, publicação, valor).
8. **Rodada mais generosa / mais avara** — publicação com maior e menor média de `pontuacaoRodada` do bolão.
9. **Rei do placar exato** — maior `acertosPlacarExato` no snapshot da última publicação; top 3.
10. **Aproveitamento por fase** — por fase (`JogoFase`): aproveitamento agregado do bolão = Σ pontos obtidos pelos membros ÷ (nº de membros ativos × Σ(pontos de placar exato × peso) dos jogos publicados da fase); e o **melhor da fase** = usuário com mais pontos somados nos jogos da fase. Exibido como tabela.

### 🎯 C. Palpites (fonte: `Aposta` dos membros × jogos publicados)

11. **Placar mais apostado** — contagem por par ordenado (`placarCasa` x `placarVisitante`); top 8 exibidos em gráfico de barras.
12. **Jogo mais consensual / mais dividido** — consensual = maior % de apostas no placar modal do jogo; dividido = maior nº de placares distintos (desempate: menor % modal).
13. **Otimistas vs pessimistas** — média de gols apostados por palpite (`placarCasa + placarVisitante`) por usuário (mínimo 5 apostas); extremos exibidos junto com a média real de gols dos jogos publicados.
14. **Apostador de última hora / O precavido** — mediana da antecedência (`fechamento − palpiteAtualizadoEm`, onde fechamento = `dataHora − 60 min`) por usuário, mínimo 5 apostas; menor mediana = última hora, maior = precavido.
15. **Quem mais re-enviou palpites** *(proxy)* — contagem de apostas com `palpiteAtualizadoEm − criadoEm > 2s` por usuário; top 3. **Limitação conhecida:** não há histórico de versões de palpite (o upsert sobrescreve a linha), então mede re-envios, não trocas de placar — re-enviar o mesmo placar também conta. A legenda do card deixa isso claro.
16. **Ninguém acredita em empate** — % de apostas com `placarCasa = placarVisitante` vs % de jogos publicados que terminaram empatados (pelo placar registrado, que na 2ª fase considera os 120 minutos).
20. **Os mais esquecidos** — nº de jogos publicados sem aposta do usuário (`jogos publicados − apostas do usuário em jogos publicados`, equivalente ao complemento de `apostasPostadas`); top 3, exibido só para quem tem ≥ 1 esquecimento.

### 🦓 D. Zebras e acertos raros (fonte: `Aposta.pontuacao` nos itens 17 e 19; comparação direta `aposta.placar` vs `jogo.placar` no item 18)

17. **A zebra da Copa** — jogo publicado com menor % de apostas que pontuaram (`pontuacao > 0`).
18. **Acertos solitários** — pares (jogo, usuário) onde exatamente 1 membro do bolão cravou o placar exato; lista até 10, mais recentes primeiro.
19. **Jogo mais previsível** — maior % de apostas que pontuaram.

## Backend

### Módulo `estatistica`

Novo módulo NestJS (`apps/backend/src/estatistica/`) com `EstatisticaController` e `EstatisticaService`, seguindo o padrão dos módulos existentes.

### Endpoint

`GET /boloes/:bolaoId/estatisticas`

- Protegido por JWT; verifica que o solicitante é membro do bolão (mesmo padrão das rotas de palpites).
- Retorna um único JSON:

```jsonc
{
  "temDados": true,
  "ultimaPublicacao": { "numero": 4, "publicadoEm": "..." },
  "posicoes": { /* itens 1–6 */ },
  "recordes": { /* itens 7–10 */ },
  "palpites": { /* itens 11–16, 20 */ },
  "zebras": { /* itens 17–19 */ }
}
```

- Usuários referenciados como `{ id, nome, avatarUrl }` (padrão das outras rotas).
- **Empates em recordes:** retorna todos os empatados; a UI mostra até 3 nomes + "e mais X".
- **Estatística incalculável** (ex.: divisão por zero em bolão sem apostas): o campo individual vem `null` e a UI omite o card — a página nunca quebra inteira.

### Cache

`Map` em memória no service, chave `${bolaoId}:${ultimaPublicacaoId}`:

1. A cada request, 1 query mínima busca o id da última publicação.
2. Cache hit → responde direto. Miss → calcula (~10 queries agregadas, milissegundos neste volume), grava e responde.
3. Ao publicar rodada nova, a chave muda e o cache renova naturalmente — sem lógica de invalidação.
4. Guarda apenas a entrada mais recente por bolão (a anterior é descartada na gravação).
5. Só resultados completos entram no cache; falha no cálculo propaga como `500` e a próxima tentativa recalcula.
6. No Cloud Run, cada instância tem seu próprio cache — aceitável, o recomputo é barato.

## Frontend

### Rota e entrada

- Página em `apps/frontend/src/app/(app)/boloes/[id]/estatisticas/page.tsx` (client component, padrão de fetch das telas existentes).
- Ponto de entrada: botão/link "Estatísticas" (ícone de gráfico) na página do bolão (`/boloes/[id]`).

### Layout (mobile-first, shadcn/ui + Tailwind)

- **Header:** nome do bolão + nota "dados até a rodada N".
- **4 seções** (🏆 Posições, 📈 Recordes, 🎯 Palpites, 🦓 Zebras) com cards em grid — 1 coluna no mobile, 2–3 no desktop.
- **Card padrão:** ícone + título, avatar(es) + nome(s) do(s) destaque(s) (até 3 empatados + "e mais X"), valor em destaque, legenda curta explicando a métrica. Reutiliza o componente de avatar do ranking.
- **Exceções ao card padrão:**
  - Item 11: gráfico de barras horizontais (Recharts, já na stack) com os top 8 placares.
  - Item 10: tabela compacta fase × aproveitamento × melhor da fase.
- **Estados:** skeletons no loading; erro com botão "tentar novamente"; estado vazio quando `temDados: false` ("as estatísticas aparecem após a primeira rodada publicada"); cards `null` não renderizam.

## Tratamento de erros

| Cenário | Comportamento |
|---|---|
| Bolão inexistente | `404` |
| Solicitante não é membro | `403` |
| Nenhuma publicação | `200` com `{ temDados: false }` |
| Falha inesperada no cálculo | `500`; nada entra no cache |
| Estatística individual incalculável | Campo `null`; card omitido na UI |

## Testes

- **Backend** (`estatistica.service.spec.ts`, ts-jest + Prisma mock, como `aposta.service.spec.ts`) — cobertura principal:
  - Cada grupo de estatística com dados sintéticos pequenos e resultado conhecido.
  - Empate em recorde retorna todos os empatados.
  - Usuário inativo excluído; jogo não publicado ignorado.
  - Proxy de re-envio respeita a tolerância de 2s.
  - Sem publicação → `temDados: false`.
  - Cache: segunda chamada com a mesma publicação não re-consulta; publicação nova recalcula.
- **Frontend** (Testing Library): renderização das 4 seções com payload de exemplo; estados vazio e de erro; card `null` omitido.
- **E2E** (Playwright, projeto `api`): caminho feliz (seed com publicação → `200` com seções preenchidas) e `403` para não-membro.

## Fora de escopo (YAGNI)

- Filtros, comparação entre usuários e compartilhamento.
- Tabela de histórico de palpites (`aposta_historico`) — a Copa já está em andamento e o passado seria irrecuperável; o proxy do item 15 cobre a curiosidade.
- Estatísticas globais entre bolões.

## Documentação

Na implementação, atualizar o README (seção Funcionalidades e estrutura do monorepo) com a nova página, conforme a convenção do projeto.
