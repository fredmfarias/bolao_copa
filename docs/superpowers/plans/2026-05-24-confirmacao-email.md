# Confirmação de E-mail — Correção de Rota e UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o 404 no link de confirmação de e-mail e redirecionar o usuário automaticamente para o login com mensagem de sucesso após confirmar o e-mail.

**Architecture:** Três alterações pontuais: (1) corrigir a URL gerada no backend de `/auth/confirmar-email` para `/confirmar-email`; (2) substituir a mensagem inline da página de confirmação por `router.push` para o login; (3) exibir um banner verde no login quando vier o query param `emailConfirmado=true`.

**Tech Stack:** NestJS (backend), Next.js 14 App Router (frontend), Jest + Testing Library (testes).

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `apps/backend/src/auth/auth.service.ts` | Modificar linha 119 — trocar `/auth/confirmar-email` por `/confirmar-email` |
| `apps/backend/src/auth/auth.service.spec.ts` | Modificar — expor `mailerMock` em nível de módulo, adicionar teste da URL |
| `apps/frontend/src/app/(auth)/confirmar-email/page.tsx` | Modificar — trocar mensagem inline por redirecionamento |
| `apps/frontend/src/__tests__/ConfirmarEmailPage.test.tsx` | Criar — testes da página de confirmação |
| `apps/frontend/src/app/(auth)/login/page.tsx` | Modificar — exibir banner de sucesso quando `emailConfirmado=true` |
| `apps/frontend/src/__tests__/LoginPage.test.tsx` | Criar — testes do banner de sucesso |

---

## Task 1: Corrigir URL no backend e cobrir com teste

**Files:**
- Modify: `apps/backend/src/auth/auth.service.ts:119`
- Modify: `apps/backend/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Escrever o teste que vai falhar**

Em `apps/backend/src/auth/auth.service.spec.ts`, fazer duas mudanças:

**1a.** Extrair o mailerMock para nível de módulo (antes do `describe`), substituindo a criação inline:

```typescript
// Antes (dentro do beforeEach):
{ provide: 'MAILER', useValue: { sendMail: jest.fn() } },

// Depois: declarar no topo do arquivo (junto com prismaMock):
const mailerMock = { sendMail: jest.fn() };
// E no provider:
{ provide: 'MAILER', useValue: mailerMock },
```

**1b.** Adicionar o novo teste no final do `describe`:

```typescript
it('envia e-mail de confirmação com URL sem prefixo /auth/', async () => {
  prismaMock.usuario.findUnique.mockResolvedValue(null);
  prismaMock.usuario.create.mockResolvedValue({ id: 'new-id', email: 'b@b.com', nome: 'Test' });
  await service.registrar({ nome: 'Test', email: 'b@b.com', senha: '12345678' });
  const html: string = mailerMock.sendMail.mock.calls[0][0].html;
  expect(html).toContain('/confirmar-email?token=');
  expect(html).not.toContain('/auth/confirmar-email');
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
cd apps/backend && npx jest --testPathPattern=auth.service.spec --no-coverage
```

Esperado: FAIL — `expect(html).not.toContain('/auth/confirmar-email')` falha porque a URL ainda tem o prefixo `/auth/`.

- [ ] **Step 3: Corrigir a URL no auth.service.ts**

Em `apps/backend/src/auth/auth.service.ts`, linha 119, trocar:

```typescript
// Antes:
const url = `${this.config.get('APP_URL')}/auth/confirmar-email?token=${token}`;

// Depois:
const url = `${this.config.get('APP_URL')}/confirmar-email?token=${token}`;
```

- [ ] **Step 4: Rodar todos os testes do backend para confirmar que passam**

```bash
cd apps/backend && npx jest --no-coverage
```

Esperado: todos os testes PASS (incluindo os existentes).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/auth/auth.service.ts apps/backend/src/auth/auth.service.spec.ts
git commit -m "fix: corrigir URL de confirmação de e-mail de /auth/confirmar-email para /confirmar-email"
```

---

## Task 2: Atualizar página de confirmação — redirecionar ao invés de exibir mensagem

**Files:**
- Create: `apps/frontend/src/__tests__/ConfirmarEmailPage.test.tsx`
- Modify: `apps/frontend/src/app/(auth)/confirmar-email/page.tsx`

- [ ] **Step 1: Criar o arquivo de teste**

Criar `apps/frontend/src/__tests__/ConfirmarEmailPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import ConfirmarEmailPage from '@/app/(auth)/confirmar-email/page';

const mockPush = jest.fn();
const mockGetParam = jest.fn().mockReturnValue('valid-token');

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: mockGetParam }),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));

import { api } from '@/lib/api';

beforeEach(() => {
  mockPush.mockClear();
  mockGetParam.mockReturnValue('valid-token');
  (api.get as jest.Mock).mockClear();
});

it('redireciona para /login?emailConfirmado=true após confirmação com sucesso', async () => {
  (api.get as jest.Mock).mockResolvedValue({ message: 'E-mail confirmado.' });
  render(<ConfirmarEmailPage />);
  await waitFor(() =>
    expect(mockPush).toHaveBeenCalledWith('/login?emailConfirmado=true'),
  );
});

it('exibe mensagem de erro e não redireciona se token for inválido', async () => {
  (api.get as jest.Mock).mockRejectedValue(new Error('Token inválido ou expirado.'));
  render(<ConfirmarEmailPage />);
  await waitFor(() =>
    expect(screen.getByText('Token inválido ou expirado.')).toBeInTheDocument(),
  );
  expect(mockPush).not.toHaveBeenCalled();
});

it('exibe "Token não encontrado." e não redireciona se token estiver ausente', async () => {
  mockGetParam.mockReturnValue(null);
  render(<ConfirmarEmailPage />);
  await waitFor(() =>
    expect(screen.getByText('Token não encontrado.')).toBeInTheDocument(),
  );
  expect(mockPush).not.toHaveBeenCalled();
  expect(api.get).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

```bash
cd apps/frontend && npx jest --testPathPattern=ConfirmarEmailPage --no-coverage
```

Esperado: FAIL — o componente atual não usa `router.push`.

- [ ] **Step 3: Reescrever a página de confirmação**

Substituir todo o conteúdo de `apps/frontend/src/app/(auth)/confirmar-email/page.tsx`:

```tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

function ConfirmarEmailContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [msg, setMsg] = useState('Confirmando...');

  useEffect(() => {
    if (!token) { setMsg('Token não encontrado.'); return; }
    api.get<{ message: string }>(`/auth/confirmar-email?token=${token}`)
      .then(() => router.push('/login?emailConfirmado=true'))
      .catch(e => setMsg(e.message));
  }, [token, router]);

  return (
    <div className="bg-gray-900 rounded-xl p-8 text-center max-w-sm space-y-4">
      <p className="text-gray-300">{msg}</p>
    </div>
  );
}

export default function ConfirmarEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Suspense fallback={<div className="text-gray-400">Carregando...</div>}>
        <ConfirmarEmailContent />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
cd apps/frontend && npx jest --testPathPattern=ConfirmarEmailPage --no-coverage
```

Esperado: 3 testes PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/app/\(auth\)/confirmar-email/page.tsx apps/frontend/src/__tests__/ConfirmarEmailPage.test.tsx
git commit -m "feat: redirecionar para login após confirmação de e-mail com sucesso"
```

---

## Task 3: Exibir banner de sucesso na página de login

**Files:**
- Create: `apps/frontend/src/__tests__/LoginPage.test.tsx`
- Modify: `apps/frontend/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Criar o arquivo de teste**

Criar `apps/frontend/src/__tests__/LoginPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import LoginPage from '@/app/(auth)/login/page';

const mockPush = jest.fn();
const mockGetParam = jest.fn();

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: mockGetParam }),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ login: jest.fn() }),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockGetParam.mockImplementation((key: string) => {
    if (key === 'redirect') return null;
    if (key === 'emailConfirmado') return null;
    return null;
  });
});

