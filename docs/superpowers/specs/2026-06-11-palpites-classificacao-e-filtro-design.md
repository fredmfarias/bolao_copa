# Palpites por classificação + filtro de placar — Design

**Data:** 2026-06-11
**Tela alvo:** `boloes/<bolaoId>/palpites/<jogoId>` (`apps/frontend/src/app/(app)/boloes/[id]/palpites/[jogoId]/page.tsx`)

## Objetivo

Na tela de palpites de um jogo:

1. **Ordenar os palpites pela classificação de cada usuário no bolão** e **destacar os 5 primeiros** com o mesmo estilo (CSS) das medalhas do ranking.
2. **Adicionar um filtro por placar**, client-side, visualmente alinhado ao design system (DS) do bolão.

A tela deve continuar funcionando normalmente quando o ranking ainda não foi publicado.

## Contexto atual

- A página busca os palpites em `GET /boloes/:bolaoId/apostas?jogoId=`, que o backend (`ApostaService.listarPalpitesPorJogo`) já ordena por `pontuacao desc, nome asc`. Cada palpite traz `usuarioId, nome, avatarUrl, placarCasa, placarVisitante, pontuacao` — **sem posição no ranking**.
- O estilo das medalhas vive em `apps/frontend/src/components/RankingRow.tsx`, no mapa `MEDALHAS` (posições 1–5 → classes metálicas de borda/texto: `border-trovao-gold/70`, `text-trovao-silver`, bronze esmaecido em 4–5). O destaque do próprio usuário usa `ring-2 ring-trovao-gold/60`.
- A posição vem de `GET /boloes/:bolaoId/ranking` → `RankingEntry[]` (campo `posicao`).
- O DS de chips já existe na própria tela (seletor de bolão): `rounded-full px-3 py-1 text-xs font-medium border`, selecionado `bg-trovao-gold text-trovao-base border-trovao-gold`, não selecionado `bg-trovao-surface text-trovao-muted border-trovao-border hover:border-trovao-gold`.

## Decisões de produto

- **Destaque dos 5 primeiros:** por **posição real no ranking** (ouro = 1º, prata = 2º, bronze = 3º, bronze esmaecido 4º/5º). Como a lista mostra só quem palpitou neste jogo, as posições podem pular (1º, 3º, 7º…). Só quem é de fato 1º–5º no bolão recebe medalha.
- **Mostrar a posição:** sim — cada linha exibe o número da posição real (ex.: `7º`) antes do avatar.
- **Sem ranking publicado:** a tela funciona normalmente — ordenação atual (`pontuação desc, nome`), sem números de posição e sem medalhas.
- **Filtro:** chips de placares distintos com contagem.

## Abordagem escolhida

Extrair os tokens de medalha para um módulo compartilhado e criar dois componentes pequenos; o join com o ranking é feito client-side na página. Sem mudanças no backend.

## Arquitetura

### Fluxo de dados

A página adiciona **uma** busca em paralelo com a de apostas, sob a mesma condição já existente (somente após o prazo encerrado):

```
Promise.all([
  api.get<Palpite[]>(`/boloes/${bolaoId}/apostas?jogoId=${jogoId}`),
  api.get<RankingEntry[]>(`/boloes/${bolaoId}/ranking`).catch(() => []),
])
```

A partir do `RankingEntry[]` monta-se um `Map<usuarioId, posicao>`. Se o ranking vier vazio (não publicado), o map fica vazio e a tela cai no comportamento atual.

O id do usuário atual é obtido via `useAuth()` (mesmo padrão da página de ranking), para aplicar o anel `ring-2 ring-trovao-gold/60` no próprio palpite.

### Ordenação

- Palpites **com** `posicao` conhecida → ordem crescente por `posicao`.
- Palpites **sem** `posicao` (membro ainda não ranqueado) → vão para o fim, mantendo entre si a ordem atual (`pontuação desc, nome asc` — já entregue pelo backend).

### Componentes

**`lib/medalhas.ts` (novo — fonte única de verdade)**
- Exporta o mapa `MEDALHAS: Record<number, { border: string; texto: string }>` (movido de `RankingRow.tsx`).
- Mantém as classes literais (sem interpolação) para o Tailwind não fazer purge.
- `RankingRow.tsx` passa a importar daqui (sem mudança visual).

**`components/PalpiteRow.tsx` (novo)**
- Props: `palpite`, `posicao?: number`, `isMe: boolean`, `jogo` (para os avatares das seleções).
- Renderiza:
  - Número da posição (`{posicao}º`) antes do avatar, estilizado como no ranking: `medalha.texto font-bold` para top 5, senão `text-trovao-muted`. Sem posição (sem ranking) → não exibe o número.
  - Borda da medalha para posições 1–5 via `MEDALHAS[posicao]`; senão `border-trovao-border`.
  - Anel `ring-2 ring-trovao-gold/60` quando `isMe`.
  - Avatar, nome, placar (`SelecaoAvatar` casa × visitante) e `+pontuação` — inalterados em relação a hoje.

**`components/PlacarFiltro.tsx` (novo)**
- Props: `palpites`, `value: string | null`, `onChange(value: string | null)`.
- Deriva client-side a lista de placares distintos (`"casa×visitante"`) com contagem, ordenada por contagem desc (desempate por placar).
- Renderiza uma linha de chips: primeiro `Todos`, depois um chip por placar com a contagem (ex.: `2 × 1 · 5`).
- Estilo idêntico ao seletor de bolão da tela (chips arredondados; selecionado dourado, não selecionado surface com hover dourado).
- **Não renderiza nada** quando há 0 ou 1 placar distinto (nada a filtrar).

### Integração na página

- Estado novo: `placarFiltro: string | null` (default `null` = Todos).
- A lista exibida é derivada: ordena pela classificação e, se `placarFiltro` estiver setado, filtra pelos palpites com aquele placar. Posições e medalhas continuam refletindo o ranking real (não são recalculadas sobre o subconjunto filtrado).
- O contador `N palpites` reflete a lista após o filtro.
- O markup inline atual da linha de palpite (linhas ~133–159) é substituído por `<PalpiteRow>`.

## Fora de escopo

- Nenhuma mudança no backend (o join é 100% client-side).
- `components/RankingTable.tsx` (legado) permanece intocado.
- Não recalcular posições/medalhas sobre o subconjunto filtrado.

## Tratamento de erros / borda

- Falha ao buscar o ranking → `catch(() => [])` → tela funciona em modo fallback.
- Membro com palpite mas sem posição → fim da lista, sem medalha nem número.
- Bolão global: usa o mesmo endpoint de ranking; se vazio, fallback.

## Testes

Agrupados ao final (preferência de iteração visual no dev server):

- **`PlacarFiltro`**: contagens corretas por placar; selecionar um chip filtra; chip `Todos` limpa; não renderiza com ≤1 placar distinto.
- **Ordenação / `PalpiteRow`**: medalhas aplicadas só aos top 5 por posição real; usuários sem posição ao fim; fallback sem ranking (sem números, sem medalhas, ordem do backend preservada); anel no próprio usuário.
