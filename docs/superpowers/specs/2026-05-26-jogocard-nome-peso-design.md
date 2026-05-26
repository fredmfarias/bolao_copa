# Design — Nome da seleção e destaque de peso no JogoCard

**Data:** 2026-05-26
**Escopo:** `apps/frontend` — apenas `JogoCard.tsx` e seus testes. Sem mudanças de backend, tipos ou outros componentes.

## Contexto

O `JogoCard` (`apps/frontend/src/components/JogoCard.tsx`) hoje:
- Mostra as **siglas** das seleções (`BRA`, `ARG`) sob os avatares; o nome completo só existe no `alt` da bandeira.
- **Não** exibe o `pesoPontuacao` do jogo. O peso é um `Int >= 1` (multiplicador de pontos no ranking); jogos de fase eliminatória tendem a ter peso maior.

Ambos os dados (`selecaoCasa.nome` / `selecaoVisitante.nome` e `pesoPontuacao`) já estão no tipo `Jogo` (`apps/frontend/src/types/api.ts`). O design system usa os tokens `trovao-*` (`gold #FFD600` para destaque primário, `surface`, `muted`, `base`).

## Mudanças

### 1. Título com nomes completos

Adicionar uma linha de título no topo do card, acima do header de metadados:

- Conteúdo: `{selecaoCasa.nome} × {selecaoVisitante.nome}` (ex: "Brasil × Argentina"). Separador `×` (mesmo caractere usado no rodapé "Placar").
- Estilo: centralizado, `text-sm font-semibold text-white`.
- Nomes longos quebram naturalmente em mais de uma linha (sem truncamento).
- As **siglas** sob os avatares permanecem inalteradas.

### 2. Badge de peso (sempre visível)

Adicionar uma pílula de peso no header de metadados, posicionada entre o texto da
fase/rodada (esquerda) e a hora (direita):

```
GRUPOS · Grupo A · R1   ×2   16:00
```

- Rótulo: `×{pesoPontuacao}` (ex: `×1`, `×2`, `×3`) — escala para qualquer inteiro.
- **Peso igual a 1:** pílula discreta — `bg-trovao-surface text-trovao-muted`.
- **Peso maior que 1:** pílula de destaque — `bg-trovao-gold text-trovao-base`.
- Forma: `rounded-full`, padding compacto, `text-[10px] font-bold`.

### Layout final

```
        Brasil × Argentina
 GRUPOS · Grupo A · R1   ×2   16:00      (×2 em dourado)
   🇧🇷       [ 2 : 1 ]       🇦🇷
  BRA        Palpite        ARG
  ──────────────────────────────
  Placar:               1 × 1   +5 pts
         [ Editar palpite ]
```

O restante do card (palpite central, data/hora da aposta, rodapé "Placar", botão,
bordas por estado) permanece como está.

## Arquivos afetados

- `apps/frontend/src/components/JogoCard.tsx` — título com nomes, badge de peso.
- `apps/frontend/src/__tests__/JogoCard.test.tsx` — novos testes.

## Fora de escopo

- Nenhuma mudança de backend, banco, API ou tipos.
- Demais comportamentos do card e da página de jogos inalterados.

## Testes

- Título exibe os nomes completos das duas seleções.
- Siglas continuam presentes.
- Badge de peso exibe `×1` para peso 1 com classe muted (sem destaque dourado).
- Badge de peso exibe `×2` (ou maior) com classe de destaque `trovao-gold`.
