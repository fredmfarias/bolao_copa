# Spec: View de Distribuição de Placares

**Data:** 2026-06-01
**Status:** Aprovado

---

## Contexto

O app já impõe limites de apostas idênticas por fase (18 no Grupos, 8 nas Eliminatórias). Hoje o usuário não tem como saber quantas vezes apostou em cada placar — ele só descobre o limite quando tenta salvar e recebe um erro. O objetivo desta feature é dar visibilidade antecipada dessa distribuição, com acesso direto à edição das apostas ainda abertas.

---

## Objetivo

Criar uma aba "Meus Placares" dentro da página de Jogos que mostre a distribuição dos placares apostados pelo usuário, agrupada por fase, com contagem vs. limite e acesso à edição de apostas abertas.

---

## Escopo

### O que está incluído

- Nova aba "Meus Placares" nos chips de filtro da página de Jogos
- Dois grupos distintos: Fase de Grupos (limite 18) e Fases Eliminatórias (limite 8)
- Para cada placar único: contagem, barra de progresso e lista expansível de jogos
- Botão "Editar" para apostas ainda abertas (prazo não encerrado)
- Pontuação obtida (`+N pts`) ou `Aguardando` para apostas encerradas

### O que não está incluído

- Novo endpoint de API (cálculo 100% no frontend)
- Estatísticas de performance (acertos, pontuação total) — foco exclusivo em distribuição de placares

---

## Arquitetura

### Fluxo de dados

Zero novas chamadas de API. O `GET /apostas` já retornado na carga inicial da `JogosPage` inclui cada `Aposta` com o `jogo` embutido (`fase`, `selecaoCasa`, `selecaoVisitante`, `dataHora`, `placarCasa`, `placarVisitante`). A distribuição é calculada puramente no frontend a partir desse estado.

### Integração com estado existente

```
JogosPage
  ├─ apostas: Map<jogoId, Aposta>   ← já existente
  ├─ jogos: Jogo[]                  ← já existente
  ├─ jogoSelecionado                ← ApostaDrawer já existente
  └─ filtro: FiltroJogo             ← adiciona 'Placares'

Quando filtro === 'Placares':
  └─ renderiza <PlacaresDist apostas={[...apostas.values()]} onApostar={setJogoSelecionado} />
     └─ edição via ApostaDrawer existente
        └─ onSalvo → recarregarApostas() → PlacaresDist re-renderiza
```

---

## Modificações em arquivos existentes

### `apps/frontend/src/lib/jogoEstado.ts`

Adiciona `'Placares'` ao union type:

```ts
export type FiltroJogo = 'Todos' | 'Pendentes' | 'Apostados' | 'Encerrados' | 'Placares';
```

As funções `jogoNoFiltro` e `ordenarPorFiltro` não precisam tratar `'Placares'` — a `JogosPage` faz early-return para esse filtro antes de chamá-las.

### `apps/frontend/src/components/FiltroJogosChips.tsx`

Adiciona `'Placares'` ao array `FILTROS` e ao record `FILTRO_LABELS`:

```ts
const FILTROS: FiltroJogo[] = ['Todos', 'Pendentes', 'Apostados', 'Encerrados', 'Placares'];

const FILTRO_LABELS: Record<FiltroJogo, string> = {
  ...
  Placares: 'Meus Placares',
};
```

### `apps/frontend/src/app/(app)/jogos/page.tsx`

Quando `filtro === 'Placares'`, renderiza `PlacaresDist` no lugar da lista:

```tsx
{filtro === 'Placares' ? (
  <PlacaresDist
    apostas={[...apostas.values()]}
    onApostar={setJogoSelecionado}
  />
) : (
  // lista de jogos existente
)}
```

---

## Novo componente: `PlacaresDist.tsx`

**Localização:** `apps/frontend/src/components/PlacaresDist.tsx`

### Props

```ts
interface PlacasDistProps {
  apostas: Aposta[];
  onApostar: (jogo: Jogo) => void;
}
```

### Lógica interna

