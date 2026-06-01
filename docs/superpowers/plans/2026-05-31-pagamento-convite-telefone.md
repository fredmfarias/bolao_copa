# Status de Pagamento + Convite para Novos Usuários + Telefone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que moderadores controlem status de pagamento de membros, que novos usuários entrem em bolões via link de convite durante o registro, e que o telefone seja obrigatório no cadastro.

**Architecture:** Três features independentes que compartilham a base de dados. Feature 1 (pagamento) adiciona campo ao `BolaoMembro` e novo endpoint. Feature 2 (convite no registro) reutiliza o `entrarViaConvite` existente chamado pelo `AuthService` durante o registro. Feature 3 (telefone) é um campo simples no `Usuario` com validação no DTO e máscara no frontend.

**Tech Stack:** NestJS (backend), Next.js + React (frontend), Prisma (ORM), PostgreSQL, Jest (testes), pnpm workspaces, `@bolao/shared` (enums compartilhados).

---

## Mapa de Arquivos

| Arquivo | Ação |
|---|---|
| `packages/shared/src/enums.ts` | Adicionar enum `StatusPagamento` |
| `apps/backend/prisma/schema.prisma` | Adicionar `telefone` em `Usuario`, `statusPagamento` em `BolaoMembro` |
| `apps/backend/src/auth/dto/register.dto.ts` | Adicionar `telefone` e `conviteToken` |
| `apps/backend/src/auth/auth.service.ts` | Incluir `telefone` no create, chamar `entrarViaConvite` se `conviteToken` |
| `apps/backend/src/auth/auth.module.ts` | Importar `BolaoModule`, injetar `BolaoService` |
| `apps/backend/src/auth/auth.service.spec.ts` | Atualizar testes existentes + novos casos |
| `apps/backend/src/bolao/dto/update-pagamento-status.dto.ts` | Novo DTO |
| `apps/backend/src/bolao/bolao.service.ts` | Novo método `atualizarPagamento` |
| `apps/backend/src/bolao/bolao.controller.ts` | Novo endpoint `PATCH /boloes/:bolaoId/membros/:usuarioId/pagamento` |
| `apps/backend/src/bolao/bolao.service.spec.ts` | Novos testes de pagamento |
| `apps/frontend/src/types/api.ts` | Adicionar `statusPagamento` em `BolaoMembro`, `telefone` em `Usuario` |
| `apps/frontend/src/components/ModeradorPanel.tsx` | Badge de pagamento clicável |
| `apps/frontend/src/__tests__/ModeradorPanel.test.tsx` | Atualizar fixtures + novo teste do badge |
| `apps/frontend/src/app/(auth)/registrar/page.tsx` | Campo telefone com máscara + `conviteToken` |
| `apps/frontend/src/app/convite/[codigo]/page.tsx` | Botão "Criar conta" no estado não-autenticado |

---

## Task 1: Shared enum `StatusPagamento`

**Files:**
- Modify: `packages/shared/src/enums.ts`

- [ ] **Step 1: Adicionar o enum**

Em `packages/shared/src/enums.ts`, adicionar após o enum `BolaoMembroPapel`:

```ts
export enum StatusPagamento {
  PENDENTE = 'PENDENTE',
  PAGO = 'PAGO',
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/enums.ts
git commit -m "feat(shared): add StatusPagamento enum"
```

---

## Task 2: Migration Prisma — `telefone` e `statusPagamento`

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

- [ ] **Step 1: Adicionar `StatusPagamento` e campos ao schema**

Em `apps/backend/prisma/schema.prisma`:

1. Adicionar o enum após `BolaoMembroPapel`:

```prisma
enum StatusPagamento {
  PENDENTE
  PAGO
}
```

2. Adicionar campo `telefone` ao model `Usuario` após `ativo`:

```prisma
  telefone        String    @default("")
```

3. Adicionar campo `statusPagamento` ao model `BolaoMembro` após `entrouEm`:

```prisma
  statusPagamento StatusPagamento @default(PENDENTE)
```

- [ ] **Step 2: Gerar e rodar a migration**

```bash
cd apps/backend && pnpm db:migrate --name add_telefone_and_status_pagamento
```

