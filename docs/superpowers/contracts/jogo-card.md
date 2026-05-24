# Contrato — JogoCard

> **Produzido em:** M2 — Apostas
> **Necessário para:** M3 — Ranking (renderizar palpites de outros usuários)

---

## Localização

`apps/frontend/src/components/JogoCard.tsx`

---

## Interface pública

```typescript
interface JogoCardProps {
  jogo: Jogo;
  aposta?: Aposta;
  onApostar?: () => void;
}
```

- `jogo` — objeto completo incluindo `selecaoCasa` e `selecaoVisitante` com `bandeiraSvg`
- `aposta` — aposta do usuário logado para este jogo (opcional)
- `onApostar` — callback chamado ao clicar no botão de apostar/editar

---

## Estados visuais

| Estado | Condição | Borda | CTA |
|---|---|---|---|
| `aberto` | prazo não encerrado + sem aposta | `trovao-border` | botão "Apostar" (gold) |
| `salvo` | prazo não encerrado + com aposta | `trovao-green` | botão "Editar palpite" (verde) |
| `incompleto` | prazo encerrado + sem aposta | `trovao-gold` | texto "Prazo encerrado" |
| `fechado` | prazo encerrado + com aposta | `trovao-border/50` | nenhum |

Prazo = `jogo.dataHora - MINUTOS_PRAZO_APOSTA (60 min)`.

---

## Uso em M3

M3 precisa exibir palpites de outros membros do bolão para um jogo específico. O `JogoCard` não é reutilizado diretamente para isso — M3 vai criar um `PalpiteCard` separado (sem CTA, sempre no estado `fechado`). O contrato do `JogoCard` serve como referência visual para manter consistência de layout (flags, ScoreDisplay, font-mono para placares).

---

## Dependências internas

- `SelecaoAvatar` — exibe bandeira SVG da seleção
- `ScoreDisplay` — exibe placar final ou `— : —`
- `MINUTOS_PRAZO_APOSTA` de `@bolao/shared`
