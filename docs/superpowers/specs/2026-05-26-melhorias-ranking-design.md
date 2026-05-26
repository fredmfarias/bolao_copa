# Design: Melhorias na tela de ranking

**Data:** 2026-05-26
**Status:** Aprovado

## Contexto

A tela de ranking (`/boloes/[bolaoId]/ranking`) tem três problemas a corrigir:

1. O pódio exibe o 1º lugar visualmente na posição errada.
2. Os 3 primeiros colocados não aparecem na lista expandível abaixo do pódio.
3. O gráfico de evolução fica fixo ("Sua evolução") e não acompanha a pessoa selecionada.

---

## Escopo

Três mudanças localizadas, sem alteração na API ou no backend:

- `apps/frontend/src/components/RankingPodium.tsx`
- `apps/frontend/src/components/RankingRow.tsx`
- `apps/frontend/src/app/(app)/ranking/[bolaoId]/page.tsx`

---

## 1. Correção do pódio (`RankingPodium.tsx`)

### Problema

O componente usa um array `ORDER = [1, 0, 2]` com mapeamento indireto de índices. A indireção introduz ambiguidade visual e possivelmente causa a renderização errada do 1º lugar.

### Solução

Substituir o `ORDER` por um array explícito de slots com posição, medalha e altura definidos diretamente:

```ts
const slots = [
  { entry: top3[1], medal: '🥈', height: 'h-16', isCenter: false }, // esquerda: 2º lugar
  { entry: top3[0], medal: '🥇', height: 'h-24', isCenter: true  }, // centro:   1º lugar
  { entry: top3[2], medal: '🥉', height: 'h-12', isCenter: false }, // direita:  3º lugar
];
```

O `scale-110` é aplicado via `isCenter` em vez de `idx === 0`. Layout esperado:

```
        [1º]
  [2º]  🥇    [3º]
  🥈   ████   🥉
  ████  ████  ████
  ████  ████
```

---

## 2. Top 3 incluídos na lista (`page.tsx`)

### Problema

A lista abaixo do pódio usa `ordenado.slice(3)`, excluindo os 3 primeiros e impedindo ver seus detalhes de acertos.

### Solução

Remover o `slice(3)`. Todos os participantes aparecem na lista, incluindo os 3 primeiros — que aparecem tanto no pódio quanto na lista.

```tsx
// Antes
{(aba === 'geral' ? ordenado.slice(3) : ordenado).map(entry => ...)}

// Depois
{ordenado.map(entry => ...)}
```

---

## 3. Gráfico de evolução na expansão (`RankingRow.tsx` + `page.tsx`)

### Problema

O gráfico de evolução é exibido fixo acima da lista ("Sua evolução"), sempre mostrando dados do usuário logado, sem relação com a linha expandida.

### Solução

Mover o gráfico para dentro de cada `RankingRow`. Ao expandir uma linha pela primeira vez, o componente faz uma chamada lazy ao endpoint de evolução daquela pessoa:

```
GET /boloes/:bolaoId/ranking/evolucao?usuarioId=:usuarioId
```

O resultado é cacheado em state local (`useState<EvolucaoPonto[] | null>`). Expansões subsequentes não refazem a chamada.

O gráfico aparece abaixo dos acertos **somente se** o array retornado tiver dados. Se a pessoa não tiver histórico, nenhum espaço é reservado.

#### Estrutura do painel expandido

O grid de acertos exibe 6 itens em 2 colunas, mapeados para os seguintes campos de `RankingEntry`:

| Label | Campo |
|---|---|
| Placar exato | `acertosPlacarExato` |
| Placar do vencedor correto | `acertosPlacarVencedor` |
| Empate correto (sem placar exato) | `acertosEmpate` |
| Placar do perdedor correto | `acertosPlacarPerdedor` |
| Acertou apenas o vencedor | `acertosGanhador` |
| Apostas feitas | `apostasPostadas` |

```
┌─ Acertos (grid 2 colunas) ──────────────────────────────┐
│ Placar exato              N    Placar do vencedor    N   │
│ Empate correto            N    Placar do perdedor    N   │
│ Acertou apenas vencedor   N    Apostas feitas        N   │
└──────────────────────────────────────────────────────────┘
┌─ Evolução (só se houver dados) ─────────────────────────┐
│  [spinner enquanto carrega]                              │
│  [RankingEvolucao com dados quando pronto]               │
└──────────────────────────────────────────────────────────┘
```

#### Props adicionadas ao `RankingRow`

```ts
interface RankingRowProps {
  entry: RankingEntry;
  myId?: string;
  bolaoId: string; // novo
}
```

#### Remoções em `page.tsx`

- Estado `evolucao` e setter `setEvolucao`
- Chamada `api.get('/evolucao')` no `useEffect` inicial
- Bloco JSX "Sua evolução" (linhas ~100–103)
- Import de `RankingEvolucao` (passa para `RankingRow`)

---

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `RankingPodium.tsx` | Substituir `ORDER` por slots explícitos |
| `RankingRow.tsx` | Adicionar prop `bolaoId`, fetch lazy de evolução, exibir `RankingEvolucao` na expansão |
| `page.tsx` | Remover `slice(3)`, remover estado/fetch/bloco de evolução, passar `bolaoId` para `RankingRow` |

---

## Fora de escopo

- Alterações no backend ou na API
- Mudanças na aba "Rodada"
- Refatoração de outros aspectos da tela
