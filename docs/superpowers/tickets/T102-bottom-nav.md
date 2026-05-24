# T102 — BottomNav + atualizar AppLayout

> **Módulo:** [M1 — Fundação](../modules/M1-fundacao.md)
> **Tamanho:** `S`
> **Status:** `concluído`
> **Depende de:** T101 concluído (jest configurado)

---

## O que fazer

Criar `BottomNav` mobile-first fixo no rodapé e atualizar o `AppLayout` para usá-lo em vez do `NavBar` atual.

---

## Arquivos

| Ação | Caminho |
|---|---|
| Criar | `apps/frontend/src/components/BottomNav.tsx` |
| Criar | `apps/frontend/src/__tests__/BottomNav.test.tsx` |
| Modificar | `apps/frontend/src/app/(app)/layout.tsx` |
| Deletar | `apps/frontend/src/components/NavBar.tsx` |

---

## Passos

- [x] **Passo 1: Instalar lucide-react**

```bash
pnpm add lucide-react --filter @bolao/frontend
```

- [x] **Passo 2: Escrever o teste (vai falhar)**

```typescript
// apps/frontend/src/__tests__/BottomNav.test.tsx
import { render, screen } from '@testing-library/react';
import { BottomNav } from '@/components/BottomNav';

jest.mock('next/navigation', () => ({
  usePathname: () => '/jogos',
}));

it('renderiza os 4 itens de navegação', () => {
  render(<BottomNav />);
  expect(screen.getByText('Jogos')).toBeInTheDocument();
  expect(screen.getByText('Bolões')).toBeInTheDocument();
  expect(screen.getByText('Ranking')).toBeInTheDocument();
  expect(screen.getByText('Perfil')).toBeInTheDocument();
});

it('marca o item ativo quando pathname bate', () => {
  render(<BottomNav />);
  const jogosLink = screen.getByText('Jogos').closest('a');
  expect(jogosLink).toHaveClass('text-trovao-gold');
});
```

- [x] **Passo 3: Rodar para confirmar falha**

```bash
pnpm test --filter @bolao/frontend -- BottomNav
```

Saída esperada: `FAIL — Cannot find module '@/components/BottomNav'`

- [x] **Passo 4: Implementar `BottomNav`**

```typescript
// apps/frontend/src/components/BottomNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Trophy, User } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/jogos',  icon: Home,   label: 'Jogos'   },
  { href: '/boloes', icon: Users,  label: 'Bolões'  },
  { href: '/ranking', icon: Trophy, label: 'Ranking' },
  { href: '/perfil', icon: User,   label: 'Perfil'  },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-trovao-card border-t border-trovao-border z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                active ? 'text-trovao-gold' : 'text-trovao-muted hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [x] **Passo 5: Rodar testes — devem passar**

```bash
pnpm test --filter @bolao/frontend -- BottomNav
```

Saída esperada: `PASS · 2 tests passed`

- [x] **Passo 6: Atualizar `AppLayout`**

```typescript
// apps/frontend/src/app/(app)/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { BottomNav } from '@/components/BottomNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-trovao-muted text-sm">Carregando...</span>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <main className="max-w-lg mx-auto w-full px-4 pt-6 pb-24">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
```

- [x] **Passo 7: Deletar `NavBar.tsx`**

```bash
rm apps/frontend/src/components/NavBar.tsx
```

- [x] **Passo 8: Validar build**

```bash
pnpm build --filter @bolao/frontend
```

Saída esperada: sem erros de tipo ou referências ao `NavBar`.

- [x] **Passo 9: Commit**

```bash
git add apps/frontend/src/components/BottomNav.tsx \
  apps/frontend/src/__tests__/BottomNav.test.tsx \
  apps/frontend/src/app/(app)/layout.tsx \
  pnpm-lock.yaml
git rm apps/frontend/src/components/NavBar.tsx
git commit -m "feat(frontend): BottomNav mobile-first + atualiza AppLayout"
```

---

## Validação final

```bash
pnpm test --filter @bolao/frontend -- BottomNav   # → PASS · 2 tests
pnpm build --filter @bolao/frontend               # → sem erros
```
