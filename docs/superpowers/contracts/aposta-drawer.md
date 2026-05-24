# Contrato — ApostaDrawer

> **Produzido em:** M2 — Apostas
> **Necessário para:** M3 — Ranking (reutiliza padrão de Sheet para exibir palpites de outros)

---

## Localização

`apps/frontend/src/components/ApostaDrawer.tsx`

---

## Interface pública

```typescript
interface ApostaDrawerProps {
  jogo: Jogo;
  aposta?: Aposta;        // pré-preenche os steppers se existir
  bolaoId: string;
  aberto: boolean;        // controla abertura (Sheet controlado)
  onFechar: () => void;   // chamado ao fechar — auto-save se dirty
  onSalvo: () => void;    // chamado após salvar com sucesso
}
```

---

## Comportamento

- **Steppers**: botões `+` e `−` com `aria-label="+"` / `aria-label="−"`, mínimo 0
- **`data-testid`**: `placar-casa` e `placar-visitante` nos spans de valor
- **Auto-save ao fechar**: se `isDirtyRef.current === true` chama `POST /apostas` antes de fechar
- **Confirmar**: salva explicitamente, chama `onSalvo()` + `onFechar()`
- **Endpoint**: `POST /apostas` com `{ jogoId, bolaoId, placarCasa, placarVisitante }`
- **Montagem com `key`**: a página usa `key={jogo.id}` para remontar o drawer ao trocar de jogo, resetando o estado dos steppers

---

## Padrão de uso na página

```tsx
{jogoSelecionado && (
  <ApostaDrawer
    key={jogoSelecionado.id}
    jogo={jogoSelecionado}
    aposta={apostas.get(jogoSelecionado.id)}
    bolaoId={BOLAO_GLOBAL_ID}
    aberto={true}
    onFechar={() => setJogoSelecionado(null)}
    onSalvo={recarregarApostas}
  />
)}
```

---

## Dependências internas

- `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` de `@/components/ui/sheet`
- `SelecaoAvatar` — exibe bandeiras das seleções
- `api.post` de `@/lib/api`
