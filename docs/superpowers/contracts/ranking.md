# Contrato — Ranking

> **Produzido em:** M3 — Ranking
> **Necessário para:** M4 — Admin (publicar ranking calculado)

---

## Localização

| Componente | Arquivo |
|---|---|
| `RankingPodium` | `apps/frontend/src/components/RankingPodium.tsx` |
| `RankingRow` | `apps/frontend/src/components/RankingRow.tsx` |
| `ApostasDialog` | `apps/frontend/src/components/ApostasDialog.tsx` |
| Página ranking | `apps/frontend/src/app/(app)/ranking/[bolaoId]/page.tsx` |
| Página palpites | `apps/frontend/src/app/(app)/palpites/[jogoId]/page.tsx` |

---

## Interfaces públicas

```typescript
interface RankingPodiumProps {
  ranking: RankingEntry[];
  myId?: string;
}

interface RankingRowProps {
  entry: RankingEntry;
  myId?: string;
}

interface ApostasDialogProps {
  jogo: Jogo;
  bolaoId: string;
  aberto: boolean;
  onFechar: () => void;
}
```

---

## Endpoints consumidos

| Método | Rota | Usa |
|---|---|---|
| `GET` | `/ranking/${bolaoId}` | página ranking (lista completa) |
| `GET` | `/boloes/${bolaoId}/apostas?jogoId=` | ApostasDialog (palpites de membros) |
| `GET` | `/jogos/${jogoId}` | página palpites |

---

## Comportamento RankingPodium

- Renderiza os 3 primeiros em ordem visual: 2º, 1º, 3º (constante `ORDER = [1, 0, 2]`)
- `data-my` attribute no container do usuário logado (para testes)
- Se `ranking` vazio → retorna `null`

## Comportamento RankingRow

- Toggle expand/collapse com `useState`
- Expandido mostra: placar exato, vencedor, empate, apostas feitas
- Usuário logado: borda gold + texto gold

## EmptyState de ranking

Quando `ranking.length === 0`: exibe `EmptyState` com mensagem `"Aguardando publicação"`.

---

## Dependências internas

- `RankingEntry` de `@/types/api`
- `EmptyState` de `@/components/EmptyState`
- `ApostasDialog` usa `dialog.tsx` (shadcn/Base UI)
