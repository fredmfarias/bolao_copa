# Corte de inscrições antes da Copa — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bloquear auto-cadastro (e-mail/senha + Google OAuth) e ingresso em bolões 2h antes do primeiro jogo da Copa, com bypass para ADMIN via endpoints novos.

**Architecture:** `InscricaoWindowService` único (backend) calcula `dataCorte = primeiro_jogo - 2h` com cache 60s; integrado em `AuthService`, `AuthController` (Google callback) e `BolaoService`. Endpoint público `GET /auth/inscricoes/status` alimenta `useInscricaoStatus` hook no frontend, que desabilita "Criar conta" no `/login` e bloqueia `/registrar`. ADMIN bypassa via `POST /admin/usuarios` (cria conta + opcional bolão) e `POST /admin/boloes/:bolaoId/membros` (adicionar usuário existente).

**Tech Stack:** NestJS 10, Prisma 5, Bull/Redis (não tocado), Next.js 14 (App Router), React 18, shadcn/ui Dialog, Jest 29, Playwright (E2E).

---

## Mapa de arquivos

**Novos:**
- `packages/shared/src/enums.ts` — adicionar `HORAS_CORTE_INSCRICAO = 2`
- `apps/backend/src/inscricao-window/inscricao-window.service.ts`
- `apps/backend/src/inscricao-window/inscricao-window.module.ts`
- `apps/backend/src/inscricao-window/inscricao-window.service.spec.ts`
- `apps/backend/src/admin/dto/create-usuario-admin.dto.ts`
- `apps/frontend/src/hooks/useInscricaoStatus.ts`
- `apps/frontend/src/components/AdminCriarUsuarioDialog.tsx`
- `apps/frontend/src/components/AdminAdicionarBolaoDialog.tsx`
- `apps/frontend/src/__tests__/RegistrarPage.test.tsx`
- `apps/frontend/src/__tests__/useInscricaoStatus.test.ts`
- `apps/frontend/src/__tests__/AdminCriarUsuarioDialog.test.tsx`
- `apps/frontend/src/__tests__/AdminAdicionarBolaoDialog.test.tsx`
- `e2e/tests/auth/janela-inscricao.api.spec.ts`

**Alterados (backend):**
- `apps/backend/src/auth/auth.controller.ts` — endpoint status + Google callback guard
- `apps/backend/src/auth/auth.service.ts` — `assertAberta` no `registrar`
- `apps/backend/src/auth/auth.module.ts` — import `InscricaoWindowModule`
- `apps/backend/src/auth/auth.service.spec.ts` — caso novo (registrar 403)
- `apps/backend/src/bolao/bolao.service.ts` — `assertAberta` em `entrarViaConvite` + `aprovarMembro`; `adicionarMembro` público
- `apps/backend/src/bolao/bolao.controller.ts` — passar user objeto em `entrarViaConvite`/`aprovar`
- `apps/backend/src/bolao/bolao.module.ts` — import `InscricaoWindowModule`; exportar `BolaoService`
- `apps/backend/src/bolao/bolao.service.spec.ts` — casos novos
- `apps/backend/src/admin/admin.controller.ts` — `POST /usuarios` + `POST /boloes/:bolaoId/membros`
- `apps/backend/src/admin/admin.service.ts` — `criarUsuario`, `adicionarUsuarioBolao`
- `apps/backend/src/admin/admin.module.ts` — import `BolaoModule`
- `apps/backend/src/admin/admin.service.spec.ts` — casos novos

**Alterados (frontend):**
- `apps/frontend/src/app/(auth)/login/page.tsx`
- `apps/frontend/src/app/(auth)/registrar/page.tsx`
- `apps/frontend/src/app/admin/usuarios/page.tsx`
- `apps/frontend/src/__tests__/LoginPage.test.tsx` (estender)

**Alterados (docs):**
- `README.md`

---

## Convenções

- Após cada task, rodar **apenas** o teste afetado. Lint/typecheck/full test pro final (Task 15).
- Mensagens de commit no estilo do repo: `feat(escopo): ...`, `test(escopo): ...`, `docs: ...`, `refactor(escopo): ...`.
- Backend tests: `pnpm --filter @bolao/backend test -- <caminho>`
- Frontend tests: `pnpm --filter @bolao/frontend test -- <caminho>`
- E2E: `cd e2e && npx playwright test <arquivo> --project=api`

---

## Task 1: Constante compartilhada `HORAS_CORTE_INSCRICAO`

**Files:**
- Modify: `packages/shared/src/enums.ts`

- [ ] **Step 1: Adicionar constante**

Edite `packages/shared/src/enums.ts`, no final do arquivo (após `BOLAO_GLOBAL_ID`):

```ts
export const HORAS_CORTE_INSCRICAO = 2;
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/enums.ts
git commit -m "feat(shared): adiciona HORAS_CORTE_INSCRICAO"
```

---

## Task 2: `InscricaoWindowService` + módulo + testes

**Files:**
- Create: `apps/backend/src/inscricao-window/inscricao-window.service.ts`
- Create: `apps/backend/src/inscricao-window/inscricao-window.module.ts`
- Create: `apps/backend/src/inscricao-window/inscricao-window.service.spec.ts`

- [ ] **Step 1: Escrever spec falhando**

Crie `apps/backend/src/inscricao-window/inscricao-window.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { InscricaoWindowService } from './inscricao-window.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = { jogo: { findFirst: jest.fn() } };

describe('InscricaoWindowService', () => {
  let service: InscricaoWindowService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InscricaoWindowService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(InscricaoWindowService);
    jest.clearAllMocks();
  });

  it('abertas=true quando agora < dataCorte (jogo no futuro)', async () => {
    const futuro = new Date(Date.now() + 5 * 60 * 60 * 1000); // T+5h
    prismaMock.jogo.findFirst.mockResolvedValue({ dataHora: futuro });
    const status = await service.getStatus();
    expect(status.abertas).toBe(true);
    expect(status.dataCorte).toBeInstanceOf(Date);
  });

  it('abertas=false quando agora >= dataCorte', async () => {
    const proximo = new Date(Date.now() + 60 * 60 * 1000); // T+1h (corte foi T-1h)
    prismaMock.jogo.findFirst.mockResolvedValue({ dataHora: proximo });
    const status = await service.getStatus();
    expect(status.abertas).toBe(false);
  });

  it('abertas=true e dataCorte=null se não há jogo cadastrado', async () => {
    prismaMock.jogo.findFirst.mockResolvedValue(null);
    const status = await service.getStatus();
    expect(status).toEqual({ abertas: true, dataPrimeiroJogo: null, dataCorte: null });
  });

  it('cache evita consulta repetida ao DB dentro do TTL', async () => {
    prismaMock.jogo.findFirst.mockResolvedValue({ dataHora: new Date(Date.now() + 5 * 60 * 60 * 1000) });
    await service.getStatus();
    await service.getStatus();
    await service.getStatus();
    expect(prismaMock.jogo.findFirst).toHaveBeenCalledTimes(1);
  });

  it('assertAberta(undefined) lança quando fechado', async () => {
    prismaMock.jogo.findFirst.mockResolvedValue({ dataHora: new Date(Date.now() + 60 * 60 * 1000) });
    await expect(service.assertAberta()).rejects.toThrow(ForbiddenException);
  });

  it('assertAberta(ADMIN) não lança mesmo fechado', async () => {
    prismaMock.jogo.findFirst.mockResolvedValue({ dataHora: new Date(Date.now() + 60 * 60 * 1000) });
    await expect(service.assertAberta({ role: 'ADMIN' })).resolves.toBeUndefined();
  });

  it('assertAberta(USER) não lança quando aberto', async () => {
    prismaMock.jogo.findFirst.mockResolvedValue({ dataHora: new Date(Date.now() + 5 * 60 * 60 * 1000) });
    await expect(service.assertAberta({ role: 'USER' })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar teste para confirmar falha**

```bash
pnpm --filter @bolao/backend test -- inscricao-window.service.spec.ts
```

Esperado: FAIL (módulo não existe).

- [ ] **Step 3: Implementar o service**

Crie `apps/backend/src/inscricao-window/inscricao-window.service.ts`:

```ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HORAS_CORTE_INSCRICAO, Role } from '@bolao/shared';

export interface InscricaoStatus {
  abertas: boolean;
  dataPrimeiroJogo: Date | null;
  dataCorte: Date | null;
}

const TTL_MS = 60_000;

@Injectable()
export class InscricaoWindowService {
  private cache: { value: InscricaoStatus; expiresAt: number } | null = null;

  constructor(private prisma: PrismaService) {}

  async getStatus(): Promise<InscricaoStatus> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.value;