Esperado: migration criada em `prisma/migrations/` e aplicada com sucesso.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations/
git commit -m "feat(db): add telefone to Usuario and statusPagamento to BolaoMembro"
```

---

## Task 3: Backend — Telefone no cadastro

**Files:**
- Modify: `apps/backend/src/auth/dto/register.dto.ts`
- Modify: `apps/backend/src/auth/auth.service.ts`
- Modify: `apps/backend/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Escrever o teste que falhará**

Em `apps/backend/src/auth/auth.service.spec.ts`, atualizar os DTOs existentes para incluir `telefone` e adicionar um novo teste:

```ts
// Atualizar TODOS os calls existentes de service.registrar() para incluir telefone:
// { nome: 'Test', email: '...', senha: '12345678', telefone: '(11) 91234-5678' }

it('registrar inclui telefone na criação do usuário', async () => {
  prismaMock.usuario.findUnique.mockResolvedValue(null);
  prismaMock.usuario.create.mockResolvedValue({ id: 'new-id', email: 'b@b.com', nome: 'Test' });
  await service.registrar({ nome: 'Test', email: 'b@b.com', senha: '12345678', telefone: '(11) 91234-5678' });
  expect(prismaMock.usuario.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ telefone: '(11) 91234-5678' }),
    }),
  );
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
cd apps/backend && pnpm test --testPathPattern=auth.service.spec
```

Esperado: FAIL — `telefone` não existe no `RegisterDto` nem no `create`.

- [ ] **Step 3: Atualizar `RegisterDto`**

Conteúdo completo de `apps/backend/src/auth/dto/register.dto.ts`:

```ts
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(60)
  nome: string;

  @IsEmail()
  email: string;

  @IsString()
  @Matches(/^\(\d{2}\) \d{5}-\d{4}$/, { message: 'Formato inválido. Use (99) 99999-9999.' })
  telefone: string;

  @IsString() @MinLength(8)
  senha: string;
}
```

- [ ] **Step 4: Atualizar `AuthService.registrar()` para incluir `telefone`**

Em `apps/backend/src/auth/auth.service.ts`, alterar o `prisma.usuario.create`:

```ts
const usuario = await this.prisma.usuario.create({
  data: { nome: dto.nome, email: dto.email, senhaHash, telefone: dto.telefone },
});
```

- [ ] **Step 5: Rodar os testes para confirmar que passam**

```bash
cd apps/backend && pnpm test --testPathPattern=auth.service.spec
```