it('não exibe banner verde quando emailConfirmado está ausente', () => {
  render(<LoginPage />);
  expect(
    screen.queryByText(/e-mail verificado com sucesso/i),
  ).not.toBeInTheDocument();
});

it('exibe banner verde quando emailConfirmado=true está na URL', () => {
  mockGetParam.mockImplementation((key: string) => {
    if (key === 'emailConfirmado') return 'true';
    return null;
  });
  render(<LoginPage />);
  expect(
    screen.getByText('E-mail verificado com sucesso! Faça login para continuar.'),
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar os testes para confirmar que o segundo falha**

```bash
cd apps/frontend && npx jest --testPathPattern=LoginPage --no-coverage
```

Esperado: primeiro teste PASS, segundo teste FAIL — o banner ainda não existe.

- [ ] **Step 3: Adicionar leitura do searchParam e banner ao LoginForm**

Em `apps/frontend/src/app/(auth)/login/page.tsx`, aplicar estas mudanças dentro do componente `LoginForm`:

**3a.** Adicionar leitura do param logo após a linha `const redirect = ...` (linha 12):

```typescript
const emailConfirmado = searchParams.get('emailConfirmado');
```

**3b.** Adicionar o banner logo após o `{erro && ...}` (antes das linhas de input), dentro do `<form>`:

```tsx
{emailConfirmado && (
  <p className="text-green-400 text-sm text-center">
    E-mail verificado com sucesso! Faça login para continuar.
  </p>
)}
```

O bloco `<form>` ficará assim:

```tsx
<form onSubmit={handleSubmit} className="space-y-4">
  {erro && <p className="text-red-400 text-sm text-center">{erro}</p>}
  {emailConfirmado && (
    <p className="text-green-400 text-sm text-center">
      E-mail verificado com sucesso! Faça login para continuar.
    </p>
  )}
  <div>
    <label className="block text-sm text-gray-400 mb-1">E-mail</label>
    ...
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
cd apps/frontend && npx jest --testPathPattern=LoginPage --no-coverage
```

Esperado: 2 testes PASS.

- [ ] **Step 5: Rodar toda a suite do frontend para confirmar sem regressões**

```bash
cd apps/frontend && npx jest --no-coverage
```

Esperado: todos os testes PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/app/\(auth\)/login/page.tsx apps/frontend/src/__tests__/LoginPage.test.tsx
git commit -m "feat: exibir banner de sucesso no login após confirmação de e-mail"
```
