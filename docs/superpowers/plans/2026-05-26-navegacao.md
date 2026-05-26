# Ajustes de Navegação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir três problemas de navegação: botão voltar em palpites, rota `/ranking` com 404, e acesso bidirecional à área admin.

**Architecture:** Quatro mudanças independentes em arquivos separados. Nenhuma compartilha estado — podem ser implementadas em qualquer ordem. `BottomNav` passa a consumir `useAuth` para exibir item Admin condicionalmente.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, lucide-react, Jest + Testing Library

---

## Mapa de Arquivos

| Ação     | Arquivo |
|----------|---------|
| Modificar | `apps/frontend/src/app/(app)/boloes/[id]/palpites/[jogoId]/page.tsx` |
| Criar     | `apps/frontend/src/app/(app)/ranking/page.tsx` |
| Modificar | `apps/frontend/src/components/AdminTopNav.tsx` |
| Modificar | `apps/frontend/src/components/BottomNav.tsx` |
| Modificar | `apps/frontend/src/__tests__/BottomNav.test.tsx` |

---

## Task 1: Botão voltar em PalpitesPage

**Files:**
- Modify: `apps/frontend/src/app/(app)/boloes/[id]/palpites/[jogoId]/page.tsx`

- [ ] **Step 1: Adicionar o Link de volta**

Abrir `apps/frontend/src/app/(app)/boloes/[id]/palpites/[jogoId]/page.tsx`.

Adicionar o import de `Link` no topo (após os imports existentes):

```tsx
import Link from 'next/link';
```

No JSX, localizar o bloco `<div className="space-y-4">` (linha 62) e inserir o link como **primeiro filho**, antes do `{/* Cabeçalho do jogo */}`:

```tsx
return (
  <div className="space-y-4">
    <div>
      <Link href={`/boloes/${bolaoId}`} className="text-trovao-muted text-sm hover:text-white">
        ← Voltar
      </Link>
    </div>

    {/* Cabeçalho do jogo */}
    <div className="text-center">
      ...
```

- [ ] **Step 2: Verificar no browser**

Acessar `http://localhost:3000/boloes/00000000-0000-0000-0000-000000000001/palpites/<qualquer-jogoId>` e confirmar que "← Voltar" aparece no topo e navega de volta para o bolão.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/app/\(app\)/boloes/\[id\]/palpites/\[jogoId\]/page.tsx
git commit -m "feat: adiciona botão voltar na tela de palpites"
```

---

## Task 2: Nova página `/ranking` (índice de bolões)

**Files:**
- Create: `apps/frontend/src/app/(app)/ranking/page.tsx`

- [ ] **Step 1: Criar a página**

Criar o arquivo `apps/frontend/src/app/(app)/ranking/page.tsx` com o seguinte conteúdo:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { BOLAO_GLOBAL_ID } from '@bolao/shared';
import { PageSkeleton } from '@/components/PageSkeleton';
import type { Bolao } from '@/types/api';

export default function RankingIndexPage() {
  const [boloes, setBoloes] = useState<Bolao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Bolao[]>('/boloes/meus')
      .then(setBoloes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  const privados = boloes.filter(b => b.id !== BOLAO_GLOBAL_ID);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Ranking</h1>
      <div className="space-y-2">
        <Link
          href={`/ranking/${BOLAO_GLOBAL_ID}`}
          className="block px-4 py-3 rounded-xl bg-trovao-card border border-trovao-border hover:border-trovao-gold transition-colors"
        >
          <span className="text-white font-medium">Global</span>
        </Link>
        {privados.map(b => (
          <Link
            key={b.id}
            href={`/ranking/${b.id}`}
            className="block px-4 py-3 rounded-xl bg-trovao-card border border-trovao-border hover:border-trovao-gold transition-colors"
          >
            <span className="text-white font-medium">{b.nome}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar no browser**

Acessar `http://localhost:3000/ranking`. Confirmar que:
- A página carrega (não dá 404)
- O item "Global" aparece como link
- Os bolões privados do usuário aparecem abaixo
- Clicar em qualquer item navega para `/ranking/[bolaoId]`
- O item "Ranking" no menu inferior fica destacado em dourado

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/app/\(app\)/ranking/page.tsx
git commit -m "feat: cria página índice /ranking com listagem de bolões"
```

---

## Task 3: AdminTopNav — link para sair da área admin

**Files:**
- Modify: `apps/frontend/src/components/AdminTopNav.tsx`

- [ ] **Step 1: Adicionar o link `← App`**

Substituir o conteúdo de `apps/frontend/src/components/AdminTopNav.tsx` por:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/admin/boloes',   label: 'Bolões' },
  { href: '/admin/placares', label: 'Placares' },
  { href: '/admin/ranking',  label: 'Ranking' },
  { href: '/admin/usuarios', label: 'Usuários' },
] as const;

export function AdminTopNav() {
  const pathname = usePathname();
  return (
    <nav className="bg-trovao-card border-b border-trovao-border px-4">
      <div className="max-w-2xl mx-auto flex items-center gap-1 h-12">
        <Link href="/jogos" className="text-trovao-muted text-xs hover:text-white mr-2">
          ← App
        </Link>
        <span className="text-trovao-gold font-bold text-sm mr-4">Admin</span>
        {NAV.map(({ href, label }) => (
          <Link key={href} href={href}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              pathname.startsWith(href)
                ? 'bg-trovao-gold text-trovao-base'
                : 'text-trovao-muted hover:text-white'
            }`}>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Verificar no browser**