Esperado: PASS em todos os testes.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/auth/dto/register.dto.ts apps/backend/src/auth/auth.service.ts apps/backend/src/auth/auth.service.spec.ts
git commit -m "feat(auth): add mandatory telefone field to registration"
```

---

## Task 4: Backend — Status de Pagamento (DTO + Service + Controller)

**Files:**
- Create: `apps/backend/src/bolao/dto/update-pagamento-status.dto.ts`
- Modify: `apps/backend/src/bolao/bolao.service.ts`
- Modify: `apps/backend/src/bolao/bolao.controller.ts`
- Modify: `apps/backend/src/bolao/bolao.service.spec.ts`

- [ ] **Step 1: Escrever o teste que falhará**

Em `apps/backend/src/bolao/bolao.service.spec.ts`, adicionar após os testes existentes:

```ts
it('atualizarPagamento chama update com status correto', async () => {
  prismaMock.bolaoMembro.update.mockResolvedValue({});
  await service.atualizarPagamento('b1', 'u1', 'PAGO' as any);
  expect(prismaMock.bolaoMembro.update).toHaveBeenCalledWith({
    where: { bolaoId_usuarioId: { bolaoId: 'b1', usuarioId: 'u1' } },
    data: { statusPagamento: 'PAGO' },
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
cd apps/backend && pnpm test --testPathPattern=bolao.service.spec
```

Esperado: FAIL — `service.atualizarPagamento` não existe.

- [ ] **Step 3: Criar o DTO**

Criar `apps/backend/src/bolao/dto/update-pagamento-status.dto.ts`:

```ts
import { IsEnum } from 'class-validator';
import { StatusPagamento } from '@bolao/shared';

export class UpdatePagamentoStatusDto {
  @IsEnum(StatusPagamento)
  status: StatusPagamento;
}
```

- [ ] **Step 4: Adicionar `atualizarPagamento` ao `BolaoService`**

Em `apps/backend/src/bolao/bolao.service.ts`, adicionar import do `StatusPagamento`:

```ts
import { BolaoMembroPapel, BolaoStatus, BOLAO_GLOBAL_ID, StatusPagamento } from '@bolao/shared';
```

Adicionar método ao final da classe, antes do fechamento `}`:

```ts
async atualizarPagamento(bolaoId: string, usuarioId: string, status: StatusPagamento) {
  return this.prisma.bolaoMembro.update({
    where: { bolaoId_usuarioId: { bolaoId, usuarioId } },
    data: { statusPagamento: status },
  });
}
```

- [ ] **Step 5: Adicionar endpoint ao `BolaoController`**

Em `apps/backend/src/bolao/bolao.controller.ts`, adicionar import do DTO no topo:

```ts
import { UpdatePagamentoStatusDto } from './dto/update-pagamento-status.dto';
```

Adicionar endpoint dentro da classe `BolaoController`, após o endpoint `eleger`:

```ts
@UseGuards(BolaoModeradorGuard)
@Patch(':bolaoId/membros/:usuarioId/pagamento')
atualizarPagamento(
  @Param('bolaoId') bolaoId: string,
  @Param('usuarioId') usuarioId: string,
  @Body() dto: UpdatePagamentoStatusDto,
) {
  return this.service.atualizarPagamento(bolaoId, usuarioId, dto.status);
}
```

Adicionar `Patch` aos imports do `@nestjs/common` no topo do controller:

```ts
import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
```

(`Patch` já está importado — confirmar que está na lista.)

- [ ] **Step 6: Rodar os testes para confirmar que passam**

```bash
cd apps/backend && pnpm test --testPathPattern=bolao.service.spec
```

Esperado: PASS em todos os testes.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/bolao/dto/update-pagamento-status.dto.ts apps/backend/src/bolao/bolao.service.ts apps/backend/src/bolao/bolao.controller.ts apps/backend/src/bolao/bolao.service.spec.ts
git commit -m "feat(bolao): add payment status control for moderators"
```

---

## Task 5: Backend — Convite no registro

**Files:**
- Modify: `apps/backend/src/auth/dto/register.dto.ts`
- Modify: `apps/backend/src/auth/auth.module.ts`
- Modify: `apps/backend/src/auth/auth.service.ts`
- Modify: `apps/backend/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Escrever os testes que falharão**

Em `apps/backend/src/auth/auth.service.spec.ts`:

1. Adicionar `BolaoService` ao mock e ao `TestingModule`:

```ts
// Adicionar ao mock no topo do arquivo:
const bolaoMock = { entrarViaConvite: jest.fn() };

// Dentro de beforeEach, no providers:
{ provide: BolaoService, useValue: bolaoMock },
```

2. Adicionar import no topo:
```ts
import { BolaoService } from '../bolao/bolao.service';
```

3. Adicionar ao `jest.clearAllMocks()` — já cobre automaticamente.

4. Adicionar novos testes:

```ts
it('registrar chama entrarViaConvite quando conviteToken fornecido', async () => {
  prismaMock.usuario.findUnique.mockResolvedValue(null);
  prismaMock.usuario.create.mockResolvedValue({ id: 'new-id', email: 'b@b.com', nome: 'Test' });
  bolaoMock.entrarViaConvite.mockResolvedValue({});
  await service.registrar({
    nome: 'Test', email: 'b@b.com', senha: '12345678',
    telefone: '(11) 91234-5678', conviteToken: 'token-abc',
  });
  expect(bolaoMock.entrarViaConvite).toHaveBeenCalledWith(
    { id: 'new-id', role: undefined },
    'token-abc',
  );
});

it('registrar não chama entrarViaConvite quando conviteToken ausente', async () => {
  prismaMock.usuario.findUnique.mockResolvedValue(null);
  prismaMock.usuario.create.mockResolvedValue({ id: 'new-id', email: 'b@b.com', nome: 'Test' });
  await service.registrar({ nome: 'Test', email: 'b@b.com', senha: '12345678', telefone: '(11) 91234-5678' });
  expect(bolaoMock.entrarViaConvite).not.toHaveBeenCalled();
});

it('registrar propaga exceção do convite inválido', async () => {
  prismaMock.usuario.findUnique.mockResolvedValue(null);
  prismaMock.usuario.create.mockResolvedValue({ id: 'new-id', email: 'b@b.com', nome: 'Test' });
  bolaoMock.entrarViaConvite.mockRejectedValueOnce(new BadRequestException('Convite inválido.'));
  await expect(
    service.registrar({
      nome: 'Test', email: 'b@b.com', senha: '12345678',
      telefone: '(11) 91234-5678', conviteToken: 'token-ruim',
    }),
  ).rejects.toThrow(BadRequestException);
});
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

```bash
cd apps/backend && pnpm test --testPathPattern=auth.service.spec
```

Esperado: FAIL — `BolaoService` não injetado, `conviteToken` não existe no DTO.

- [ ] **Step 3: Adicionar `conviteToken` ao `RegisterDto`**

Em `apps/backend/src/auth/dto/register.dto.ts`, adicionar campo opcional após `senha`:

```ts
import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';

// ... campos existentes ...

@IsOptional()
@IsString()
conviteToken?: string;
```

- [ ] **Step 4: Importar `BolaoModule` no `AuthModule`**

Conteúdo completo de `apps/backend/src/auth/auth.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { MailerModule } from '../mailer/mailer.module';
import { BolaoModule } from '../bolao/bolao.module';

@Module({
  imports: [PassportModule, JwtModule, MailerModule, BolaoModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy, GoogleStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 5: Atualizar `AuthService` para injetar `BolaoService` e chamar `entrarViaConvite`**

Em `apps/backend/src/auth/auth.service.ts`:

1. Adicionar import:
```ts
import { BolaoService } from '../bolao/bolao.service';
```

2. Adicionar ao construtor:
```ts
constructor(
  private prisma: PrismaService,
  private jwt: JwtService,
  private config: ConfigService,
  @Inject('MAILER') private mailer: any,
  private inscricaoWindow: InscricaoWindowService,
  private bolaoService: BolaoService,
) {}
```

3. Atualizar `registrar()` — após `await this.enviarEmailConfirmacao(...)`, adicionar:

```ts
if (dto.conviteToken) {
  await this.bolaoService.entrarViaConvite({ id: usuario.id, role: usuario.role }, dto.conviteToken);
}
```

- [ ] **Step 6: Rodar os testes para confirmar que passam**

```bash
cd apps/backend && pnpm test --testPathPattern=auth.service.spec
```

Esperado: PASS em todos os testes.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/auth/dto/register.dto.ts apps/backend/src/auth/auth.module.ts apps/backend/src/auth/auth.service.ts apps/backend/src/auth/auth.service.spec.ts
git commit -m "feat(auth): join bolao via invite token during registration"
```

---

## Task 6: Frontend — Tipos atualizados

**Files:**
- Modify: `apps/frontend/src/types/api.ts`

- [ ] **Step 1: Atualizar `BolaoMembro` e `Usuario`**

Em `apps/frontend/src/types/api.ts`:

1. Atualizar interface `BolaoMembro`:

```ts
export interface BolaoMembro {
  id: string;
  usuarioId: string;
  papel: 'MODERADOR' | 'PARTICIPANTE';
  statusPagamento: 'PENDENTE' | 'PAGO';
  usuario: { id: string; nome: string; avatarUrl: string | null };
}
```

2. Atualizar interface `Usuario`:

```ts
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  avatarUrl: string | null;
  role: 'ADMIN' | 'USER';
  ativo?: boolean;
  criadoEm: string;
  bolaoFavoritoId?: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/types/api.ts
git commit -m "feat(frontend/types): add statusPagamento to BolaoMembro and telefone to Usuario"
```

---

## Task 7: Frontend — Badge de pagamento no `ModeradorPanel`

**Files:**
- Modify: `apps/frontend/src/components/ModeradorPanel.tsx`
- Modify: `apps/frontend/src/__tests__/ModeradorPanel.test.tsx`

- [ ] **Step 1: Escrever o teste que falhará**

Conteúdo completo de `apps/frontend/src/__tests__/ModeradorPanel.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModeradorPanel } from '@/components/ModeradorPanel';
import type { BolaoMembro } from '@/types/api';

jest.mock('@/lib/api', () => ({
  api: {
    post: jest.fn().mockResolvedValue({}),
    patch: jest.fn().mockResolvedValue({}),
  },
}));
import { api } from '@/lib/api';
const mockPost = api.post as jest.Mock;
const mockPatch = api.patch as jest.Mock;

const membros: BolaoMembro[] = [
  { id: 'm1', usuarioId: 'u1', papel: 'PARTICIPANTE', statusPagamento: 'PENDENTE', usuario: { id: 'u1', nome: 'Alice', avatarUrl: null } },
  { id: 'm2', usuarioId: 'u2', papel: 'MODERADOR',    statusPagamento: 'PAGO',     usuario: { id: 'u2', nome: 'Bob',   avatarUrl: null } },
];

beforeEach(() => { mockPost.mockClear(); mockPatch.mockClear(); });

it('exibe lista de membros', () => {
  render(<ModeradorPanel bolaoId="b1" membros={membros} onAtualizado={jest.fn()} />);
  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.getByText('Bob')).toBeInTheDocument();
});

it('botão remover chama POST /boloes/:id/remover/:userId', async () => {
  const onAtualizado = jest.fn();
  render(<ModeradorPanel bolaoId="b1" membros={membros} onAtualizado={onAtualizado} />);
  fireEvent.click(screen.getAllByRole('button', { name: /remover/i })[0]);
  await waitFor(() => {
    expect(mockPost).toHaveBeenCalledWith('/boloes/b1/remover/u1');
    expect(onAtualizado).toHaveBeenCalled();
  });
});

it('badge Pendente chama PATCH para PAGO e notifica onAtualizado', async () => {
  const onAtualizado = jest.fn();
  render(<ModeradorPanel bolaoId="b1" membros={membros} onAtualizado={onAtualizado} />);
  fireEvent.click(screen.getByText('Pendente'));
  await waitFor(() => {
    expect(mockPatch).toHaveBeenCalledWith('/boloes/b1/membros/u1/pagamento', { status: 'PAGO' });
    expect(onAtualizado).toHaveBeenCalled();
  });
});

it('badge Pago chama PATCH para PENDENTE e notifica onAtualizado', async () => {
  const onAtualizado = jest.fn();
  render(<ModeradorPanel bolaoId="b1" membros={membros} onAtualizado={onAtualizado} />);
  fireEvent.click(screen.getByText('Pago'));
  await waitFor(() => {
    expect(mockPatch).toHaveBeenCalledWith('/boloes/b1/membros/u2/pagamento', { status: 'PENDENTE' });
    expect(onAtualizado).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
cd apps/frontend && pnpm test --testPathPattern=ModeradorPanel
```

Esperado: FAIL — badge de pagamento não existe.

- [ ] **Step 3: Atualizar `ModeradorPanel.tsx`**

Conteúdo completo de `apps/frontend/src/components/ModeradorPanel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { BolaoMembro } from '@/types/api';

interface ModeradorPanelProps {
  bolaoId: string;
  membros: BolaoMembro[];
  onAtualizado: () => void;
}

const MEMBROS_INICIAIS = 3;
const MEMBROS_PASSO = 10;

export function ModeradorPanel({ bolaoId, membros, onAtualizado }: ModeradorPanelProps) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const [visiveis, setVisiveis] = useState(MEMBROS_INICIAIS);

  async function acao(path: string, memberId: string) {
    setAtivo(memberId);
    try {
      await api.post(path);
      onAtualizado();
    } finally {
      setAtivo(null);
    }
  }

  async function alternarPagamento(m: BolaoMembro) {
    const novoStatus = m.statusPagamento === 'PENDENTE' ? 'PAGO' : 'PENDENTE';
    setAtivo(`pag-${m.usuarioId}`);
    try {
      await api.patch(`/boloes/${bolaoId}/membros/${m.usuarioId}/pagamento`, { status: novoStatus });
      onAtualizado();
    } finally {
      setAtivo(null);
    }
  }

  const restante = membros.length - visiveis;

  return (
    <div className="space-y-2">
      <p className="text-trovao-muted text-xs font-semibold uppercase tracking-wider px-1">Membros</p>
      {membros.slice(0, visiveis).map(m => (
        <div key={m.id} className="flex items-center gap-3 px-4 py-3 bg-trovao-card border border-trovao-border rounded-xl">
          {m.usuario.avatarUrl ? (
            <img src={m.usuario.avatarUrl} alt={m.usuario.nome} className="w-8 h-8 rounded-full flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-trovao-surface flex items-center justify-center text-xs font-bold text-trovao-muted flex-shrink-0">
              {m.usuario.nome.charAt(0).toUpperCase()}
            </div>
          )}

          <span className="flex-1 text-white text-sm">{m.usuario.nome}</span>

          <span className={`text-xs px-2 py-0.5 rounded-full ${
            m.papel === 'MODERADOR' ? 'bg-trovao-gold/20 text-trovao-gold' : 'bg-trovao-surface text-trovao-muted'
          }`}>
            {m.papel === 'MODERADOR' ? 'Mod' : 'Membro'}
          </span>

          <button
            disabled={ativo === `pag-${m.usuarioId}`}
            onClick={() => alternarPagamento(m)}
            className={`text-xs px-2 py-0.5 rounded-full transition-opacity disabled:opacity-50 ${
              m.statusPagamento === 'PAGO'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}
          >
            {m.statusPagamento === 'PAGO' ? 'Pago' : 'Pendente'}
          </button>

          <div className="flex gap-1">
            {m.papel === 'PARTICIPANTE' && (
              <button disabled={ativo === m.usuarioId}
                onClick={() => acao(`/boloes/${bolaoId}/eleger/${m.usuarioId}`, m.usuarioId)}
                className="text-[10px] px-2 py-1 rounded border border-trovao-border text-trovao-muted hover:text-trovao-gold hover:border-trovao-gold disabled:opacity-40 transition-colors">
                → Mod
              </button>
            )}
            <button disabled={ativo === m.usuarioId}
              onClick={() => acao(`/boloes/${bolaoId}/remover/${m.usuarioId}`, m.usuarioId)}
              className="text-[10px] px-2 py-1 rounded border border-trovao-border text-trovao-muted hover:text-trovao-red hover:border-trovao-red disabled:opacity-40 transition-colors">
              Remover
            </button>
          </div>
        </div>
      ))}
      {restante > 0 && (
        <button onClick={() => setVisiveis(v => v + MEMBROS_PASSO)}
          className="w-full text-xs text-trovao-muted hover:text-white transition-colors py-1">
          mais {restante}...
        </button>
      )}
      {visiveis > MEMBROS_INICIAIS && restante <= 0 && (
        <button onClick={() => setVisiveis(MEMBROS_INICIAIS)}
          className="w-full text-xs text-trovao-muted hover:text-white transition-colors py-1">
          ocultar
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
cd apps/frontend && pnpm test --testPathPattern=ModeradorPanel
```

Esperado: PASS em todos os 4 testes.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/ModeradorPanel.tsx apps/frontend/src/__tests__/ModeradorPanel.test.tsx
git commit -m "feat(frontend): add payment status badge to ModeradorPanel"
```

---

## Task 8: Frontend — Telefone no formulário de registro

**Files:**
- Modify: `apps/frontend/src/app/(auth)/registrar/page.tsx`

- [ ] **Step 1: Atualizar a página de registro**

Conteúdo completo de `apps/frontend/src/app/(auth)/registrar/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useInscricaoStatus } from '@/hooks/useInscricaoStatus';

function mascaraTelefone(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 2) return `(${nums}`;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
}

export default function RegistrarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conviteToken = searchParams.get('convite');
  const { abertas } = useInscricaoStatus();
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', senha: '' });
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const body = conviteToken ? { ...form, conviteToken } : form;
      const data = await api.post<{ message: string }>('/auth/registrar', body);
      setSucesso(data.message);
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao cadastrar.');
    } finally {
      setLoading(false);
    }
  }

  if (!abertas) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-gray-900 rounded-xl p-8 text-center max-w-sm space-y-4">
        <p className="text-red-400">
          Cadastros encerrados a 2h do início da Copa. Procure o administrador para se cadastrar.
        </p>
        <Link href="/login" className="text-yellow-400 hover:underline block">Voltar ao login</Link>
      </div>
    </div>
  );

  if (sucesso) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-gray-900 rounded-xl p-8 text-center max-w-sm space-y-4">
        <p className="text-green-400">{sucesso}</p>
        <Link href="/login" className="text-yellow-400 hover:underline block">Ir para login</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm bg-gray-900 rounded-xl p-8 space-y-6">
        <h1 className="text-xl font-bold text-center">Criar conta</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && <p className="text-red-400 text-sm">{erro}</p>}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Nome</label>
            <input type="text" value={form.nome} required
              onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input type="email" value={form.email} required
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Telefone</label>
            <input type="tel" inputMode="numeric" value={form.telefone} required
              placeholder="(11) 91234-5678"
              onChange={e => setForm(p => ({ ...p, telefone: mascaraTelefone(e.target.value) }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Senha</label>
            <input type="password" value={form.senha} required
              onChange={e => setForm(p => ({ ...p, senha: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-yellow-400 text-gray-900 font-bold py-2 rounded-lg hover:bg-yellow-300 disabled:opacity-50">
            {loading ? 'Cadastrando...' : 'Cadastrar'}
          </button>
        </form>
        <div className="text-center text-sm text-gray-400">
          <Link href="/login" className="hover:text-white">Já tem conta? Entrar</Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

```bash
cd apps/frontend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/app/\(auth\)/registrar/page.tsx
git commit -m "feat(frontend): add phone field with mask to registration form"
```

---

## Task 9: Frontend — Botão "Criar conta" na página de convite

**Files:**
- Modify: `apps/frontend/src/app/convite/[codigo]/page.tsx`

- [ ] **Step 1: Adicionar botão "Criar conta" no estado `nao-autenticado`**

Em `apps/frontend/src/app/convite/[codigo]/page.tsx`, localizar o bloco `if (estado === 'nao-autenticado')` e substituir pelo seguinte:

```tsx
if (estado === 'nao-autenticado') {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-trovao-card border border-trovao-border rounded-2xl p-8 text-center space-y-4">
        <div className="text-4xl">⚡</div>
        <h1 className="text-white font-bold text-lg">{convite?.bolaoNome}</h1>
        {convite?.descricao && <p className="text-trovao-muted text-sm">{convite.descricao}</p>}
        <p className="text-trovao-muted text-xs">Convidado por {convite?.criadorNome}</p>
        <p className="text-trovao-muted text-sm">Entre ou crie uma conta para participar.</p>
        <button onClick={() => router.push(`/login?redirect=/convite/${codigo}`)}
          className="w-full py-2 bg-trovao-gold text-trovao-base text-sm font-bold rounded-lg hover:opacity-90 transition-opacity">
          Fazer login
        </button>
        <button onClick={() => router.push(`/registrar?convite=${codigo}`)}
          className="w-full py-2 bg-trovao-surface border border-trovao-border text-trovao-muted text-sm rounded-lg hover:text-white transition-colors">
          Criar conta
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

```bash
cd apps/frontend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "apps/frontend/src/app/convite/[codigo]/page.tsx"
git commit -m "feat(frontend): add create account button on invite page for unauthenticated users"
```

---

## Self-Review do Plano

**Cobertura da spec:**

| Requisito | Task |
|---|---|
| Enum `StatusPagamento` em shared | Task 1 |
| Migration `telefone` + `statusPagamento` | Task 2 |
| `telefone` obrigatório no `RegisterDto` com validação de formato | Task 3 |
| `telefone` no `prisma.usuario.create` | Task 3 |
| DTO `UpdatePagamentoStatusDto` | Task 4 |
| Método `atualizarPagamento` em `BolaoService` | Task 4 |
| Endpoint `PATCH /boloes/:bolaoId/membros/:usuarioId/pagamento` com guard | Task 4 |
| Campo `conviteToken` opcional no `RegisterDto` | Task 5 |
| `BolaoModule` importado no `AuthModule` | Task 5 |
| `AuthService` chama `entrarViaConvite` quando `conviteToken` presente | Task 5 |
| Janela fechada bloqueia o registro (comportamento herdado via `assertAberta`) | Task 5 |
| Tipos frontend atualizados | Task 6 |
| Badge de pagamento clicável no `ModeradorPanel` | Task 7 |
| Campo telefone com máscara no formulário de registro | Task 8 |
| Botão "Criar conta" com `?convite=TOKEN` na página de convite | Task 9 |
| `conviteToken` passado no body do POST de registro | Task 8 |
