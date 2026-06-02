# Link do Regulamento em Convite/Perfil + "Voltar" contextual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o regulamento acessível a partir das telas de Convite e Perfil e fazer o "Voltar" do Regulamento retornar para a tela de origem (convite/perfil/login), com fallback `/login`.

**Architecture:** A origem é passada por query param `?from=<rota>`. Cada tela que linka informa a própria rota; o Regulamento lê `from` via `useSearchParams()` (fallback `/login`) e o link "Voltar" aponta para esse valor. Padrão já usado no login (`?redirect=`).

**Tech Stack:** Next.js 14 (App Router, client components), React 18, TypeScript, Jest + Testing Library.

**Notas de execução:**
- Diretório do app: `apps/frontend`.
- Rodar testes de um arquivo (a partir da raiz do repo): `pnpm --filter @bolao/frontend test <substring-do-arquivo>`.
- O `href` das telas é montado como string literal (`/regulamento?from=/perfil`); os testes verificam o atributo `href` exato.

---

### Task 1: Regulamento — "Voltar" lê `from` (fallback `/login`)

**Files:**
- Modify: `apps/frontend/src/app/regulamento/page.tsx`
- Test: `apps/frontend/src/__tests__/RegulamentoPage.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/src/__tests__/RegulamentoPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import RegulamentoPage from '@/app/regulamento/page';

const mockGet = jest.fn();

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: mockGet }),
}));

beforeEach(() => {
  mockGet.mockReturnValue(null);
});

it('Voltar aponta para /login por padrão (sem from)', () => {
  render(<RegulamentoPage />);
  const link = screen.getByRole('link', { name: /voltar/i });
  expect(link).toHaveAttribute('href', '/login');
});

it('Voltar aponta para a origem informada em from', () => {
  mockGet.mockImplementation((key: string) =>
    key === 'from' ? '/convite/ABC123' : null,
  );
  render(<RegulamentoPage />);
  const link = screen.getByRole('link', { name: /voltar/i });
  expect(link).toHaveAttribute('href', '/convite/ABC123');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bolao/frontend test RegulamentoPage`
Expected: FAIL — hoje o link tem texto "Voltar ao login" e `href` fixo `/login`, então o segundo teste falha (e o seletor `name: /voltar/i` ainda casa com "Voltar ao login", mas o href não muda com `from`).

- [ ] **Step 3: Implement — `from` + Suspense + rótulo "Voltar"**

Em `apps/frontend/src/app/regulamento/page.tsx`:

