# Mobile: Responsividade e BottomNav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir scroll lateral e BottomNav sumindo em Android Chrome nas telas /boloes e /ranking.

**Architecture:** Três mudanças em sequência — shell layout primeiro (maior impacto, resolve a causa raiz), depois BolaoCard (defensivo, protege todos os usos), depois boloes/page (form + cores). Cada task tem seus próprios testes quando aplicável.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind CSS 3, Jest 29 + React Testing Library

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `apps/frontend/src/__tests__/AppLayout.test.tsx` | Criar | Testes de rendering do layout shell |
| `apps/frontend/src/app/(app)/layout.tsx` | Modificar | overflow-x-hidden + BottomNav fora dos early returns |
| `apps/frontend/src/__tests__/BolaoCard.test.tsx` | Criar | Testes de overflow e truncate do card |
| `apps/frontend/src/components/BolaoCard.tsx` | Modificar | overflow-hidden no wrapper + truncate no nome |
| `apps/frontend/src/app/(app)/boloes/page.tsx` | Modificar | min-w-0 no input + padronização de cores trovao |

---

### Task 1: AppLayout — overflow-x-hidden e BottomNav sempre renderizado

**Files:**
- Create: `apps/frontend/src/__tests__/AppLayout.test.tsx`
- Modify: `apps/frontend/src/app/(app)/layout.tsx`

- [ ] **Step 1: Criar o arquivo de teste**

Criar `apps/frontend/src/__tests__/AppLayout.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import AppLayout from '@/app/(app)/layout';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/boloes',
}));

jest.mock('@/components/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '@/components/AuthProvider';
const mockUseAuth = useAuth as jest.Mock;

beforeEach(() => {
  mockPush.mockClear();
});

it('renderiza BottomNav durante auth loading', () => {
  mockUseAuth.mockReturnValue({ user: null, loading: true });
  render(<AppLayout><div>conteudo</div></AppLayout>);
  expect(screen.getByText('Jogos')).toBeInTheDocument();
  expect(screen.queryByText('conteudo')).not.toBeInTheDocument();
});

it('renderiza conteúdo e BottomNav quando usuário está autenticado', () => {
  mockUseAuth.mockReturnValue({
    user: { role: 'USER', bolaoFavoritoId: null },
    loading: false,
  });
  render(<AppLayout><div>conteudo</div></AppLayout>);
  expect(screen.getByText('Jogos')).toBeInTheDocument();
  expect(screen.getByText('conteudo')).toBeInTheDocument();
});

it('não renderiza nada quando loading=false e user=null', () => {
  mockUseAuth.mockReturnValue({ user: null, loading: false });
  const { container } = render(<AppLayout><div>conteudo</div></AppLayout>);
  expect(screen.queryByText('Jogos')).not.toBeInTheDocument();
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 2: Rodar e confirmar que o primeiro teste falha**

```bash
cd apps/frontend && npx jest AppLayout.test --no-coverage
```

Esperado: FAIL — "renderiza BottomNav durante auth loading" falha porque o layout atual retorna early sem BottomNav quando `loading=true`.

- [ ] **Step 3: Implementar a mudança no AppLayout**

Substituir o conteúdo completo de `apps/frontend/src/app/(app)/layout.tsx`:

```tsx
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

  if (!loading && !user) return null;

  return (
    <div className="min-h-screen overflow-x-hidden">
      <main className="max-w-lg mx-auto w-full px-4 pt-6 pb-24">
        {loading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <span className="text-trovao-muted text-sm">Carregando...</span>
          </div>
        ) : (
          children
        )}
      </main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que todos os testes passam**

```bash
cd apps/frontend && npx jest AppLayout.test --no-coverage
```

Esperado: PASS — 3 testes passando.

- [ ] **Step 5: Rodar a suite completa para garantir zero regressões**

```bash
cd apps/frontend && npx jest --no-coverage
```

Esperado: todos os testes existentes continuam passando.

- [ ] **Step 6: Commit**

```bash
git add "apps/frontend/src/app/(app)/layout.tsx" apps/frontend/src/__tests__/AppLayout.test.tsx
git commit -m "fix: overflow-x-hidden e BottomNav sempre visível no AppLayout mobile"
```

---

### Task 2: BolaoCard — overflow-hidden no wrapper e truncate no nome

**Files:**
- Create: `apps/frontend/src/__tests__/BolaoCard.test.tsx`
- Modify: `apps/frontend/src/components/BolaoCard.tsx`