    const primeiro = await this.prisma.jogo.findFirst({
      orderBy: { dataHora: 'asc' },
      select: { dataHora: true },
    });

    let value: InscricaoStatus;
    if (!primeiro) {
      value = { abertas: true, dataPrimeiroJogo: null, dataCorte: null };
    } else {
      const dataCorte = new Date(
        primeiro.dataHora.getTime() - HORAS_CORTE_INSCRICAO * 60 * 60 * 1000,
      );
      value = {
        abertas: Date.now() < dataCorte.getTime(),
        dataPrimeiroJogo: primeiro.dataHora,
        dataCorte,
      };
    }

    this.cache = { value, expiresAt: Date.now() + TTL_MS };
    return value;
  }

  async assertAberta(user?: { role?: string }): Promise<void> {
    if (user?.role === Role.ADMIN) return;
    const status = await this.getStatus();
    if (!status.abertas) {
      throw new ForbiddenException('Inscrições encerradas.');
    }
  }
}
```

Crie `apps/backend/src/inscricao-window/inscricao-window.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { InscricaoWindowService } from './inscricao-window.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [InscricaoWindowService],
  exports: [InscricaoWindowService],
})
export class InscricaoWindowModule {}
```

- [ ] **Step 4: Rodar teste e verificar verde**

```bash
pnpm --filter @bolao/backend test -- inscricao-window.service.spec.ts
```

Esperado: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/inscricao-window
git commit -m "feat(backend): InscricaoWindowService com cache e bypass de admin"
```

---

## Task 3: `GET /auth/inscricoes/status` (público)

**Files:**
- Modify: `apps/backend/src/auth/auth.controller.ts`
- Modify: `apps/backend/src/auth/auth.module.ts`

- [ ] **Step 1: Importar módulo em AuthModule**

Em `apps/backend/src/auth/auth.module.ts`, atualize imports:

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
import { InscricaoWindowModule } from '../inscricao-window/inscricao-window.module';