```ts
type PlacarGrupo = {
  placarCasa: number;
  placarVisitante: number;
  apostas: Aposta[];
};

function agruparPorPlacar(apostas: Aposta[]): PlacarGrupo[] {
  const map = new Map<string, Aposta[]>();
  for (const a of apostas) {
    const key = `${a.placarCasa}-${a.placarVisitante}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  return Array.from(map.values())
    .map(lista => ({
      placarCasa: lista[0].placarCasa,
      placarVisitante: lista[0].placarVisitante,
      apostas: lista,
    }))
    .sort((a, b) => b.apostas.length - a.apostas.length);
}
```

A separação entre grupos e eliminatórias usa `FASES_ELIMINATORIAS` do pacote `@bolao/shared`:

```ts
const apostasGrupos = apostas.filter(a => !FASES_ELIMINATORIAS.includes(a.jogo.fase as JogoFase));
const apostasElim   = apostas.filter(a =>  FASES_ELIMINATORIAS.includes(a.jogo.fase as JogoFase));
```

### Subcomponente `PlacarDistRow` (inline no mesmo arquivo)

Estado local: `expandido: boolean`.

**Header da linha:**
- Badge de placar (`1 × 0`)
- Barra de progresso (`count/limite`)
- Chevron expand/collapse

**Barra de progresso — cores:**
- `< 75%` → `bg-trovao-surface`
- `75–99%` → `bg-trovao-gold`
- `= limite` → `bg-trovao-red` (ou `bg-red-500`)

**Jogos expandidos — cada linha:**
- `SelecaoAvatar` (já existente) + código das seleções (BRA × ARG)
- Data/hora formatada
- Coluna direita:
  - Se `!prazoEncerrado(aposta.jogo)` → botão "Editar" (texto dourado) → chama `onApostar(aposta.jogo)`
  - Se `prazoEncerrado` e `aposta.pontuacao !== null` → `+N pts` (texto branco)
  - Se `prazoEncerrado` e `aposta.pontuacao === null` → `Aguardando` (texto muted)

---

## Layout visual

```
[ Todos ] [ Pendentes de aposta ] [ Apostados ] [ Encerrados ] [ Meus Placares ]

Fase de Grupos                           limite: 18 apostas idênticas
────────────────────────────────────────────────────────────────────
0 × 0   ████████░░░░░░░░  8/18                                    ˅
  BRA × ARG   sex 13/06 · 15h00                              Editar
  GER × FRA   sáb 14/06 · 12h00                            +10 pts
  ESP × POR   dom 15/06 · 18h00                          Aguardando

1 × 0   ████░░░░░░░░░░░░  4/18                                    ˄
2 × 1   ██░░░░░░░░░░░░░░  2/18                                    ˅

Fases Eliminatórias                       limite: 32 apostas idênticas
─────────────────────────────────────────────────────────────────────
1 × 1   ██████░░  6/8   ← barra dourada (>75%)                   ˅

Nenhum outro palpite nas fases eliminatórias ainda.
```

---

## Componentes reutilizados

| Componente | Uso |
|---|---|
| `SelecaoAvatar` | Ícones das seleções nas linhas expandidas |
| `EmptyState` | Quando não há apostas em uma seção |
| `prazoEncerrado()` | Determina se mostra "Editar" ou pontuação |
| `ApostaDrawer` | Edição da aposta (via `onApostar` → `setJogoSelecionado` no pai) |

---

## Critérios de aceitação

- [ ] Chip "Meus Placares" aparece nos filtros da página de Jogos
- [ ] Ao selecionar, a lista de jogos é substituída pela view de distribuição
- [ ] Fase de Grupos e Fases Eliminatórias aparecem em seções separadas com o limite correto
- [ ] Cada placar único mostra contagem e barra de progresso com a cor correta
- [ ] Expandir um placar lista os jogos com aquele placar
- [ ] Apostas abertas mostram botão "Editar" que abre o ApostaDrawer
- [ ] Apostas encerradas com resultado mostram a pontuação (`+N pts`)
- [ ] Apostas encerradas sem resultado mostram `Aguardando`
- [ ] Após editar uma aposta, a distribuição atualiza sem recarregar a página
- [ ] Seção sem apostas exibe EmptyState adequado