- [ ] **Step 1: Criar o arquivo de teste**

Criar `apps/frontend/src/__tests__/BolaoCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { BolaoCard } from '@/components/BolaoCard';

const mockBolao = {
  id: 'bolao-1',
  nome: 'Bolão Copa',
  descricao: 'Descrição do bolão',
  _count: { membros: 5 },
  maxParticipantes: 20,
};

it('wrapper do card tem classe overflow-hidden', () => {
  const { container } = render(<BolaoCard bolao={mockBolao} href="/boloes/1" />);
  expect(container.firstElementChild).toHaveClass('overflow-hidden');
});

it('nome do bolão tem classe truncate', () => {
  render(<BolaoCard bolao={mockBolao} href="/boloes/1" />);
  expect(screen.getByText('Bolão Copa')).toHaveClass('truncate');
});
```

- [ ] **Step 2: Rodar e confirmar que os testes falham**

```bash
cd apps/frontend && npx jest BolaoCard.test --no-coverage
```

Esperado: FAIL — `overflow-hidden` e `truncate` ainda não estão no componente.

- [ ] **Step 3: Adicionar overflow-hidden ao div wrapper do card**

Em `apps/frontend/src/components/BolaoCard.tsx`, linha 43:

```tsx
// ANTES
<div className="relative bg-trovao-card border border-trovao-border rounded-xl hover:border-trovao-gold/50 transition-colors">

// DEPOIS
<div className="relative overflow-hidden bg-trovao-card border border-trovao-border rounded-xl hover:border-trovao-gold/50 transition-colors">
```

- [ ] **Step 4: Adicionar truncate ao parágrafo do nome**

Em `apps/frontend/src/components/BolaoCard.tsx`, linha 45:

```tsx
// ANTES
<p className="font-semibold text-white">{bolao.nome}</p>

// DEPOIS
<p className="font-semibold text-white truncate">{bolao.nome}</p>
```

- [ ] **Step 5: Rodar e confirmar que os testes passam**

```bash
cd apps/frontend && npx jest BolaoCard.test --no-coverage
```

Esperado: PASS — 2 testes passando.

- [ ] **Step 6: Rodar a suite completa**

```bash
cd apps/frontend && npx jest --no-coverage
```

Esperado: todos os testes passando.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/components/BolaoCard.tsx apps/frontend/src/__tests__/BolaoCard.test.tsx
git commit -m "fix: overflow-hidden e truncate no BolaoCard para responsividade mobile"
```

---

### Task 3: boloes/page — min-w-0 no input e padronização de cores trovao

**Files:**
- Modify: `apps/frontend/src/app/(app)/boloes/page.tsx`

Sem novos testes — mudanças são de classes CSS; a corretude é verificada no dev server.

- [ ] **Step 1: Substituir o bloco do formulário de busca**

Em `apps/frontend/src/app/(app)/boloes/page.tsx`, substituir as linhas 57–61:

```tsx
// ANTES
<form onSubmit={handleBusca} className="flex gap-2">
  <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome do bolão"
    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400" />
  <button type="submit"
    className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm">Buscar</button>
</form>

// DEPOIS
<form onSubmit={handleBusca} className="flex gap-2">
  <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome do bolão"
    className="flex-1 min-w-0 bg-trovao-card border border-trovao-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-trovao-gold" />
  <button type="submit"
    className="bg-trovao-surface hover:bg-trovao-border px-4 py-2 rounded-lg text-sm text-white">Buscar</button>
</form>
```

- [ ] **Step 2: Verificar no dev server em modo mobile**

```bash
cd apps/frontend && npm run dev
```

Abrir `http://localhost:3000/boloes` no browser com DevTools em modo mobile (ex: iPhone SE 375px). Confirmar:
- [ ] Sem scroll lateral em nenhuma parte da página
- [ ] BottomNav (Jogos / Bolões / Ranking / Perfil) visível na base sem precisar scrollar
- [ ] Input de busca e botão "Buscar" aparecem lado a lado sem overflow
- [ ] Cores do formulário alinhadas com o tema escuro trovao (sem cinza genérico)
- [ ] Nomes longos de bolões truncados com "..." dentro do card

- [ ] **Step 3: Commit**

```bash
git add "apps/frontend/src/app/(app)/boloes/page.tsx"
git commit -m "fix: min-w-0 no input de busca e cores trovao theme em /boloes"
```