Trocar o bloco de imports do topo:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
```

por:

```tsx
'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
```

Renomear o componente exportado para um conteúdo interno e ler `from`. Trocar:

```tsx
export default function RegulamentoPage() {
  const [copiado, setCopiado] = useState(false);
```

por:

```tsx
function RegulamentoConteudo() {
  const searchParams = useSearchParams();
  const from = searchParams.get('from') ?? '/login';
  const [copiado, setCopiado] = useState(false);
```

Trocar o link de volta no cabeçalho:

```tsx
          <Link href="/login" className="text-sm text-gray-400 hover:text-white">
            Voltar ao login
          </Link>
```

por:

```tsx
          <Link href={from} className="text-sm text-gray-400 hover:text-white">
            Voltar
          </Link>
```

Adicionar, no fim do arquivo (após o fechamento do `RegulamentoConteudo`), o wrapper exportado com Suspense:

```tsx
export default function RegulamentoPage() {
  return (
    <Suspense>
      <RegulamentoConteudo />
    </Suspense>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bolao/frontend test RegulamentoPage`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/app/regulamento/page.tsx apps/frontend/src/__tests__/RegulamentoPage.test.tsx
git commit -m "feat: Voltar do regulamento usa origem (from) com fallback login"
```

---

### Task 2: Convite — link do Regulamento com `from=/convite/<codigo>`

**Files:**
- Modify: `apps/frontend/src/app/convite/[codigo]/page.tsx`
- Test: `apps/frontend/src/__tests__/ConvitePage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Adicionar ao fim de `apps/frontend/src/__tests__/ConvitePage.test.tsx`:

```tsx
it('exibe link do Regulamento com origem do convite (estado pronto)', async () => {
  render(<ConvitePage />);
  const link = await screen.findByRole('link', { name: /regulamento/i });
  expect(link).toHaveAttribute('href', '/regulamento?from=/convite/tok-123');
});

it('exibe link do Regulamento no estado não-autenticado', async () => {
  mockUser = null;
  render(<ConvitePage />);
  const link = await screen.findByRole('link', { name: /regulamento/i });
  expect(link).toHaveAttribute('href', '/regulamento?from=/convite/tok-123');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bolao/frontend test ConvitePage`
Expected: FAIL — nenhum link "Regulamento" existe ainda (`findByRole` estoura timeout / não encontra).

- [ ] **Step 3: Implement — adicionar o import e os links**

Em `apps/frontend/src/app/convite/[codigo]/page.tsx`:

Adicionar o import do `Link` logo após a linha `import { useParams, useRouter } from 'next/navigation';`:

```tsx
import Link from 'next/link';
```

No estado **`nao-autenticado`**, inserir o link logo após o `</a>` do "Registrar com Google" e antes do fechamento `</div>` do card:

```tsx
          <Link
            href={`/regulamento?from=/convite/${codigo}`}
            className="block text-trovao-muted text-xs hover:text-white transition-colors"
          >
            Regulamento
          </Link>
```

No estado **`pronto`** (return final), inserir o mesmo link logo após o botão "Entrar no Bolão" (após o `</button>` que renderiza `Entrar no Bolão`/`Entrando...`) e antes do bloco `{user && (`:

```tsx
        <Link
          href={`/regulamento?from=/convite/${codigo}`}
          className="block text-trovao-muted text-xs hover:text-white transition-colors"
        >
          Regulamento
        </Link>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bolao/frontend test ConvitePage`
Expected: PASS (todos os testes do arquivo, incluindo os 2 novos).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/app/convite/[codigo]/page.tsx apps/frontend/src/__tests__/ConvitePage.test.tsx
git commit -m "feat: link do regulamento na tela de convite"
```

---

### Task 3: Perfil — link do Regulamento com `from=/perfil`

**Files:**
- Modify: `apps/frontend/src/app/(app)/perfil/page.tsx`
- Test: `apps/frontend/src/__tests__/PerfilPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Adicionar ao fim de `apps/frontend/src/__tests__/PerfilPage.test.tsx`:

```tsx
it('exibe link do Regulamento com from=/perfil', () => {
  render(<PerfilPage />);
  const link = screen.getByRole('link', { name: /regulamento/i });
  expect(link).toHaveAttribute('href', '/regulamento?from=/perfil');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bolao/frontend test PerfilPage`
Expected: FAIL — não há link "Regulamento" na tela de perfil.

- [ ] **Step 3: Implement — import + link acima do botão Sair**

Em `apps/frontend/src/app/(app)/perfil/page.tsx`:

Adicionar o import logo após `import { useRouter } from 'next/navigation';`:

```tsx
import Link from 'next/link';
```

Inserir o link logo antes do `<button onClick={handleLogout} ...>` (o botão "Sair"):

```tsx
      <Link
        href="/regulamento?from=/perfil"
        className="block text-sm text-gray-400 hover:text-white"
      >
        Regulamento
      </Link>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bolao/frontend test PerfilPage`
Expected: PASS (todos os testes do arquivo, incluindo o novo).

- [ ] **Step 5: Commit**

```bash
git add "apps/frontend/src/app/(app)/perfil/page.tsx" apps/frontend/src/__tests__/PerfilPage.test.tsx
git commit -m "feat: link do regulamento na tela de perfil"
```

---

### Task 4: Login — link do Regulamento passa `from=/login`

**Files:**
- Modify: `apps/frontend/src/app/(auth)/login/page.tsx`
- Test: `apps/frontend/src/__tests__/LoginPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Adicionar ao fim de `apps/frontend/src/__tests__/LoginPage.test.tsx`:

```tsx
it('link do Regulamento inclui from=/login', () => {
  render(<LoginPage />);
  const link = screen.getByRole('link', { name: /regulamento/i });
  expect(link).toHaveAttribute('href', '/regulamento?from=/login');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bolao/frontend test LoginPage`
Expected: FAIL — o link atual aponta para `/regulamento` (sem `from`).

- [ ] **Step 3: Implement — incluir o `from` no href existente**

Em `apps/frontend/src/app/(auth)/login/page.tsx`, trocar:

```tsx
            <Link href="/regulamento" className="text-xs text-yellow-400 hover:text-yellow-300 self-end">Regulamento</Link>
```

por:

```tsx
            <Link href="/regulamento?from=/login" className="text-xs text-yellow-400 hover:text-yellow-300 self-end">Regulamento</Link>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bolao/frontend test LoginPage`
Expected: PASS (todos os testes do arquivo, incluindo o novo).

- [ ] **Step 5: Commit**

```bash
git add "apps/frontend/src/app/(auth)/login/page.tsx" apps/frontend/src/__tests__/LoginPage.test.tsx
git commit -m "feat: link do regulamento no login passa origem (from=/login)"
```

---

### Task 5: Verificação final

- [ ] **Step 1: Rodar a suíte de testes do frontend**

Run: `pnpm --filter @bolao/frontend test`
Expected: PASS — todos os testes verdes.

- [ ] **Step 2: Typecheck/lint**

Run: `pnpm --filter @bolao/frontend lint`
Expected: sem erros.

- [ ] **Step 3: Conferência visual (dev server)**

Run: `pnpm --filter @bolao/frontend dev`
Conferir manualmente:
- `/convite/<codigo>` (logado e deslogado) mostra "Regulamento"; o link abre `/regulamento?from=/convite/<codigo>` e o "Voltar" retorna ao convite.
- `/perfil` mostra "Regulamento"; "Voltar" retorna ao perfil.
- `/login` → "Regulamento"; "Voltar" retorna ao login.
- Acessar `/regulamento` direto: "Voltar" vai para `/login`.