@Module({
  imports: [PassportModule, JwtModule, MailerModule, InscricaoWindowModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy, GoogleStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 2: Adicionar endpoint e injetar service no AuthController**

Em `apps/backend/src/auth/auth.controller.ts`, atualize o import e a classe:

```ts
import { Controller, Post, Get, Body, Query, Res, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';
import { InscricaoWindowService } from '../inscricao-window/inscricao-window.service';
import { BOLAO_GLOBAL_ID } from '@bolao/shared';
```

Atualize o constructor:

```ts
constructor(
  private auth: AuthService,
  private prisma: PrismaService,
  private inscricaoWindow: InscricaoWindowService,
) {}
```

Logo após o constructor, adicione o endpoint público:

```ts
@Get('inscricoes/status')
async statusInscricoes() {
  const status = await this.inscricaoWindow.getStatus();
  return {
    abertas: status.abertas,
    dataCorte: status.dataCorte?.toISOString() ?? null,
  };
}
```

- [ ] **Step 3: Smoke test manual via curl**

Rode `pnpm dev` em terminal separado (se não estiver). Em outro terminal:

```bash
curl -s http://localhost:3001/auth/inscricoes/status
```

Esperado (com seed atual): `{"abertas":true,"dataCorte":"2026-..."}` ou `{"abertas":true,"dataCorte":null}` se DB sem jogo.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/auth
git commit -m "feat(backend): GET /auth/inscricoes/status público"
```

---

## Task 4: `assertAberta` no `AuthService.registrar`

**Files:**
- Modify: `apps/backend/src/auth/auth.service.ts`
- Modify: `apps/backend/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Escrever teste falhando**

Em `apps/backend/src/auth/auth.service.spec.ts`, no topo dos providers do `Test.createTestingModule`, adicione o mock de `InscricaoWindowService`. Substitua o bloco `beforeEach`:

```ts
import { InscricaoWindowService } from '../inscricao-window/inscricao-window.service';
import { ForbiddenException } from '@nestjs/common';

const inscricaoMock = { assertAberta: jest.fn() };

beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: PrismaService, useValue: prismaMock },
      { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('token') } },
      { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('secret') } },
      { provide: 'MAILER', useValue: mailerMock },
      { provide: InscricaoWindowService, useValue: inscricaoMock },
    ],
  }).compile();
  service = module.get<AuthService>(AuthService);
  jest.clearAllMocks();
  inscricaoMock.assertAberta.mockResolvedValue(undefined);
});
```

Antes do bloco `it('login lança...')`, adicione:

```ts
it('registrar lança ForbiddenException quando janela está fechada', async () => {
  inscricaoMock.assertAberta.mockRejectedValueOnce(new ForbiddenException('Inscrições encerradas.'));
  await expect(
    service.registrar({ nome: 'Test', email: 'c@c.com', senha: '12345678' }),
  ).rejects.toThrow(ForbiddenException);
  expect(prismaMock.usuario.create).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Rodar teste para confirmar falha**

```bash
pnpm --filter @bolao/backend test -- auth.service.spec.ts
```

Esperado: FAIL nesse caso e provavelmente nos outros (mock alterado). Próximo step resolve.

- [ ] **Step 3: Injetar service no AuthService e chamar assertAberta**

Em `apps/backend/src/auth/auth.service.ts`, atualize imports e constructor:

```ts
import { Injectable, ConflictException, UnauthorizedException, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { InscricaoWindowService } from '../inscricao-window/inscricao-window.service';
import { BOLAO_GLOBAL_ID } from '@bolao/shared';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    @Inject('MAILER') private mailer: any,
    private inscricaoWindow: InscricaoWindowService,
  ) {}
```

No início de `registrar(dto)`, adicione a chamada como primeira linha:

```ts
async registrar(dto: RegisterDto) {
  await this.inscricaoWindow.assertAberta();

  const existe = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
  // resto idem
```

- [ ] **Step 4: Rodar teste e verificar verde**

```bash
pnpm --filter @bolao/backend test -- auth.service.spec.ts
```

Esperado: PASS (todos os casos, incluindo o novo).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/auth
git commit -m "feat(backend): AuthService.registrar valida janela de inscrição"
```

---

## Task 5: Bloqueio de Google OAuth callback quando janela fechada

**Files:**
- Modify: `apps/backend/src/auth/auth.controller.ts`

- [ ] **Step 1: Atualizar `googleCallback` no AuthController**

Em `apps/backend/src/auth/auth.controller.ts`, dentro do bloco `if (!usuario)`, adicione o check antes do `prisma.usuario.create`:

```ts
if (!usuario) {
  const status = await this.inscricaoWindow.getStatus();
  if (!status.abertas) {
    return res.redirect(`${process.env.APP_URL}/login?erro=cadastros-encerrados`);
  }

  usuario = await this.prisma.usuario.create({
    data: {
      nome: profile.nome, email: profile.email,
      googleId: profile.googleId, avatarUrl: profile.avatarUrl,
      emailVerificado: true,
    },
  });
  await this.prisma.bolaoMembro.create({
    data: { bolaoId: BOLAO_GLOBAL_ID, usuarioId: usuario.id },
  });
  await this.prisma.ranking.create({
    data: { bolaoId: BOLAO_GLOBAL_ID, usuarioId: usuario.id },
  });
} else if (!usuario.googleId) {
  // ... resto idem
```

- [ ] **Step 2: Smoke test (sem teste unitário — controller depende de Passport, custo > benefício)**

Verificação manual coberta pela E2E em Task 14. Lint e typecheck no fim cobrem regressão básica.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/auth/auth.controller.ts
git commit -m "feat(backend): Google callback respeita janela de inscrição"
```

---

## Task 6: `assertAberta` em `entrarViaConvite` + `aprovarMembro`

**Files:**
- Modify: `apps/backend/src/bolao/bolao.service.ts`
- Modify: `apps/backend/src/bolao/bolao.controller.ts`
- Modify: `apps/backend/src/bolao/bolao.module.ts`
- Modify: `apps/backend/src/bolao/bolao.service.spec.ts`

- [ ] **Step 1: Escrever testes falhando**

Em `apps/backend/src/bolao/bolao.service.spec.ts`, no topo adicione o mock:

```ts
import { InscricaoWindowService } from '../inscricao-window/inscricao-window.service';

const inscricaoMock = { assertAberta: jest.fn() };
```

No `beforeEach`, atualize:

```ts
beforeEach(async () => {
  const module = await Test.createTestingModule({
    providers: [
      BolaoService,
      { provide: PrismaService, useValue: prismaMock },
      { provide: InscricaoWindowService, useValue: inscricaoMock },
    ],
  }).compile();
  service = module.get(BolaoService);
  jest.clearAllMocks();
  inscricaoMock.assertAberta.mockResolvedValue(undefined);
});
```

No final do `describe`, antes de fechar, adicione:

```ts
it('entrarViaConvite lança ForbiddenException quando janela fechada', async () => {
  inscricaoMock.assertAberta.mockRejectedValueOnce(new ForbiddenException('Inscrições encerradas.'));
  await expect(
    service.entrarViaConvite({ id: 'u1', role: 'USER' }, 'token-valido'),
  ).rejects.toThrow(ForbiddenException);
});

it('entrarViaConvite passa quando admin', async () => {
  prismaMock.bolaoConvite.findUnique.mockResolvedValue({ bolaoId: 'b1', expiraEm: null });
  prismaMock.bolao.findUnique.mockResolvedValue({ id: 'b1', maxParticipantes: 10 });
  prismaMock.bolaoMembro.count.mockResolvedValue(0);
  prismaMock.bolaoMembro.create.mockResolvedValue({});
  prismaMock.ranking.create.mockResolvedValue({});
  await service.entrarViaConvite({ id: 'admin-1', role: 'ADMIN' }, 'token-valido');
  expect(inscricaoMock.assertAberta).toHaveBeenCalledWith({ id: 'admin-1', role: 'ADMIN' });
});

it('aprovarMembro lança ForbiddenException quando janela fechada', async () => {
  inscricaoMock.assertAberta.mockRejectedValueOnce(new ForbiddenException('Inscrições encerradas.'));
  await expect(
    service.aprovarMembro({ id: 'mod-1', role: 'USER' }, 'b1', 'u1'),
  ).rejects.toThrow(ForbiddenException);
});
```

Não esqueça de adicionar `import { ForbiddenException } from '@nestjs/common';` se ainda não existir (já existe na linha 4).

- [ ] **Step 2: Rodar testes para confirmar falha**

```bash
pnpm --filter @bolao/backend test -- bolao.service.spec.ts
```

Esperado: FAIL nos casos novos e talvez nos casos existentes que chamam `entrarViaConvite('user-1', ...)` com assinatura antiga.

Ajuste o teste existente `'entrarViaConvite lança BadRequestException se convite expirado'`:

```ts
it('entrarViaConvite lança BadRequestException se convite expirado', async () => {
  prismaMock.bolaoConvite.findUnique.mockResolvedValue({
    bolaoId: 'b1',
    expiraEm: new Date(Date.now() - 1000),
  });
  await expect(
    service.entrarViaConvite({ id: 'user-1', role: 'USER' }, 'token-expirado'),
  ).rejects.toThrow(BadRequestException);
});
```

- [ ] **Step 3: Atualizar `BolaoService`**

Em `apps/backend/src/bolao/bolao.service.ts`, atualize imports:

```ts
import { InscricaoWindowService } from '../inscricao-window/inscricao-window.service';
```

Constructor:

```ts
constructor(
  private prisma: PrismaService,
  private inscricaoWindow: InscricaoWindowService,
) {}
```

Substitua `entrarViaConvite`:

```ts
async entrarViaConvite(user: { id: string; role: string }, token: string) {
  await this.inscricaoWindow.assertAberta(user);
  const convite = await this.prisma.bolaoConvite.findUnique({ where: { token } });
  if (!convite) throw new BadRequestException('Convite inválido.');
  if (convite.expiraEm && convite.expiraEm < new Date()) {
    throw new BadRequestException('Convite expirado.');
  }
  return this.adicionarMembro(convite.bolaoId, user.id);
}
```

Substitua `aprovarMembro`:

```ts
async aprovarMembro(user: { id: string; role: string }, bolaoId: string, usuarioId: string) {
  await this.inscricaoWindow.assertAberta(user);
  return this.adicionarMembro(bolaoId, usuarioId);
}
```

Promova `adicionarMembro` a `public`:

```ts
async adicionarMembro(bolaoId: string, usuarioId: string) {
  // corpo inalterado
}
```

- [ ] **Step 4: Atualizar `BolaoController`**

Em `apps/backend/src/bolao/bolao.controller.ts`, atualize as rotas:

```ts
@Post('entrar/:token')
entrarViaConvite(@CurrentUser() user: { id: string; role: string }, @Param('token') token: string) {
  return this.service.entrarViaConvite(user, token);
}
```

E:

```ts
@UseGuards(BolaoModeradorGuard)
@Post(':bolaoId/aprovar/:usuarioId')
aprovar(
  @CurrentUser() user: { id: string; role: string },
  @Param('bolaoId') bolaoId: string,
  @Param('usuarioId') usuarioId: string,
) {
  return this.service.aprovarMembro(user, bolaoId, usuarioId);
}
```

- [ ] **Step 5: Atualizar `BolaoModule`**

Em `apps/backend/src/bolao/bolao.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { BolaoController, ConvitePublicoController } from './bolao.controller';
import { BolaoService } from './bolao.service';
import { ApostaModule } from '../aposta/aposta.module';
import { InscricaoWindowModule } from '../inscricao-window/inscricao-window.module';

@Module({
  imports: [ApostaModule, InscricaoWindowModule],
  controllers: [BolaoController, ConvitePublicoController],
  providers: [BolaoService],
  exports: [BolaoService],
})
export class BolaoModule {}
```

- [ ] **Step 6: Rodar testes e verificar verde**

```bash
pnpm --filter @bolao/backend test -- bolao.service.spec.ts
```

Esperado: PASS em todos.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/bolao
git commit -m "feat(backend): bloqueia entrada em bolão fora da janela"
```

---

## Task 7: `POST /admin/usuarios` (criar usuário + opcional bolão)

**Files:**
- Create: `apps/backend/src/admin/dto/create-usuario-admin.dto.ts`
- Modify: `apps/backend/src/admin/admin.service.ts`
- Modify: `apps/backend/src/admin/admin.controller.ts`
- Modify: `apps/backend/src/admin/admin.module.ts`
- Modify: `apps/backend/src/admin/admin.service.spec.ts`

- [ ] **Step 1: Criar o DTO**

`apps/backend/src/admin/dto/create-usuario-admin.dto.ts`:

```ts
import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateUsuarioAdminDto {
  @IsString() @MinLength(2) @MaxLength(60)
  nome: string;

  @IsEmail()
  email: string;

  @IsString() @MinLength(8)
  senhaTemp: string;

  @IsOptional() @IsUUID()
  bolaoId?: string;
}
```

- [ ] **Step 2: Escrever testes falhando**

Em `apps/backend/src/admin/admin.service.spec.ts`, atualize:

1. Adicione imports no topo:

```ts
import { BolaoService } from '../bolao/bolao.service';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const bolaoServiceMock = { adicionarMembro: jest.fn() };
```

2. Estenda o `prismaMock` para incluir os métodos usados em `criarUsuario`:

```ts
const prismaMock = {
  bolao: { findUnique: jest.fn(), findMany: jest.fn() },
  ranking: { findMany: jest.fn(), create: jest.fn() },
  publicacao: { findFirst: jest.fn() },
  rankingSnapshot: { findMany: jest.fn() },
  usuario: { findMany: jest.fn(), update: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  bolaoMembro: { create: jest.fn(), findUnique: jest.fn() },
};
```

3. Inclua `{ provide: BolaoService, useValue: bolaoServiceMock }` nos providers do `Test.createTestingModule`.

4. Adicione testes:

```ts
describe('criarUsuario', () => {
  beforeEach(() => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    prismaMock.usuario.create.mockResolvedValue({ id: 'novo-1', nome: 'X', email: 'x@x.com' });
    prismaMock.bolaoMembro.create.mockResolvedValue({});
    prismaMock.ranking.create.mockResolvedValue({});
    bolaoServiceMock.adicionarMembro.mockResolvedValue({});
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hash' as never);
  });

  it('cria usuário com emailVerificado=true e entra no bolão global', async () => {
    await service.criarUsuario({ nome: 'X', email: 'x@x.com', senhaTemp: '12345678' });
    expect(prismaMock.usuario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ nome: 'X', email: 'x@x.com', emailVerificado: true, senhaHash: 'hash' }),
    });
    expect(prismaMock.bolaoMembro.create).toHaveBeenCalledWith({
      data: { bolaoId: '00000000-0000-0000-0000-000000000001', usuarioId: 'novo-1' },
    });
  });

  it('lança ConflictException se e-mail já existe', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 'existe' });
    await expect(
      service.criarUsuario({ nome: 'X', email: 'x@x.com', senhaTemp: '12345678' }),
    ).rejects.toThrow(ConflictException);
    expect(prismaMock.usuario.create).not.toHaveBeenCalled();
  });

  it('com bolaoId, chama adicionarMembro para o bolão extra', async () => {
    await service.criarUsuario({
      nome: 'X', email: 'x@x.com', senhaTemp: '12345678', bolaoId: 'bolao-extra',
    });
    expect(bolaoServiceMock.adicionarMembro).toHaveBeenCalledWith('bolao-extra', 'novo-1');
  });

  it('com bolaoId igual ao global, NÃO chama adicionarMembro (evita duplicação)', async () => {
    await service.criarUsuario({
      nome: 'X', email: 'x@x.com', senhaTemp: '12345678',
      bolaoId: '00000000-0000-0000-0000-000000000001',
    });
    expect(bolaoServiceMock.adicionarMembro).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Rodar teste para confirmar falha**

```bash
pnpm --filter @bolao/backend test -- admin.service.spec.ts
```

Esperado: FAIL (criarUsuario não existe).

- [ ] **Step 4: Implementar service**

Em `apps/backend/src/admin/admin.service.ts`, atualize imports:

```ts
import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RankingService } from '../ranking/ranking.service';
import { PublicacaoService } from '../publicacao/publicacao.service';
import { BolaoService } from '../bolao/bolao.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CreateUsuarioAdminDto } from './dto/create-usuario-admin.dto';
import { BOLAO_GLOBAL_ID } from '@bolao/shared';
```

Atualize o constructor para incluir `BolaoService`:

```ts
constructor(
  private prisma: PrismaService,
  private ranking: RankingService,
  private publicacao: PublicacaoService,
  private bolao: BolaoService,
  private jwt: JwtService,
  private config: ConfigService,
  @Inject('MAILER') private mailer: any,
) {}
```

Adicione o método `criarUsuario` (logo após `resetarSenha`):

```ts
async criarUsuario(dto: CreateUsuarioAdminDto) {
  const existe = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
  if (existe) throw new ConflictException('E-mail já cadastrado.');

  const senhaHash = await bcrypt.hash(dto.senhaTemp, 12);
  const usuario = await this.prisma.usuario.create({
    data: {
      nome: dto.nome,
      email: dto.email,
      senhaHash,
      emailVerificado: true,
    },
  });

  await this.prisma.bolaoMembro.create({
    data: { bolaoId: BOLAO_GLOBAL_ID, usuarioId: usuario.id },
  });
  await this.prisma.ranking.create({
    data: { bolaoId: BOLAO_GLOBAL_ID, usuarioId: usuario.id },
  });

  if (dto.bolaoId && dto.bolaoId !== BOLAO_GLOBAL_ID) {
    await this.bolao.adicionarMembro(dto.bolaoId, usuario.id);
  }

  return { id: usuario.id, nome: usuario.nome, email: usuario.email };
}
```

- [ ] **Step 5: Adicionar endpoint no controller**

Em `apps/backend/src/admin/admin.controller.ts`, atualize imports:

```ts
import { CreateUsuarioAdminDto } from './dto/create-usuario-admin.dto';
```

Adicione (no final da classe):

```ts
@Post('usuarios')
criarUsuario(@Body() dto: CreateUsuarioAdminDto) {
  return this.service.criarUsuario(dto);
}
```

- [ ] **Step 6: Importar BolaoModule em AdminModule**

`apps/backend/src/admin/admin.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { RankingModule } from '../ranking/ranking.module';
import { MailerModule } from '../mailer/mailer.module';
import { PublicacaoModule } from '../publicacao/publicacao.module';
import { BolaoModule } from '../bolao/bolao.module';

@Module({
  imports: [RankingModule, JwtModule, MailerModule, PublicacaoModule, BolaoModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
```

- [ ] **Step 7: Rodar teste e verificar verde**

```bash
pnpm --filter @bolao/backend test -- admin.service.spec.ts
```

Esperado: PASS (incluindo os 4 casos novos de `criarUsuario`).

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/admin
git commit -m "feat(backend): POST /admin/usuarios (criar usuário + opcional bolão)"
```

---

## Task 8: `POST /admin/boloes/:bolaoId/membros` (admin adiciona usuário existente)

**Files:**
- Modify: `apps/backend/src/admin/admin.controller.ts`
- Modify: `apps/backend/src/admin/admin.service.ts`
- Modify: `apps/backend/src/admin/admin.service.spec.ts`

- [ ] **Step 1: Escrever testes falhando**

Em `apps/backend/src/admin/admin.service.spec.ts`, no fim do `describe('AdminService')`, adicione:

```ts
describe('adicionarUsuarioBolao', () => {
  beforeEach(() => {
    prismaMock.usuario.findUnique.mockReset();
    prismaMock.bolaoMembro.findUnique = jest.fn();
    bolaoServiceMock.adicionarMembro.mockClear();
  });

  it('lança NotFoundException se usuário não existe', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    await expect(
      service.adicionarUsuarioBolao('b1', 'u-fantasma'),
    ).rejects.toThrow(NotFoundException);
  });

  it('lança ConflictException se já é membro', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 'u1', ativo: true });
    prismaMock.bolaoMembro.findUnique.mockResolvedValue({ bolaoId: 'b1', usuarioId: 'u1' });
    await expect(
      service.adicionarUsuarioBolao('b1', 'u1'),
    ).rejects.toThrow(ConflictException);
  });

  it('chama bolao.adicionarMembro quando válido', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 'u1', ativo: true });
    prismaMock.bolaoMembro.findUnique.mockResolvedValue(null);
    bolaoServiceMock.adicionarMembro.mockResolvedValue({});
    await service.adicionarUsuarioBolao('b1', 'u1');
    expect(bolaoServiceMock.adicionarMembro).toHaveBeenCalledWith('b1', 'u1');
  });
});
```

Confira que `NotFoundException` está nos imports do spec (deve já estar no `from '@nestjs/common'`).

- [ ] **Step 2: Rodar teste para confirmar falha**

```bash
pnpm --filter @bolao/backend test -- admin.service.spec.ts
```

Esperado: FAIL (método não existe).

- [ ] **Step 3: Implementar método**

Em `apps/backend/src/admin/admin.service.ts`, adicione após `criarUsuario`:

```ts
async adicionarUsuarioBolao(bolaoId: string, usuarioId: string) {
  const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) throw new NotFoundException('Usuário não encontrado.');

  const membro = await this.prisma.bolaoMembro.findUnique({
    where: { bolaoId_usuarioId: { bolaoId, usuarioId } },
  });
  if (membro) throw new ConflictException('Usuário já é membro deste bolão.');

  await this.bolao.adicionarMembro(bolaoId, usuarioId);
  return { message: 'Usuário adicionado ao bolão.' };
}
```

- [ ] **Step 4: Adicionar endpoint no controller**

Em `apps/backend/src/admin/admin.controller.ts`, adicione:

```ts
@Post('boloes/:bolaoId/membros')
adicionarUsuarioBolao(
  @Param('bolaoId') bolaoId: string,
  @Body('usuarioId') usuarioId: string,
) {
  return this.service.adicionarUsuarioBolao(bolaoId, usuarioId);
}
```

- [ ] **Step 5: Rodar teste e verificar verde**

```bash
pnpm --filter @bolao/backend test -- admin.service.spec.ts
```

Esperado: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/admin
git commit -m "feat(backend): POST /admin/boloes/:bolaoId/membros (admin adiciona usuário existente)"
```

---

## Task 9: Hook `useInscricaoStatus` + teste

**Files:**
- Create: `apps/frontend/src/hooks/useInscricaoStatus.ts`
- Create: `apps/frontend/src/__tests__/useInscricaoStatus.test.ts`

- [ ] **Step 1: Escrever teste falhando**

`apps/frontend/src/__tests__/useInscricaoStatus.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react';
import { useInscricaoStatus } from '@/hooks/useInscricaoStatus';

const fetchMock = jest.fn();
global.fetch = fetchMock as any;

beforeEach(() => {
  fetchMock.mockReset();
  sessionStorage.clear();
});

it('retorna abertas=true enquanto carrega', () => {
  fetchMock.mockReturnValue(new Promise(() => {})); // never resolves
  const { result } = renderHook(() => useInscricaoStatus());
  expect(result.current.abertas).toBe(true);
  expect(result.current.loading).toBe(true);
});

it('atualiza para abertas=false quando API retorna false', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ abertas: false, dataCorte: '2026-06-11T18:00:00.000Z' }),
  });
  const { result } = renderHook(() => useInscricaoStatus());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.abertas).toBe(false);
});

