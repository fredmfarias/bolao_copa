# Bloquear Usuários Inativos (Login Google, Membros, Contagem) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedir que usuários inativos (`Usuario.ativo = false`) entrem via Google OAuth, apareçam em listas de membros de bolões ou sejam contados nas contagens de membros.

**Architecture:** Filtragem no nível da query Prisma (`where: { usuario: { ativo: true } }`), seguindo o padrão já usado em `ranking.service.ts`. O login Google ganha uma checagem de `ativo` no callback, espelhando o que o login por senha já faz. O ranking já exclui inativos e não muda.

**Tech Stack:** NestJS 10, Prisma 5 (filtered relation count é GA — sem preview flag), Jest (ts-jest backend), Next.js 14 + Testing Library (frontend).

**Spec:** `docs/superpowers/specs/2026-06-10-bloquear-inativos-login-membros-design.md`

**Comandos de teste:**
- Backend (arquivo específico): `pnpm --filter @bolao/backend test -- <padrão>`
- Frontend (arquivo específico): `pnpm --filter @bolao/frontend test -- <padrão>`

---

## Task 1: `obter()` só inclui membros ativos

**Files:**
- Modify: `apps/backend/src/bolao/bolao.service.ts:53-62`
- Test: `apps/backend/src/bolao/bolao.service.spec.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final do `describe('BolaoService', ...)` em `apps/backend/src/bolao/bolao.service.spec.ts` (antes do `});` final):

```ts
  it('obter filtra membros por ativo: true', async () => {
    prismaMock.bolao.findUnique.mockResolvedValue({ id: 'b1', membros: [] });
    await service.obter('b1');
    expect(prismaMock.bolao.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b1' },
        include: expect.objectContaining({
          membros: expect.objectContaining({ where: { usuario: { ativo: true } } }),
        }),
      }),
    );
  });
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `pnpm --filter @bolao/backend test -- bolao.service`
Expected: FAIL — o `membros` atual não tem `where`, então o `objectContaining` da relação não bate.

- [ ] **Step 3: Implementar a mudança mínima**

Em `apps/backend/src/bolao/bolao.service.ts`, substituir o corpo de `obter()` (linhas 53-62):

```ts
  async obter(bolaoId: string) {
    const bolao = await this.prisma.bolao.findUnique({
      where: { id: bolaoId },
      include: {
        membros: {
          where: { usuario: { ativo: true } },
          include: { usuario: { select: { id: true, nome: true, avatarUrl: true } } },
        },
      },
    });
    if (!bolao) throw new NotFoundException('Bolão não encontrado.');
    return bolao;
  }
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `pnpm --filter @bolao/backend test -- bolao.service`
Expected: PASS (todos os testes de `BolaoService`).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/bolao/bolao.service.ts apps/backend/src/bolao/bolao.service.spec.ts
git commit -m "feat: obter() do bolão lista apenas membros ativos"
```

---

## Task 2: Contagem de membros (`listarMeus` e `buscarPorNome`) exclui inativos

**Files:**
- Modify: `apps/backend/src/bolao/bolao.service.ts:38-44` (`listarMeus`), `:46-51` (`buscarPorNome`)
- Test: `apps/backend/src/bolao/bolao.service.spec.ts`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao `describe('BolaoService', ...)` em `apps/backend/src/bolao/bolao.service.spec.ts`:

```ts
  it('listarMeus conta apenas membros ativos', async () => {
    prismaMock.bolao.findMany.mockResolvedValue([]);
    await service.listarMeus('u1');
    expect(prismaMock.bolao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { _count: { select: { membros: { where: { usuario: { ativo: true } } } } } },
      }),
    );
  });

  it('buscarPorNome conta apenas membros ativos', async () => {
    prismaMock.bolao.findMany.mockResolvedValue([]);
    await service.buscarPorNome('copa');
    expect(prismaMock.bolao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          _count: { select: { membros: { where: { usuario: { ativo: true } } } } },
        }),
      }),
    );
  });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @bolao/backend test -- bolao.service`
Expected: FAIL — o `_count` atual é `{ select: { membros: true } }`, sem `where`.

- [ ] **Step 3: Implementar a mudança mínima**

Em `apps/backend/src/bolao/bolao.service.ts`, substituir `listarMeus` (linhas 38-44):

```ts
  async listarMeus(usuarioId: string) {
    return this.prisma.bolao.findMany({
      where: { membros: { some: { usuarioId } } },
      include: { _count: { select: { membros: { where: { usuario: { ativo: true } } } } } },
      orderBy: { criadoEm: 'asc' },
    });
  }
```

