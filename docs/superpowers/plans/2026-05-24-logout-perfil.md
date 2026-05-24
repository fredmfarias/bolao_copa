# Logout via Perfil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um botão "Sair" na página de perfil que desloga o usuário e redireciona para `/login`.

**Architecture:** Única modificação em `perfil/page.tsx` — desestruturar `logout` do `useAuth()` já existente, adicionar `useRouter` para navegação imediata, e renderizar um botão destrutivo ao final da página. A infraestrutura de autenticação (AuthProvider, AppLayout, backend) já está completa.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Tailwind CSS, Jest + Testing Library

---

## File Map

| Ação | Arquivo |
|------|---------|
| Criar | `apps/frontend/src/__tests__/PerfilPage.test.tsx` |
| Modificar | `apps/frontend/src/app/(app)/perfil/page.tsx` |

---

### Task 1: Adicionar botão "Sair" na página de perfil (TDD)

**Files:**
- Create: `apps/frontend/src/__tests__/PerfilPage.test.tsx`
- Modify: `apps/frontend/src/app/(app)/perfil/page.tsx`

---

- [ ] **Step 1: Criar o arquivo de teste com os casos esperados**

Crie o arquivo `apps/frontend/src/__tests__/PerfilPage.test.tsx` com o seguinte conteúdo:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PerfilPage from '@/app/(app)/perfil/page';

const mockPush = jest.fn();
const mockLogout = jest.fn().mockResolvedValue(undefined);

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/components/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  api: { patch: jest.fn().mockResolvedValue({}) },
}));

import { useAuth } from '@/components/AuthProvider';
const mockUseAuth = useAuth as jest.Mock;

beforeEach(() => {
  mockPush.mockClear();
  mockLogout.mockClear();
  mockUseAuth.mockReturnValue({
    user: { nome: 'Test User', email: 'test@test.com', role: 'USER', avatarUrl: null },
    refresh: jest.fn(),
    logout: mockLogout,
  });
});

it('exibe o botão Sair', () => {
  render(<PerfilPage />);
  expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
});

it('chama logout e redireciona para /login ao clicar em Sair', async () => {
  render(<PerfilPage />);
  fireEvent.click(screen.getByRole('button', { name: /sair/i }));
  await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'));
});

it('desabilita o botão e exibe "Saindo..." durante o logout', async () => {
  mockLogout.mockImplementation(
    () => new Promise(resolve => setTimeout(resolve, 100)),
  );
  render(<PerfilPage />);
  fireEvent.click(screen.getByRole('button', { name: /sair/i }));
  expect(screen.getByRole('button', { name: /saindo/i })).toBeDisabled();
});
```

---

- [ ] **Step 2: Rodar os testes para confirmar que falham**

```bash
cd apps/frontend && pnpm test -- --testPathPattern="PerfilPage" --no-coverage
```

Saída esperada: **FAIL** — `Cannot find module '@/app/(app)/perfil/page'` ou os botões não são encontrados, pois o arquivo ainda não tem `logout` nem o botão "Sair".

---

- [ ] **Step 3: Modificar `perfil/page.tsx` para adicionar logout e o botão "Sair"**

Substitua o conteúdo completo de `apps/frontend/src/app/(app)/perfil/page.tsx` por:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

export default function PerfilPage() {
  const { user, refresh, logout } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ nome: user?.nome ?? '', avatarUrl: user?.avatarUrl ?? '' });
  const [sucesso, setSucesso] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    if (user) setForm({ nome: user.nome, avatarUrl: user.avatarUrl ?? '' });
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setLoading(true);
    try {
      await api.patch('/usuarios/me', {
        nome: form.nome || undefined,
        avatarUrl: form.avatarUrl || undefined,
      });
      await refresh();
      setSucesso('Perfil atualizado!');
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLogoutLoading(true);
    await logout();
    router.push('/login');
  }

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-xl font-bold">Meu perfil</h1>

      <div className="flex items-center gap-4">
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.nome} className="w-16 h-16 rounded-full" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl">
            {user?.nome?.[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-semibold">{user?.nome}</p>
          <p className="text-sm text-gray-400">{user?.email}</p>
          <p className="text-xs text-gray-600 mt-0.5">{user?.role}</p>
        </div>
      </div>

      {sucesso && <p className="text-green-400 text-sm">{sucesso}</p>}
      {erro && <p className="text-red-400 text-sm">{erro}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Nome</label>
          <input
            value={form.nome}
            onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Avatar URL (opcional)</label>
          <input
            value={form.avatarUrl}
            onChange={e => setForm(p => ({ ...p, avatarUrl: e.target.value }))}
            placeholder="https://..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-yellow-400 text-gray-900 font-bold px-6 py-2 rounded-lg hover:bg-yellow-300 disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
      </form>

      <button
        onClick={handleLogout}
        disabled={logoutLoading}
        className="border border-red-500 text-red-400 hover:bg-red-500/10 px-6 py-2 rounded-lg font-medium disabled:opacity-50"
      >
        {logoutLoading ? 'Saindo...' : 'Sair'}
      </button>
    </div>
  );
}
```

---

- [ ] **Step 4: Rodar os testes novamente para confirmar que passam**

```bash
cd apps/frontend && pnpm test -- --testPathPattern="PerfilPage" --no-coverage
```

Saída esperada:
```
PASS src/__tests__/PerfilPage.test.tsx
  ✓ exibe o botão Sair
  ✓ chama logout e redireciona para /login ao clicar em Sair
  ✓ desabilita o botão e exibe "Saindo..." durante o logout
```

---

- [ ] **Step 5: Rodar a suite completa para garantir ausência de regressões**

```bash
cd apps/frontend && pnpm test --no-coverage
```

Saída esperada: todos os testes passando, sem falhas.

---

- [ ] **Step 6: Commitar**

```bash
git add apps/frontend/src/app/\(app\)/perfil/page.tsx apps/frontend/src/__tests__/PerfilPage.test.tsx
git commit -m "feat: adicionar botão Sair na página de perfil"
```