it('lê do sessionStorage quando entrada ainda é válida', async () => {
  sessionStorage.setItem(
    'inscricao-status',
    JSON.stringify({ value: { abertas: false, dataCorte: null }, expiresAt: Date.now() + 30_000 }),
  );
  const { result } = renderHook(() => useInscricaoStatus());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.abertas).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('faz fetch quando entrada do sessionStorage expirou', async () => {
  sessionStorage.setItem(
    'inscricao-status',
    JSON.stringify({ value: { abertas: false, dataCorte: null }, expiresAt: Date.now() - 1_000 }),
  );
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ abertas: true, dataCorte: null }),
  });
  const { result } = renderHook(() => useInscricaoStatus());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.abertas).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Rodar teste para confirmar falha**

```bash
pnpm --filter @bolao/frontend test -- useInscricaoStatus.test.ts
```

Esperado: FAIL (hook não existe).

- [ ] **Step 3: Implementar hook**

`apps/frontend/src/hooks/useInscricaoStatus.ts`:

```ts
'use client';

import { useEffect, useState } from 'react';

const TTL_MS = 60_000;
const KEY = 'inscricao-status';
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface CachedStatus {
  value: { abertas: boolean; dataCorte: string | null };
  expiresAt: number;
}

function readCache(): CachedStatus['value'] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedStatus;
    if (parsed.expiresAt > Date.now()) return parsed.value;
    return null;
  } catch {
    return null;
  }
}

function writeCache(value: CachedStatus['value']) {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({ value, expiresAt: Date.now() + TTL_MS } satisfies CachedStatus),
  );
}

export function useInscricaoStatus() {
  const [state, setState] = useState<{ abertas: boolean; loading: boolean }>(() => {
    const cached = readCache();
    if (cached) return { abertas: cached.abertas, loading: false };
    return { abertas: true, loading: true };
  });

  useEffect(() => {
    if (!state.loading) return;
    let cancelled = false;
    fetch(`${BASE}/auth/inscricoes/status`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { abertas: boolean; dataCorte: string | null }) => {
        if (cancelled) return;
        writeCache(data);
        setState({ abertas: data.abertas, loading: false });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ abertas: true, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [state.loading]);

  return state;
}
```