Acessar `http://localhost:3000/admin/boloes`. Confirmar que "← App" aparece à esquerda do label "Admin" e que clicar nele navega para `/jogos`.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/AdminTopNav.tsx
git commit -m "feat: adiciona link ← App no AdminTopNav para sair da área admin"
```

---

## Task 4: BottomNav — item Admin para usuários ADMIN

**Files:**
- Modify: `apps/frontend/src/components/BottomNav.tsx`
- Modify: `apps/frontend/src/__tests__/BottomNav.test.tsx`

- [ ] **Step 1: Escrever os testes atualizados primeiro**

Substituir o conteúdo de `apps/frontend/src/__tests__/BottomNav.test.tsx` por:

```tsx
import { render, screen } from '@testing-library/react';
import { BottomNav } from '@/components/BottomNav';

jest.mock('next/navigation', () => ({
  usePathname: () => '/jogos',
}));

jest.mock('@/components/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '@/components/AuthProvider';
const mockUseAuth = useAuth as jest.Mock;

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { role: 'USER' } });
});

it('renderiza os 4 itens de navegação para usuário comum', () => {
  render(<BottomNav />);
  expect(screen.getByText('Jogos')).toBeInTheDocument();
  expect(screen.getByText('Bolões')).toBeInTheDocument();
  expect(screen.getByText('Ranking')).toBeInTheDocument();
  expect(screen.getByText('Perfil')).toBeInTheDocument();
  expect(screen.queryByText('Admin')).not.toBeInTheDocument();
});

it('marca o item ativo quando pathname bate', () => {
  render(<BottomNav />);
  const jogosLink = screen.getByText('Jogos').closest('a');
  expect(jogosLink).toHaveClass('text-trovao-gold');
});

it('exibe item Admin somente para usuários ADMIN', () => {
  mockUseAuth.mockReturnValue({ user: { role: 'ADMIN' } });
  render(<BottomNav />);
  expect(screen.getByText('Admin')).toBeInTheDocument();
  const adminLink = screen.getByText('Admin').closest('a');
  expect(adminLink).toHaveAttribute('href', '/admin/boloes');
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

```bash
cd apps/frontend && pnpm test BottomNav
```

Esperado: falha com `Cannot find module '@/components/AuthProvider'` ou similar, porque o `BottomNav` ainda não usa `useAuth`.

- [ ] **Step 3: Implementar o BottomNav atualizado**

Substituir o conteúdo de `apps/frontend/src/components/BottomNav.tsx` por:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Trophy, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

const NAV_ITEMS = [
  { href: '/jogos',   icon: Home,   label: 'Jogos'   },
  { href: '/boloes',  icon: Users,  label: 'Bolões'  },
  { href: '/ranking', icon: Trophy, label: 'Ranking' },
  { href: '/perfil',  icon: User,   label: 'Perfil'  },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

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
        {user?.role === 'ADMIN' && (
          <Link
            href="/admin/boloes"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
              pathname.startsWith('/admin') ? 'text-trovao-gold' : 'text-trovao-muted hover:text-white'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[10px] font-medium">Admin</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
cd apps/frontend && pnpm test BottomNav
```

Esperado: 3 testes passando.

- [ ] **Step 5: Verificar no browser**

Logar como admin e confirmar que o 5º item "Admin" aparece no menu inferior. Logar como usuário comum e confirmar que o item não aparece.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/components/BottomNav.tsx apps/frontend/src/__tests__/BottomNav.test.tsx
git commit -m "feat: exibe item Admin no BottomNav para usuários ADMIN"
```