E substituir `buscarPorNome` (linhas 46-51):

```ts
  async buscarPorNome(nome: string) {
    return this.prisma.bolao.findMany({
      where: { nome: { contains: nome, mode: 'insensitive' }, status: BolaoStatus.ATIVO },
      select: {
        id: true, nome: true, descricao: true,
        _count: { select: { membros: { where: { usuario: { ativo: true } } } } },
      },
    });
  }
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @bolao/backend test -- bolao.service`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/bolao/bolao.service.ts apps/backend/src/bolao/bolao.service.spec.ts
git commit -m "feat: contagem de membros do bolão exclui inativos (listarMeus, buscarPorNome)"
```

---

## Task 3: Contagem na listagem admin (`listarBoloes`) exclui inativos

**Files:**
- Modify: `apps/backend/src/admin/admin.service.ts:29-38`
- Test: `apps/backend/src/admin/admin.service.spec.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao `describe('AdminService', ...)` em `apps/backend/src/admin/admin.service.spec.ts`:

```ts
  it('listarBoloes conta apenas membros ativos', async () => {
    prismaMock.bolao.findMany.mockResolvedValue([]);
    await service.listarBoloes();
    expect(prismaMock.bolao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          _count: { select: { membros: { where: { usuario: { ativo: true } } } } },
        }),
      }),
    );
  });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @bolao/backend test -- admin.service`
Expected: FAIL — `_count` atual é `{ select: { membros: true } }`.

- [ ] **Step 3: Implementar a mudança mínima**

Em `apps/backend/src/admin/admin.service.ts`, substituir o corpo de `listarBoloes()` (linhas 29-38):

```ts
  async listarBoloes() {
    return this.prisma.bolao.findMany({
      select: {
        id: true, nome: true, descricao: true, status: true,
        precoReais: true, maxParticipantes: true,
        _count: { select: { membros: { where: { usuario: { ativo: true } } } } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @bolao/backend test -- admin.service`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/admin/admin.service.ts apps/backend/src/admin/admin.service.spec.ts
git commit -m "feat: listagem admin de bolões conta apenas membros ativos"
```

---

## Task 4: Login Google bloqueia usuários inativos

**Files:**
- Create: `apps/backend/src/auth/auth.controller.spec.ts`
- Modify: `apps/backend/src/auth/auth.controller.ts:84-124` (`googleCallback`)

Contexto: o callback resolve `usuario` (existente ou recém-criado). Usuários criados no próprio callback nascem com `ativo: true` (default do schema), então a checagem só atinge contas existentes e inativas. A checagem entra **depois** do bloco de criação/vínculo e **antes** de `gerarTokens`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/backend/src/auth/auth.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { InscricaoWindowService } from '../inscricao-window/inscricao-window.service';

const authMock = { gerarTokens: jest.fn() };
const prismaMock = {
  usuario: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  bolaoMembro: { create: jest.fn() },
  ranking: { create: jest.fn() },
};
const inscricaoMock = { getStatus: jest.fn() };

function mockRes() {
  return { cookie: jest.fn(), redirect: jest.fn() } as any;
}

describe('AuthController.googleCallback', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: InscricaoWindowService, useValue: inscricaoMock },
      ],
    }).compile();
    controller = module.get(AuthController);
    jest.clearAllMocks();
    process.env.APP_URL = 'http://app.test';
    authMock.gerarTokens.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
  });

  it('redireciona usuário inativo para /login?erro=conta-desativada e não gera tokens', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({
      id: 'u1', email: 'x@y.com', googleId: 'g1', ativo: false, role: 'USER',
    });
    const req = { user: { googleId: 'g1', nome: 'X', email: 'x@y.com', avatarUrl: null } } as any;
    const res = mockRes();

    await controller.googleCallback(req, res);

    expect(res.redirect).toHaveBeenCalledWith('http://app.test/login?erro=conta-desativada');
    expect(authMock.gerarTokens).not.toHaveBeenCalled();
  });

  it('gera tokens para usuário ativo existente', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({
      id: 'u1', email: 'x@y.com', googleId: 'g1', ativo: true, role: 'USER',
    });
    const req = { user: { googleId: 'g1', nome: 'X', email: 'x@y.com', avatarUrl: null } } as any;
    const res = mockRes();

    await controller.googleCallback(req, res);

    expect(authMock.gerarTokens).toHaveBeenCalledWith('u1', 'x@y.com', 'USER');
    expect(res.redirect).toHaveBeenCalledWith('http://app.test/auth/callback?token=a');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @bolao/backend test -- auth.controller`