- [ ] **Step 4: Rodar teste e verificar verde**

```bash
pnpm --filter @bolao/frontend test -- useInscricaoStatus.test.ts
```

Esperado: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/hooks apps/frontend/src/__tests__/useInscricaoStatus.test.ts
git commit -m "feat(frontend): hook useInscricaoStatus com cache sessionStorage"
```

---

## Task 10: `/login` — desabilitar "Criar conta" + banner de erro

**Files:**
- Modify: `apps/frontend/src/app/(auth)/login/page.tsx`
- Modify: `apps/frontend/src/__tests__/LoginPage.test.tsx`

- [ ] **Step 1: Escrever teste falhando**

Em `apps/frontend/src/__tests__/LoginPage.test.tsx`, adicione no topo mock do hook (logo após o `jest.mock('@/components/AuthProvider', ...)`):

```ts
jest.mock('@/hooks/useInscricaoStatus', () => ({
  useInscricaoStatus: jest.fn(),
}));
import { useInscricaoStatus } from '@/hooks/useInscricaoStatus';
const mockUseInscricao = useInscricaoStatus as jest.Mock;
```

Atualize `beforeEach` para resetar o mock e fixar default `abertas=true`:

```ts
beforeEach(() => {
  mockPush.mockClear();
  mockGetParam.mockImplementation((key: string) => {
    if (key === 'redirect') return null;
    if (key === 'emailConfirmado') return null;
    if (key === 'erro') return null;
    return null;
  });
  mockUseInscricao.mockReturnValue({ abertas: true, loading: false });
});
```

Adicione no final do arquivo:

```ts
it('exibe link "Criar conta" como link ativo quando inscrições abertas', () => {
  render(<LoginPage />);
  const link = screen.getByText('Criar conta');
  expect(link.closest('a')).toHaveAttribute('href', '/registrar');
});

it('exibe "Cadastros encerrados" desabilitado quando inscrições fechadas', () => {
  mockUseInscricao.mockReturnValue({ abertas: false, loading: false });
  render(<LoginPage />);
  expect(screen.getByText('Cadastros encerrados')).toBeInTheDocument();
  expect(screen.queryByText('Criar conta')).not.toBeInTheDocument();
});

