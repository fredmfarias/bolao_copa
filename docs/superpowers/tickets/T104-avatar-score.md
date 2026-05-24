# T104 — SelecaoAvatar e ScoreDisplay

> **Módulo:** [M1 — Fundação](../modules/M1-fundacao.md)
> **Tamanho:** `S`
> **Status:** `pendente`
> **Depende de:** T101 concluído (jest configurado)

---

## O que fazer

Criar dois componentes atômicos reutilizados em toda a app: `SelecaoAvatar` (bandeira da seleção via SVG) e `ScoreDisplay` (placar ou traço quando não há placar).

---

## Arquivos

| Ação | Caminho |
|---|---|
| Criar | `apps/frontend/src/components/SelecaoAvatar.tsx` |
| Criar | `apps/frontend/src/components/ScoreDisplay.tsx` |
| Criar | `apps/frontend/src/__tests__/SelecaoAvatar.test.tsx` |
| Criar | `apps/frontend/src/__tests__/ScoreDisplay.test.tsx` |

---

## Passos

- [ ] **Passo 1: Escrever testes (vão falhar)**

```typescript
// apps/frontend/src/__tests__/SelecaoAvatar.test.tsx
import { render, screen } from '@testing-library/react';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';

const svgMock = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="green"/></svg>';

it('renderiza o container com o title do país', () => {
  render(<SelecaoAvatar nome="Brasil" bandeiraSvg={svgMock} />);
  expect(screen.getByTitle('Brasil')).toBeInTheDocument();
});

it('aplica classe de tamanho md por padrão', () => {
  render(<SelecaoAvatar nome="Brasil" bandeiraSvg={svgMock} />);
  expect(screen.getByTitle('Brasil')).toHaveClass('w-10');
});

it('aplica classe de tamanho lg quando size="lg"', () => {
  render(<SelecaoAvatar nome="Brasil" bandeiraSvg={svgMock} size="lg" />);
  expect(screen.getByTitle('Brasil')).toHaveClass('w-16');
});
```

```typescript
// apps/frontend/src/__tests__/ScoreDisplay.test.tsx
import { render, screen } from '@testing-library/react';
import { ScoreDisplay } from '@/components/ScoreDisplay';

it('mostra traço quando não há placar', () => {
  render(<ScoreDisplay placarCasa={null} placarVisitante={null} />);
  expect(screen.getByText('— : —')).toBeInTheDocument();
});

it('mostra o placar quando ambos os valores existem', () => {
  render(<ScoreDisplay placarCasa={2} placarVisitante={1} />);
  expect(screen.getByText('2 : 1')).toBeInTheDocument();
});

it('mostra traço quando apenas um lado tem placar', () => {
  render(<ScoreDisplay placarCasa={0} placarVisitante={null} />);
  expect(screen.getByText('— : —')).toBeInTheDocument();
});
```

- [ ] **Passo 2: Rodar para confirmar falha**

```bash
pnpm test --filter @bolao/frontend -- "SelecaoAvatar|ScoreDisplay"
```

Saída esperada: `FAIL — Cannot find module '@/components/SelecaoAvatar'`

- [ ] **Passo 3: Implementar `SelecaoAvatar`**

```typescript
// apps/frontend/src/components/SelecaoAvatar.tsx
interface SelecaoAvatarProps {
  nome: string;
  bandeiraSvg: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'w-6 h-6',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
} as const;

export function SelecaoAvatar({ nome, bandeiraSvg, size = 'md' }: SelecaoAvatarProps) {
  return (
    <div
      title={nome}
      className={`${SIZES[size]} rounded-full overflow-hidden flex-shrink-0 [&>svg]:w-full [&>svg]:h-full`}
      dangerouslySetInnerHTML={{ __html: bandeiraSvg }}
    />
  );
}
```

- [ ] **Passo 4: Implementar `ScoreDisplay`**

```typescript
// apps/frontend/src/components/ScoreDisplay.tsx
interface ScoreDisplayProps {
  placarCasa: number | null;
  placarVisitante: number | null;
}

export function ScoreDisplay({ placarCasa, placarVisitante }: ScoreDisplayProps) {
  if (placarCasa === null || placarVisitante === null) {
    return (
      <span className="text-trovao-muted text-xl font-mono tracking-widest">
        {'— : —'}
      </span>
    );
  }

  return (
    <span className="text-white text-xl font-mono font-bold tracking-widest">
      {placarCasa} : {placarVisitante}
    </span>
  );
}
```

- [ ] **Passo 5: Rodar testes — devem passar**

```bash
pnpm test --filter @bolao/frontend -- "SelecaoAvatar|ScoreDisplay"
```

Saída esperada: `PASS · 6 tests passed`

- [ ] **Passo 6: Commit**

```bash
git add apps/frontend/src/components/SelecaoAvatar.tsx \
  apps/frontend/src/components/ScoreDisplay.tsx \
  apps/frontend/src/__tests__/SelecaoAvatar.test.tsx \
  apps/frontend/src/__tests__/ScoreDisplay.test.tsx
git commit -m "feat(frontend): SelecaoAvatar e ScoreDisplay"
```

---

## Validação final

```bash
pnpm test --filter @bolao/frontend -- "SelecaoAvatar|ScoreDisplay"
# → PASS · 6 tests passed
```
