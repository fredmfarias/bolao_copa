# T{N}{NN} — {Título do Ticket}

> **Módulo:** [M{N} — {nome}](../modules/M{N}-{slug}.md)
> **Contrato afetado:** [`contracts/{nome}.md`](../contracts/{nome}.md) ← se aplicável
> **Tamanho:** `XS | S | M | L`
> **Status:** `pendente | em progresso | concluído`

---

## O que fazer

Uma frase descrevendo o resultado concreto deste ticket.

---

## Arquivos

| Ação | Caminho | Notas |
|---|---|---|
| Criar | `apps/frontend/src/components/Foo.tsx` | |
| Modificar | `apps/frontend/src/app/(app)/layout.tsx:12-34` | |

---

## Teste

```typescript
// apps/frontend/src/__tests__/Foo.test.tsx
import { render, screen } from '@testing-library/react';
import { Foo } from '@/components/Foo';

it('{descreva o comportamento esperado}', () => {
  render(<Foo prop="valor" />);
  expect(screen.getByText('texto esperado')).toBeInTheDocument();
});
```

Rodar para verificar que falha antes:
```bash
pnpm test --filter frontend -- Foo
```
Saída esperada: `FAIL — cannot find module '@/components/Foo'`

---

## Implementação

```typescript
// apps/frontend/src/components/Foo.tsx
export function Foo({ prop }: { prop: string }) {
  return <div>{prop}</div>;
}
```

---

## Validação

```bash
# Teste passa
pnpm test --filter frontend -- Foo

# Build sem erros de tipo
pnpm build --filter frontend
```

Saída esperada: `PASS · 1 test passed`

---

## Commit

```bash
git add apps/frontend/src/components/Foo.tsx apps/frontend/src/__tests__/Foo.test.tsx
git commit -m "feat(frontend): {descrição em uma linha}"
```
