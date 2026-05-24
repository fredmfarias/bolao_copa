# T103 — PageSkeleton e EmptyState

> **Módulo:** [M1 — Fundação](../modules/M1-fundacao.md)
> **Tamanho:** `S`
> **Status:** `pendente`
> **Depende de:** T101 concluído (jest configurado)

---

## O que fazer

Criar dois componentes base de estado de UI: `PageSkeleton` (loading) e `EmptyState` (lista vazia ou erro suave).

---

## Arquivos

| Ação | Caminho |
|---|---|
| Criar | `apps/frontend/src/components/PageSkeleton.tsx` |
| Criar | `apps/frontend/src/components/EmptyState.tsx` |
| Criar | `apps/frontend/src/__tests__/PageSkeleton.test.tsx` |
| Criar | `apps/frontend/src/__tests__/EmptyState.test.tsx` |

---

## Passos

- [ ] **Passo 1: Escrever testes (vão falhar)**

```typescript
// apps/frontend/src/__tests__/PageSkeleton.test.tsx
import { render, screen } from '@testing-library/react';
import { PageSkeleton } from '@/components/PageSkeleton';

it('renderiza barras de skeleton animadas', () => {
  const { container } = render(<PageSkeleton />);
  expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
});

it('renderiza múltiplas barras de placeholder', () => {
  const { container } = render(<PageSkeleton />);
  const bars = container.querySelectorAll('.bg-trovao-surface');
  expect(bars.length).toBeGreaterThanOrEqual(3);
});
```

```typescript
// apps/frontend/src/__tests__/EmptyState.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '@/components/EmptyState';

it('renderiza o título obrigatório', () => {
  render(<EmptyState titulo="Nenhum jogo encontrado" />);
  expect(screen.getByText('Nenhum jogo encontrado')).toBeInTheDocument();
});

it('renderiza descrição quando fornecida', () => {
  render(<EmptyState titulo="Vazio" descricao="Tente novamente mais tarde" />);
  expect(screen.getByText('Tente novamente mais tarde')).toBeInTheDocument();
});

it('chama onClick ao clicar na ação', async () => {
  const onClick = jest.fn();
  render(<EmptyState titulo="Vazio" acao={{ label: 'Criar bolão', onClick }} />);
  await userEvent.click(screen.getByText('Criar bolão'));
  expect(onClick).toHaveBeenCalledTimes(1);
});

it('não renderiza botão quando acao não é fornecida', () => {
  render(<EmptyState titulo="Vazio" />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
```

- [ ] **Passo 2: Rodar para confirmar falha**

```bash
pnpm test --filter @bolao/frontend -- "PageSkeleton|EmptyState"
```

Saída esperada: `FAIL — Cannot find module '@/components/PageSkeleton'`

- [ ] **Passo 3: Implementar `PageSkeleton`**

```typescript
// apps/frontend/src/components/PageSkeleton.tsx
export function PageSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-7 bg-trovao-surface rounded-lg w-2/5" />
      <div className="h-20 bg-trovao-surface rounded-xl" />
      <div className="h-20 bg-trovao-surface rounded-xl" />
      <div className="h-20 bg-trovao-surface rounded-xl" />
    </div>
  );
}
```

- [ ] **Passo 4: Implementar `EmptyState`**

```typescript
// apps/frontend/src/components/EmptyState.tsx
interface EmptyStateProps {
  titulo: string;
  descricao?: string;
  acao?: { label: string; onClick: () => void };
}

export function EmptyState({ titulo, descricao, acao }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
      <p className="text-trovao-muted font-semibold">{titulo}</p>
      {descricao && (
        <p className="text-trovao-muted/70 text-sm max-w-xs">{descricao}</p>
      )}
      {acao && (
        <button
          onClick={acao.onClick}
          className="mt-2 px-4 py-2 bg-trovao-gold text-trovao-base font-semibold rounded-lg text-sm"
        >
          {acao.label}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Passo 5: Rodar testes — devem passar**

```bash
pnpm test --filter @bolao/frontend -- "PageSkeleton|EmptyState"
```

Saída esperada: `PASS · 6 tests passed`

- [ ] **Passo 6: Commit**

```bash
git add apps/frontend/src/components/PageSkeleton.tsx \
  apps/frontend/src/components/EmptyState.tsx \
  apps/frontend/src/__tests__/PageSkeleton.test.tsx \
  apps/frontend/src/__tests__/EmptyState.test.tsx
git commit -m "feat(frontend): PageSkeleton e EmptyState"
```

---

## Validação final

```bash
pnpm test --filter @bolao/frontend -- "PageSkeleton|EmptyState"
# → PASS · 6 tests passed
```