Expected: FAIL no primeiro teste — sem a checagem, o inativo recebe tokens e é redirecionado para `/auth/callback?token=...` em vez de `/login?erro=conta-desativada`.

- [ ] **Step 3: Implementar a mudança mínima**

Em `apps/backend/src/auth/auth.controller.ts`, dentro de `googleCallback`, inserir a checagem entre o fim do bloco `if (!usuario) { ... } else if (...) { ... }` e a linha `const tokens = await this.auth.gerarTokens(...)`:

```ts
    if (!usuario.ativo) {
      return res.redirect(`${process.env.APP_URL}/login?erro=conta-desativada`);
    }

    const tokens = await this.auth.gerarTokens(usuario.id, usuario.email, usuario.role);
```

(A linha `const tokens = ...` já existe — apenas garanta que o novo bloco `if` venha imediatamente antes dela.)

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @bolao/backend test -- auth.controller`
Expected: PASS (ambos os testes).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/auth/auth.controller.ts apps/backend/src/auth/auth.controller.spec.ts
git commit -m "feat: bloqueia login Google de usuários inativos"
```

---

## Task 5: Frontend — mensagem de erro para conta desativada

**Files:**
- Modify: `apps/frontend/src/app/(auth)/login/page.tsx:52-56`
- Test: `apps/frontend/src/__tests__/LoginPage.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar a `apps/frontend/src/__tests__/LoginPage.test.tsx` (após o teste de `cadastros-encerrados`):

```tsx
it('exibe banner de erro quando ?erro=conta-desativada', () => {
  mockGetParam.mockImplementation((key: string) => {
    if (key === 'erro') return 'conta-desativada';
    return null;
  });
  render(<LoginPage />);
  expect(screen.getByText('Sua conta está desativada.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @bolao/frontend test -- LoginPage`
Expected: FAIL — texto "Sua conta está desativada." não está no DOM.

- [ ] **Step 3: Implementar a mudança mínima**

Em `apps/frontend/src/app/(auth)/login/page.tsx`, logo após o bloco `{erroQuery === 'cadastros-encerrados' && ( ... )}` (linhas 52-56), adicionar:

```tsx
        {erroQuery === 'conta-desativada' && (
          <p className="text-red-400 text-sm text-center mb-4">
            Sua conta está desativada.
          </p>
        )}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @bolao/frontend test -- LoginPage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/frontend/src/app/(auth)/login/page.tsx" apps/frontend/src/__tests__/LoginPage.test.tsx
git commit -m "feat: tela de login exibe aviso de conta desativada"
```

---

## Task 6: Atualizar README e validar a suíte completa

**Files:**
- Modify: `README.md` (bullet do Painel administrativo)

Ranking não muda: `ranking.service.ts` já filtra `usuario: { ativo: true }` no recálculo e remove linhas de inativos; `ranking.service.spec.ts` já cobre isso (testes "só busca membros ativos do bolão" e "remove linhas Ranking de membros não-ativos"). Nenhum código ou teste de ranking é tocado.

- [ ] **Step 1: Atualizar o README**

Em `README.md`, no bullet do Painel administrativo, substituir o trecho:

```
gerir usuários com busca por nome/email (ativar/desativar, resetar senha)
```

por:

```
gerir usuários com busca por nome/email (ativar/desativar, resetar senha). Usuários desativados não conseguem entrar (Google ou e-mail/senha) e deixam de aparecer nas listas de membros, nas contagens e nos rankings
```

- [ ] **Step 2: Rodar a suíte de testes completa do backend e frontend**

Run: `pnpm --filter @bolao/backend test`
Expected: PASS — todos os specs do backend, incluindo `bolao.service`, `admin.service`, `auth.controller`, `ranking.service`.

Run: `pnpm --filter @bolao/frontend test`
Expected: PASS — incluindo `LoginPage`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README descreve restrições de usuários inativos"
```

---

## Self-Review (preenchido pelo autor do plano)

- **Cobertura do spec:** Login Google bloqueado → Task 4. Membros só ativos → Task 1. Contagem só ativos (listarMeus, buscarPorNome, admin listarBoloes) → Tasks 2 e 3. Frontend mensagem de erro → Task 5. Ranking (sem mudança, já coberto) e README → Task 6. ✅
- **Sem placeholders:** todos os steps têm código/comandos concretos. ✅
- **Consistência de tipos/strings:** o código de erro `conta-desativada` é idêntico no backend (Task 4), frontend render (Task 5) e teste frontend (Task 5). A shape do filtro `{ usuario: { ativo: true } }` é idêntica em obter/listarMeus/buscarPorNome/listarBoloes. ✅