it('exibe banner de erro quando ?erro=cadastros-encerrados', () => {
  mockGetParam.mockImplementation((key: string) => {
    if (key === 'erro') return 'cadastros-encerrados';
    return null;
  });
  render(<LoginPage />);
  expect(
    screen.getByText(/cadastros encerrados a 2h do início da copa/i),
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar teste para confirmar falha**

```bash
pnpm --filter @bolao/frontend test -- LoginPage.test.tsx
```

Esperado: FAIL nos 3 casos novos (e talvez 1 antigo se o mock atrapalhar).

- [ ] **Step 3: Atualizar a página de login**

`apps/frontend/src/app/(auth)/login/page.tsx` — adicione import e ajuste o JSX. Substitua o conteúdo inteiro do arquivo:

```tsx
'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useInscricaoStatus } from '@/hooks/useInscricaoStatus';

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/jogos';
  const emailConfirmado = searchParams.get('emailConfirmado');
  const erroQuery = searchParams.get('erro');
  const { abertas } = useInscricaoStatus();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      await login(email, senha);
      router.push(redirect);
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm bg-gray-900 rounded-xl p-8 space-y-6">
        <h1 className="text-2xl font-bold text-center text-yellow-400">⚡ Bolão Trovão</h1>
        {erroQuery === 'cadastros-encerrados' && (
          <p className="text-red-400 text-sm text-center">
            Cadastros encerrados a 2h do início da Copa. Procure o administrador para se cadastrar.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && <p className="text-red-400 text-sm text-center">{erro}</p>}
          {emailConfirmado && (
            <p className="text-green-400 text-sm text-center">
              E-mail verificado com sucesso! Faça login para continuar.
            </p>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1">E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-yellow-400 text-gray-900 font-bold py-2 rounded-lg hover:bg-yellow-300 disabled:opacity-50">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <div className="text-center space-y-2 text-sm text-gray-400">
          <Link href="/esqueceu-senha" className="hover:text-white block">Esqueceu a senha?</Link>
          {abertas ? (
            <Link href="/registrar" className="hover:text-white block">Criar conta</Link>
          ) : (
            <span className="block text-gray-600 cursor-not-allowed">Cadastros encerrados</span>
          )}
          <a href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/google`}
            className="block bg-gray-800 border border-gray-700 rounded-lg py-2 hover:bg-gray-700 text-center">
            Entrar com Google
          </a>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
```

- [ ] **Step 4: Rodar testes e verificar verde**

```bash
pnpm --filter @bolao/frontend test -- LoginPage.test.tsx
```

Esperado: PASS (5 casos no total).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/app/(auth)/login apps/frontend/src/__tests__/LoginPage.test.tsx
git commit -m "feat(frontend): login desabilita 'Criar conta' fora da janela"
```

---

## Task 11: `/registrar` — bloquear quando janela fechada + teste

**Files:**
- Modify: `apps/frontend/src/app/(auth)/registrar/page.tsx`
- Create: `apps/frontend/src/__tests__/RegistrarPage.test.tsx`

- [ ] **Step 1: Escrever teste falhando**

`apps/frontend/src/__tests__/RegistrarPage.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';
import RegistrarPage from '@/app/(auth)/registrar/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/hooks/useInscricaoStatus', () => ({
  useInscricaoStatus: jest.fn(),
}));
import { useInscricaoStatus } from '@/hooks/useInscricaoStatus';
const mockUseInscricao = useInscricaoStatus as jest.Mock;

beforeEach(() => {
  mockUseInscricao.mockReturnValue({ abertas: true, loading: false });
});

it('renderiza formulário quando inscrições abertas', () => {
  render(<RegistrarPage />);
  expect(screen.getByRole('button', { name: /cadastrar/i })).toBeInTheDocument();
});

it('renderiza mensagem de encerrado quando inscrições fechadas', () => {
  mockUseInscricao.mockReturnValue({ abertas: false, loading: false });
  render(<RegistrarPage />);
  expect(
    screen.getByText(/cadastros encerrados a 2h do início da copa/i),
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /cadastrar/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar teste para confirmar falha**

```bash
pnpm --filter @bolao/frontend test -- RegistrarPage.test.tsx
```

Esperado: FAIL no segundo caso (página ignora o status).

- [ ] **Step 3: Atualizar a página**

`apps/frontend/src/app/(auth)/registrar/page.tsx` — substitua o conteúdo:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useInscricaoStatus } from '@/hooks/useInscricaoStatus';

export default function RegistrarPage() {
  const router = useRouter();
  const { abertas } = useInscricaoStatus();
  const [form, setForm] = useState({ nome: '', email: '', senha: '' });
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const data = await api.post<{ message: string }>('/auth/registrar', form);
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
          {(['nome', 'email', 'senha'] as const).map(f => (
            <div key={f}>
              <label className="block text-sm text-gray-400 mb-1 capitalize">{f}</label>
              <input type={f === 'senha' ? 'password' : f === 'email' ? 'email' : 'text'}
                value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
            </div>
          ))}
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

- [ ] **Step 4: Rodar teste e verificar verde**

```bash
pnpm --filter @bolao/frontend test -- RegistrarPage.test.tsx
```

Esperado: PASS (2 casos).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/app/(auth)/registrar apps/frontend/src/__tests__/RegistrarPage.test.tsx
git commit -m "feat(frontend): registrar bloqueia tela quando janela fechada"
```

---

## Task 12: Componente `AdminCriarUsuarioDialog` + integração na página

**Files:**
- Create: `apps/frontend/src/components/AdminCriarUsuarioDialog.tsx`
- Create: `apps/frontend/src/__tests__/AdminCriarUsuarioDialog.test.tsx`
- Modify: `apps/frontend/src/app/admin/usuarios/page.tsx`

- [ ] **Step 1: Escrever teste falhando**

`apps/frontend/src/__tests__/AdminCriarUsuarioDialog.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminCriarUsuarioDialog } from '@/components/AdminCriarUsuarioDialog';

jest.mock('@/lib/api', () => ({
  api: {
    post: jest.fn().mockResolvedValue({ id: 'novo-1', nome: 'X', email: 'x@x.com' }),
    get: jest.fn().mockResolvedValue([]),
  },
}));
import { api } from '@/lib/api';
const mockPost = api.post as jest.Mock;

beforeEach(() => mockPost.mockClear());

it('submete POST /admin/usuarios com nome, email e senhaTemp', async () => {
  const onCriado = jest.fn();
  render(<AdminCriarUsuarioDialog open onOpenChange={jest.fn()} onCriado={onCriado} />);

  fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Alice' } });
  fireEvent.change(screen.getByLabelText(/^e-mail$/i), { target: { value: 'a@a.com' } });
  fireEvent.change(screen.getByLabelText(/senha tempor/i), { target: { value: 'senha12345' } });

  fireEvent.click(screen.getByRole('button', { name: /criar/i }));

  await waitFor(() => {
    expect(mockPost).toHaveBeenCalledWith('/admin/usuarios', {
      nome: 'Alice',
      email: 'a@a.com',
      senhaTemp: 'senha12345',
    });
    expect(onCriado).toHaveBeenCalled();
  });
});

it('exibe erro quando POST falha', async () => {
  mockPost.mockRejectedValueOnce(new Error('E-mail já cadastrado.'));
  render(<AdminCriarUsuarioDialog open onOpenChange={jest.fn()} onCriado={jest.fn()} />);

  fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Alice' } });
  fireEvent.change(screen.getByLabelText(/^e-mail$/i), { target: { value: 'a@a.com' } });
  fireEvent.change(screen.getByLabelText(/senha tempor/i), { target: { value: 'senha12345' } });

  fireEvent.click(screen.getByRole('button', { name: /criar/i }));

  await waitFor(() => {
    expect(screen.getByText('E-mail já cadastrado.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar teste para confirmar falha**

```bash
pnpm --filter @bolao/frontend test -- AdminCriarUsuarioDialog.test.tsx
```

Esperado: FAIL (componente não existe).

- [ ] **Step 3: Implementar componente**

`apps/frontend/src/components/AdminCriarUsuarioDialog.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';

interface BolaoOpcao { id: string; nome: string; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriado: () => void;
}

export function AdminCriarUsuarioDialog({ open, onOpenChange, onCriado }: Props) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senhaTemp, setSenhaTemp] = useState('');
  const [buscaBolao, setBuscaBolao] = useState('');
  const [opcoes, setOpcoes] = useState<BolaoOpcao[]>([]);
  const [bolaoId, setBolaoId] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!buscaBolao.trim() || bolaoId) {
      setOpcoes([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      api.get<BolaoOpcao[]>(`/boloes/buscar?nome=${encodeURIComponent(buscaBolao)}`)
        .then((res) => { if (!cancelled) setOpcoes(res); })
        .catch(() => { if (!cancelled) setOpcoes([]); });
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [buscaBolao, bolaoId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const payload: Record<string, string> = { nome, email, senhaTemp };
      if (bolaoId) payload.bolaoId = bolaoId;
      await api.post('/admin/usuarios', payload);
      onCriado();
      onOpenChange(false);
      setNome(''); setEmail(''); setSenhaTemp(''); setBuscaBolao(''); setBolaoId(null);
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao criar usuário.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {erro && <p className="text-trovao-red text-sm">{erro}</p>}
          <label className="block text-sm">
            Nome
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required minLength={2}
              className="w-full mt-1 bg-trovao-surface border border-trovao-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-trovao-gold"
            />
          </label>
          <label className="block text-sm">
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full mt-1 bg-trovao-surface border border-trovao-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-trovao-gold"
            />
          </label>
          <label className="block text-sm">
            Senha temporária
            <input
              type="text"
              value={senhaTemp}
              onChange={(e) => setSenhaTemp(e.target.value)}
              required minLength={8}
              className="w-full mt-1 bg-trovao-surface border border-trovao-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-trovao-gold"
            />
          </label>
          <div className="text-sm">
            <label className="block">Adicionar também a um bolão (opcional)</label>
            {bolaoId ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-white">{opcoes.find((o) => o.id === bolaoId)?.nome ?? 'Bolão selecionado'}</span>
                <button type="button" className="text-trovao-muted text-xs" onClick={() => { setBolaoId(null); setBuscaBolao(''); }}>
                  Trocar
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={buscaBolao}
                  onChange={(e) => setBuscaBolao(e.target.value)}
                  placeholder="Buscar por nome"
                  className="w-full mt-1 bg-trovao-surface border border-trovao-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-trovao-gold"
                />
                {opcoes.length > 0 && (
                  <ul className="mt-1 border border-trovao-border rounded-lg bg-trovao-card max-h-40 overflow-auto">
                    {opcoes.map((o) => (
                      <li key={o.id}>
                        <button type="button" onClick={() => setBolaoId(o.id)}
                          className="w-full text-left px-3 py-2 hover:bg-trovao-surface text-white">
                          {o.nome}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => onOpenChange(false)}
              className="text-sm px-3 py-2 rounded-lg border border-trovao-border text-trovao-muted hover:text-white">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="text-sm px-3 py-2 rounded-lg bg-trovao-gold text-trovao-bg font-semibold hover:bg-yellow-300 disabled:opacity-50">
              {loading ? 'Criando...' : 'Criar'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Integrar na página de usuários**

Em `apps/frontend/src/app/admin/usuarios/page.tsx`, atualize imports e adicione estado + botão. Substitua o arquivo inteiro:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { AdminUsuarioRow } from '@/components/AdminUsuarioRow';
import { AdminCriarUsuarioDialog } from '@/components/AdminCriarUsuarioDialog';
import { PageSkeleton } from '@/components/PageSkeleton';
import type { Usuario } from '@/types/api';

function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState('');
  const [criarOpen, setCriarOpen] = useState(false);

  async function carregar() {
    setLoading(true);
    const data = await api.get<Usuario[]>('/admin/usuarios').catch(() => [] as Usuario[]);
    setUsuarios(data);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  const filtrados = useMemo(() => {
    const q = normalizar(query.trim());
    if (!q) return usuarios;
    return usuarios.filter(
      (u) => normalizar(u.nome).includes(q) || normalizar(u.email).includes(q),
    );
  }, [usuarios, query]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Usuários</h1>
        <button
          onClick={() => setCriarOpen(true)}
          className="text-sm px-3 py-2 rounded-lg bg-trovao-gold text-trovao-bg font-semibold hover:bg-yellow-300"
        >
          + Novo usuário
        </button>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou email"
            className="w-full bg-trovao-card border border-trovao-border rounded-xl
                       pl-9 pr-9 py-2 text-sm text-white placeholder:text-trovao-muted
                       focus:outline-none focus:border-trovao-gold"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-trovao-muted pointer-events-none"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 text-trovao-muted hover:text-white"
            >×</button>
          )}
        </div>
        {query && (
          <p className="text-trovao-muted text-xs">{filtrados.length} de {usuarios.length} usuários</p>
        )}
      </div>

      {loading ? (
        <PageSkeleton />
      ) : query && filtrados.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <p className="text-trovao-muted text-sm">Nenhum usuário corresponde à busca.</p>
          <button onClick={() => setQuery('')} className="text-trovao-gold text-xs font-semibold">Limpar</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((u) => (
            <AdminUsuarioRow key={u.id} usuario={u} onAtualizado={carregar} />
          ))}
        </div>
      )}

      <AdminCriarUsuarioDialog
        open={criarOpen}
        onOpenChange={setCriarOpen}
        onCriado={carregar}
      />
    </div>
  );
}
```

- [ ] **Step 5: Rodar testes e verificar verde**

```bash
pnpm --filter @bolao/frontend test -- AdminCriarUsuarioDialog.test.tsx
```

Esperado: PASS (2 casos).

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/components/AdminCriarUsuarioDialog.tsx apps/frontend/src/__tests__/AdminCriarUsuarioDialog.test.tsx apps/frontend/src/app/admin/usuarios/page.tsx
git commit -m "feat(frontend): admin/usuarios — modal 'Novo usuário' com bolão opcional"
```

---

## Task 13: Componente `AdminAdicionarBolaoDialog` + botão por linha

**Files:**
- Create: `apps/frontend/src/components/AdminAdicionarBolaoDialog.tsx`
- Create: `apps/frontend/src/__tests__/AdminAdicionarBolaoDialog.test.tsx`
- Modify: `apps/frontend/src/components/AdminUsuarioRow.tsx`

- [ ] **Step 1: Escrever teste falhando**

`apps/frontend/src/__tests__/AdminAdicionarBolaoDialog.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminAdicionarBolaoDialog } from '@/components/AdminAdicionarBolaoDialog';

jest.mock('@/lib/api', () => ({
  api: {
    post: jest.fn().mockResolvedValue({ message: 'Usuário adicionado ao bolão.' }),
    get: jest.fn().mockResolvedValue([{ id: 'b1', nome: 'Liga Trovão' }]),
  },
}));
import { api } from '@/lib/api';
const mockPost = api.post as jest.Mock;
const mockGet = api.get as jest.Mock;

beforeEach(() => {
  mockPost.mockClear();
  mockGet.mockClear();
});

it('submete POST /admin/boloes/:id/membros após selecionar bolão', async () => {
  render(<AdminAdicionarBolaoDialog open usuarioId="u1" onOpenChange={jest.fn()} />);

  fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'Liga' } });
  await waitFor(() => expect(screen.getByText('Liga Trovão')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Liga Trovão'));

  fireEvent.click(screen.getByRole('button', { name: /adicionar/i }));

  await waitFor(() => {
    expect(mockPost).toHaveBeenCalledWith('/admin/boloes/b1/membros', { usuarioId: 'u1' });
  });
});
```

- [ ] **Step 2: Rodar teste para confirmar falha**

```bash
pnpm --filter @bolao/frontend test -- AdminAdicionarBolaoDialog.test.tsx
```

Esperado: FAIL (componente não existe).

- [ ] **Step 3: Implementar componente**

`apps/frontend/src/components/AdminAdicionarBolaoDialog.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';

interface BolaoOpcao { id: string; nome: string; }

interface Props {
  open: boolean;
  usuarioId: string;
  onOpenChange: (open: boolean) => void;
}

export function AdminAdicionarBolaoDialog({ open, usuarioId, onOpenChange }: Props) {
  const [busca, setBusca] = useState('');
  const [opcoes, setOpcoes] = useState<BolaoOpcao[]>([]);
  const [bolaoId, setBolaoId] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!busca.trim() || bolaoId) { setOpcoes([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      api.get<BolaoOpcao[]>(`/boloes/buscar?nome=${encodeURIComponent(busca)}`)
        .then((res) => { if (!cancelled) setOpcoes(res); })
        .catch(() => { if (!cancelled) setOpcoes([]); });
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [busca, bolaoId]);

  async function submit() {
    if (!bolaoId) return;
    setErro('');
    setLoading(true);
    try {
      await api.post(`/admin/boloes/${bolaoId}/membros`, { usuarioId });
      onOpenChange(false);
      setBusca(''); setBolaoId(null); setOpcoes([]);
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao adicionar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar a bolão</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {erro && <p className="text-trovao-red text-sm">{erro}</p>}
          {bolaoId ? (
            <div className="flex items-center gap-2">
              <span className="text-white">{opcoes.find((o) => o.id === bolaoId)?.nome ?? 'Bolão selecionado'}</span>
              <button type="button" className="text-trovao-muted text-xs" onClick={() => { setBolaoId(null); setBusca(''); }}>
                Trocar
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome"
                className="w-full bg-trovao-surface border border-trovao-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-trovao-gold"
              />
              {opcoes.length > 0 && (
                <ul className="border border-trovao-border rounded-lg bg-trovao-card max-h-40 overflow-auto">
                  {opcoes.map((o) => (
                    <li key={o.id}>
                      <button type="button" onClick={() => setBolaoId(o.id)}
                        className="w-full text-left px-3 py-2 hover:bg-trovao-surface text-white">
                        {o.nome}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => onOpenChange(false)}
              className="text-sm px-3 py-2 rounded-lg border border-trovao-border text-trovao-muted hover:text-white">
              Cancelar
            </button>
            <button type="button" onClick={submit} disabled={loading || !bolaoId}
              className="text-sm px-3 py-2 rounded-lg bg-trovao-gold text-trovao-bg font-semibold hover:bg-yellow-300 disabled:opacity-50">
              {loading ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Adicionar botão na linha do usuário**

Em `apps/frontend/src/components/AdminUsuarioRow.tsx`, importe o dialog e adicione um botão. Substitua o arquivo:

```tsx
'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { AdminAdicionarBolaoDialog } from '@/components/AdminAdicionarBolaoDialog';
import type { Usuario } from '@/types/api';

interface AdminUsuarioRowProps {
  usuario: Pick<Usuario, 'id' | 'nome' | 'email' | 'role' | 'avatarUrl' | 'ativo'>;
  onAtualizado: () => void;
}

export function AdminUsuarioRow({ usuario, onAtualizado }: AdminUsuarioRowProps) {
  const [atualizando, setAtualizando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [bolaoOpen, setBolaoOpen] = useState(false);
  const ativo = usuario.ativo ?? true;

  async function patch(data: { role?: 'ADMIN' | 'USER'; ativo?: boolean }) {
    setAtualizando(true);
    try {
      await api.patch(`/admin/usuarios/${usuario.id}`, data);
      onAtualizado();
    } finally {
      setAtualizando(false);
    }
  }

  async function resetarSenha() {
    setAtualizando(true);
    setMsg(null);
    try {
      await api.post(`/admin/usuarios/${usuario.id}/reset-senha`);
      setMsg('E-mail de redefinição enviado.');
    } finally {
      setAtualizando(false);
    }
  }

  return (
    <div className="px-4 py-3 bg-trovao-card border border-trovao-border rounded-xl space-y-2">
      <div className="flex items-center gap-3">
        {usuario.avatarUrl ? (
          <img src={usuario.avatarUrl} alt={usuario.nome} className="w-8 h-8 rounded-full flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-trovao-surface flex items-center justify-center text-xs font-bold text-trovao-muted flex-shrink-0">
            {usuario.nome.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{usuario.nome}</p>
          <p className="text-trovao-muted text-xs truncate">{usuario.email}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          usuario.role === 'ADMIN' ? 'bg-trovao-gold/20 text-trovao-gold' : 'bg-trovao-surface text-trovao-muted'
        }`}>
          {usuario.role}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => patch({ role: usuario.role === 'ADMIN' ? 'USER' : 'ADMIN' })}
          disabled={atualizando}
          className="text-xs px-2 py-1 rounded-lg border border-trovao-border text-trovao-muted hover:text-white hover:border-trovao-gold disabled:opacity-50 transition-colors"
        >
          {usuario.role === 'ADMIN' ? 'Remover Admin' : '→ Admin'}
        </button>
        <button
          onClick={() => patch({ ativo: !ativo })}
          disabled={atualizando}
          className={`text-xs px-2 py-1 rounded-lg border disabled:opacity-50 transition-colors ${
            ativo
              ? 'bg-trovao-green/10 text-trovao-green border-trovao-green/40'
              : 'bg-trovao-red/10 text-trovao-red border-trovao-red/40'
          }`}
        >
          {ativo ? 'Ativo' : 'Inativo'}
        </button>
        <button
          onClick={resetarSenha}
          disabled={atualizando}
          className="text-xs px-2 py-1 rounded-lg border border-trovao-border text-trovao-muted hover:text-white hover:border-trovao-gold disabled:opacity-50 transition-colors"
        >
          Reset senha
        </button>
        <button
          onClick={() => setBolaoOpen(true)}
          disabled={atualizando}
          className="text-xs px-2 py-1 rounded-lg border border-trovao-border text-trovao-muted hover:text-white hover:border-trovao-gold disabled:opacity-50 transition-colors"
        >
          + Bolão
        </button>
      </div>

      {msg && <p className="text-trovao-green text-xs">{msg}</p>}

      <AdminAdicionarBolaoDialog
        open={bolaoOpen}
        usuarioId={usuario.id}
        onOpenChange={setBolaoOpen}
      />
    </div>
  );
}
```

- [ ] **Step 5: Rodar testes e verificar verde**

```bash
pnpm --filter @bolao/frontend test -- AdminAdicionarBolaoDialog.test.tsx AdminUsuarioRow.test.tsx
```

Esperado: PASS no novo + PASS no existente (já cobre nome/email e botão admin).

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/components/AdminAdicionarBolaoDialog.tsx apps/frontend/src/__tests__/AdminAdicionarBolaoDialog.test.tsx apps/frontend/src/components/AdminUsuarioRow.tsx
git commit -m "feat(frontend): admin/usuarios — botão 'Adicionar a bolão' por linha"
```

---

## Task 14: E2E — bloqueio + bypass admin

**Files:**
- Create: `e2e/tests/auth/janela-inscricao.api.spec.ts`

- [ ] **Step 1: Escrever spec E2E**

`e2e/tests/auth/janela-inscricao.api.spec.ts`:

```ts
import { test, expect } from '../../fixtures';
import { adminContext } from '../../api/client';
import { prisma, truncateDynamic } from '../../support/db';
import { newUser } from '../../data/factories';

// Garante que o "primeiro jogo" tem dataHora apontando pro futuro distante
// (abre a janela) ou para perto (fecha a janela), conforme o cenário.
async function abrirJanela() {
  await prisma.jogo.updateMany({ data: { dataHora: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
  // Cache do service tem TTL 60s — vamos contornar reiniciando? Não, o E2E roda contra um backend que
  // já consultou. Como o cache é por instância: vamos só esperar a próxima chamada exceder o TTL,
  // OU não confiar no cache: o teste usa um cenário "janela fechada" primeiro e depois aberta para o
  // próximo cenário (corrida com o cache aceita — repetimos a chamada com retry se necessário).
}

async function fecharJanela() {
  // Define o primeiro jogo pra T+30min (corte foi T-90min, agora já passou) — janela fechada
  await prisma.jogo.updateMany({ data: { dataHora: new Date(Date.now() + 30 * 60 * 1000) } });
}

test.describe('Janela de inscrição (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('POST /auth/registrar 403 quando janela fechada', async ({ anonApi }) => {
    await fecharJanela();
    // Espera o TTL do cache (60s) ou aceita drift: força recarregar criando jogos novos.
    // Como o service só faz findFirst orderBy asc, alterar o jogo mais antigo basta.
    // Para evitar flake, esperamos 1s e tentamos.
    await new Promise((r) => setTimeout(r, 1500));

    const u = newUser('janela');
    const res = await anonApi.post('/auth/registrar', { data: { nome: u.nome, email: u.email, senha: u.senha } });
    // O backend pode ter cache de até 60s; tolera tanto 403 (esperado) quanto 201 (cache antigo)
    // mas exigimos pelo menos 1 das chamadas dar 403 no segundo retry após esperar o TTL.
    if (res.status() === 201) {
      // espera o TTL expirar e tenta de novo com outro e-mail
      await new Promise((r) => setTimeout(r, 65_000));
      const u2 = newUser('janela2');
      const res2 = await anonApi.post('/auth/registrar', { data: { nome: u2.nome, email: u2.email, senha: u2.senha } });
      expect(res2.status()).toBe(403);
    } else {
      expect(res.status()).toBe(403);
    }
  });

  test('admin cria usuário via POST /admin/usuarios mesmo com janela fechada', async () => {
    await fecharJanela();
    await new Promise((r) => setTimeout(r, 1500));

    const ctx = await adminContext();
    const u = newUser('admin-cria');
    const res = await ctx.post('/admin/usuarios', { data: { nome: u.nome, email: u.email, senhaTemp: u.senha } });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();

    // Usuário recém-criado autentica imediatamente (emailVerificado=true)
    const login = await ctx.post('/auth/login', { data: { email: u.email, senha: u.senha } });
    expect(login.ok()).toBeTruthy();

    await ctx.dispose();
  });
});
```

> **Nota sobre o cache de 60s:** o E2E precisa esperar o TTL expirar entre cenários para alternar entre "aberta/fechada" no mesmo backend já iniciado. Mantido `setTimeout(65000)` na lógica do primeiro teste como fallback; preferimos cenários independentes que assumem janela fechada desde o boot. Se ficar flaky, adicionar `--workers=1` e `truncateDynamic` antes de cada `test` resolve.

- [ ] **Step 2: Rodar o spec**

```bash
cd e2e && npx playwright test tests/auth/janela-inscricao.api.spec.ts --project=api
```

Esperado: PASS.

- [ ] **Step 3: Voltar diretório raiz e commitar**

```bash
git add e2e/tests/auth/janela-inscricao.api.spec.ts
git commit -m "test(e2e): janela de inscrição (bloqueio + bypass admin)"
```

---

## Task 15: README + checks finais

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Adicionar entrada em "Funcionalidades" do README**

Em `README.md`, na lista de "Funcionalidades" (após a linha de "Painel administrativo"), adicione:

```markdown
- **Janela de inscrição** — cadastros e ingresso em bolões fecham 2h antes do primeiro jogo da Copa. Após esse horário, apenas o admin pode criar contas (em `/admin/usuarios`) e adicionar usuários a bolões.
```

- [ ] **Step 2: Typecheck do backend**

```bash
cd apps/backend && pnpm exec tsc --noEmit
```

Esperado: 0 erros.

- [ ] **Step 3: Lint geral**

```bash
cd ../.. && pnpm lint
```

Esperado: 0 erros.

- [ ] **Step 4: Suíte completa de testes**

```bash
pnpm test
```

Esperado: todos passando.

- [ ] **Step 5: Smoke test manual no dev server**

Em terminais separados:

```bash
pnpm dev
```

Abrir `http://localhost:3000/login` no browser. Verificar:
- Link "Criar conta" aparece (janela aberta por padrão com seed atual).
- Visitar `http://localhost:3000/login?erro=cadastros-encerrados`: banner aparece no topo.
- `http://localhost:3000/admin/usuarios` (logado como admin): botão "+ Novo usuário" abre o dialog; "+ Bolão" por linha abre o outro dialog.

Para testar com janela fechada sem mexer no seed:
```bash
docker exec bolao-trovao-postgres-1 psql -U bolao -d bolao_trovao -c "UPDATE \"jogo\" SET \"dataHora\" = NOW() + INTERVAL '30 minutes' WHERE \"dataHora\" = (SELECT MIN(\"dataHora\") FROM \"jogo\");"
```

Esperar ~65s (TTL do cache) e atualizar `/login` — "Criar conta" vira "Cadastros encerrados". Reverter:
```bash
pnpm db:seed
```

- [ ] **Step 6: Commit final**

```bash
git add README.md
git commit -m "docs: documenta janela de inscrição no README"
```

---

## Self-Review (autor)

**Cobertura da spec:**
- Constante `HORAS_CORTE_INSCRICAO`: Task 1 ✓
- `InscricaoWindowService` + cache 60s + bypass admin: Task 2 ✓
- `GET /auth/inscricoes/status` público: Task 3 ✓
- `assertAberta` em `registrar`: Task 4 ✓
- Google callback bloqueado: Task 5 ✓
- `entrarViaConvite` + `aprovarMembro`: Task 6 ✓
- `POST /admin/usuarios`: Task 7 ✓
- `POST /admin/boloes/:bolaoId/membros`: Task 8 ✓
- `useInscricaoStatus` hook: Task 9 ✓
- `/login` desabilitado + banner: Task 10 ✓
- `/registrar` bloqueado: Task 11 ✓
- Modal "Novo usuário" no admin: Task 12 ✓
- Botão "Adicionar a bolão" por linha: Task 13 ✓
- E2E: Task 14 ✓
- README: Task 15 ✓

**Tipos/assinaturas consistentes:** `entrarViaConvite(user, token)` e `aprovarMembro(user, bolaoId, usuarioId)` — assinatura nova é uniforme. `InscricaoWindowService.assertAberta(user?)` aceita `{ role?: string }` em todas as chamadas. ✓

**Sem placeholders:** todo step tem código completo. ✓
