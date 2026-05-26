# Publicação Global e Ranking com Variação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar publicação global de ranking (evento único que congela os resultados para todos os bolões), com ranking geral + ranking da publicação, variação de posição, gráfico de evolução, e gestão de usuários pelo admin.

**Architecture:** Um modelo `Publicacao` global e sequencial agrupa os jogos encerrados desde a última publicação. Ao publicar, recalcula-se o ranking ao vivo (`Ranking`, que passa a ser o draft do admin) de cada bolão habilitado e grava-se uma foto congelada em `RankingSnapshot` por bolão×usuário, com posição, variação e pontos da rodada. O participante lê sempre o último snapshot; o admin pré-visualiza o draft ao vivo. Usuário desativado é barrado no login.

**Tech Stack:** NestJS + Prisma + PostgreSQL (backend, Jest), Next.js 14 App Router + React + Tailwind + shadcn + Recharts (frontend, Jest/RTL).

**Spec:** [`docs/superpowers/specs/2026-05-26-publicacao-ranking-design.md`](../specs/2026-05-26-publicacao-ranking-design.md)

---

## Mapa de arquivos

| Ação | Caminho | Responsabilidade |
|---|---|---|
| Modificar | `apps/backend/prisma/schema.prisma` | + `Publicacao`, `RankingSnapshot`, `Jogo.publicacaoId`, `Usuario.ativo` |
| Criar | `apps/backend/prisma/migrations/<ts>_publicacao_ranking/migration.sql` | migração da estrutura acima |
| Criar | `apps/backend/src/publicacao/publicacao.service.ts` | lógica de publicar (evento global) |
| Criar | `apps/backend/src/publicacao/publicacao.controller.ts` | `POST /admin/publicacoes` |
| Criar | `apps/backend/src/publicacao/publicacao.module.ts` | wiring NestJS |
| Criar | `apps/backend/src/publicacao/publicacao.service.spec.ts` | testes de publicar |
| Modificar | `apps/backend/src/ranking/ranking.service.ts` | `obterRanking` via snapshot, `recalcularRankingBolao` público, `listarPublicacoes`, `evolucao` |
| Modificar | `apps/backend/src/ranking/ranking.controller.ts` | rotas de snapshot, publicacoes, evolucao |
| Modificar | `apps/backend/src/ranking/ranking.service.spec.ts` | testes de snapshot/evolucao |
| Modificar | `apps/backend/src/admin/admin.service.ts` | draft com variação, listar bolões, user mgmt |
| Modificar | `apps/backend/src/admin/admin.controller.ts` | rotas admin (sem `publicar`, + bolões/usuários) |
| Criar | `apps/backend/src/admin/admin.service.spec.ts` | testes de draft e user mgmt |
| Modificar | `apps/backend/src/admin/admin.module.ts` | injetar `RankingService` |
| Modificar | `apps/backend/src/auth/auth.service.ts` | barrar usuário inativo no login |
| Modificar | `apps/backend/src/auth/auth.service.spec.ts` | teste de login inativo |
| Modificar | `apps/backend/src/app.module.ts` | registrar `PublicacaoModule` |
| Modificar | `apps/frontend/package.json` | + `recharts` |
| Modificar | `apps/frontend/src/types/api.ts` | tipos de snapshot/evolucao/admin |
| Modificar | `apps/frontend/src/app/(app)/ranking/[bolaoId]/page.tsx` | toggle geral/rodada, variação, seletor, gráfico |
| Criar | `apps/frontend/src/components/RankingEvolucao.tsx` | line chart Recharts |
| Modificar | `apps/frontend/src/components/RankingRow.tsx` | exibir variação `posicoesGanhas` |
| Criar | `apps/frontend/src/app/(admin)/layout.tsx` | guard de role + nav admin |
| Criar | `apps/frontend/src/app/(admin)/boloes/page.tsx` | habilitar/desabilitar bolões |
| Criar | `apps/frontend/src/app/(admin)/ranking/page.tsx` | preview + publicar |
| Criar | `apps/frontend/src/app/(admin)/usuarios/page.tsx` | ativo/role/reset-senha |
| Criar | `apps/frontend/src/__tests__/RankingEvolucao.test.tsx` | teste do gráfico |

> Nota sobre `Bolao.status`: reutilizamos o endpoint existente `PATCH /boloes/:bolaoId/status` (já `ADMIN`) para habilitar/desabilitar. Não criamos `PATCH /admin/boloes/...` para evitar duplicação (DRY). O admin só precisa de uma **listagem** de bolões, adicionada em `GET /admin/boloes`.

---

## Task 1: Schema — Publicacao, RankingSnapshot, Jogo.publicacaoId, Usuario.ativo

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/<ts>_publicacao_ranking/migration.sql`

- [ ] **Step 1: Adicionar `ativo` em `Usuario`**

Em `apps/backend/prisma/schema.prisma`, no `model Usuario`, logo após a linha `emailVerificado Boolean @default(false)`, adicionar:

```prisma
  ativo           Boolean   @default(true)
```

E adicionar as relações de publicação e snapshot ao final das relações do `Usuario` (após `configuracoes ConfiguracaoPontuacao[]`):

```prisma
  publicacoes      Publicacao[]
  rankingSnapshots RankingSnapshot[]
```

- [ ] **Step 2: Adicionar `publicacaoId` em `Jogo`**

No `model Jogo`, logo após `pesoPontuacao Int @default(1)`, adicionar:

```prisma
  publicacaoId       String?
  publicacao         Publicacao? @relation(fields: [publicacaoId], references: [id])
```

- [ ] **Step 3: Adicionar os modelos `Publicacao` e `RankingSnapshot`**

No final do arquivo `schema.prisma`, adicionar:

```prisma
model Publicacao {
  id             String   @id @default(uuid())
  numero         Int      @unique
  publicadoEm    DateTime @default(now())
  publicadoPorId String
  publicadoPor   Usuario  @relation(fields: [publicadoPorId], references: [id])

  jogos     Jogo[]
  snapshots RankingSnapshot[]

  @@map("publicacao")
}

model RankingSnapshot {
  id              String     @id @default(uuid())
  publicacaoId    String
  publicacao      Publicacao @relation(fields: [publicacaoId], references: [id])
  bolaoId         String
  usuarioId       String
  usuario         Usuario    @relation(fields: [usuarioId], references: [id])
  posicao         Int
  posicoesGanhas  Int        @default(0)
  pontuacaoTotal  Int        @default(0)
  pontuacaoRodada Int        @default(0)

  acertosPlacarExato    Int @default(0)
  acertosPlacarVencedor Int @default(0)
  acertosPlacarPerdedor Int @default(0)
  acertosEmpate         Int @default(0)
  acertosGanhador       Int @default(0)
  acertosNada           Int @default(0)
  apostasPostadas       Int @default(0)

  @@unique([publicacaoId, bolaoId, usuarioId])
  @@index([bolaoId, usuarioId])
  @@map("ranking_snapshot")
}
```

- [ ] **Step 4: Gerar a migration**

Run: `cd apps/backend && npx prisma migrate dev --name publicacao_ranking`
Expected: cria `prisma/migrations/<ts>_publicacao_ranking/migration.sql`, aplica no banco e regenera o Prisma Client sem erros.

- [ ] **Step 5: Verificar o client gerado**

Run: `cd apps/backend && npx prisma generate`
Expected: sem erros. Os tipos `Publicacao` e `RankingSnapshot` existem; `Jogo` tem `publicacaoId`; `Usuario` tem `ativo`.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations/
git commit -m "feat: schema de publicacao, ranking_snapshot, jogo.publicacaoId e usuario.ativo"
```

---

## Task 2: Auth — barrar usuário inativo no login

**Files:**
- Modify: `apps/backend/src/auth/auth.service.ts:39-51`
- Modify: `apps/backend/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Escrever o teste que falha**

Em `apps/backend/src/auth/auth.service.spec.ts`, localizar o `describe('login'...)` (ou o bloco de testes de login) e adicionar este teste dentro dele. Use o mesmo `prismaMock`/setup já presente no arquivo; o trecho abaixo assume `prismaMock.usuario.findUnique` e `bcrypt.compare` mockado como nos testes existentes:

```typescript
it('barra usuário inativo no login', async () => {
  prismaMock.usuario.findUnique.mockResolvedValue({
    id: 'u1', email: 'a@a.com', senhaHash: 'hash', emailVerificado: true,
    ativo: false, role: 'USER',
  });
  jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
  await expect(service.login({ email: 'a@a.com', senha: 'x' }))
    .rejects.toThrow('Sua conta está desativada.');
});
```

> Se o arquivo de spec ainda não importa `bcrypt`, adicionar no topo: `import * as bcrypt from 'bcrypt';`

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `cd apps/backend && npx jest --testPathPattern=auth.service.spec --no-coverage`
Expected: FAIL — o login ainda não checa `ativo`.

- [ ] **Step 3: Implementar o gate**

Em `apps/backend/src/auth/auth.service.ts`, no método `login`, logo após o bloco que valida `emailVerificado` (linhas 46-48) e antes do `return this.gerarTokens(...)`, adicionar:

```typescript
    if (!usuario.ativo) {
      throw new UnauthorizedException('Sua conta está desativada.');
    }
```

- [ ] **Step 4: Rodar os testes do auth**

Run: `cd apps/backend && npx jest --testPathPattern=auth.service.spec --no-coverage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/auth/auth.service.ts apps/backend/src/auth/auth.service.spec.ts
git commit -m "feat: barrar usuario desativado no login"
```

---

## Task 3: RankingService — tornar `recalcularRankingBolao` público

Necessário porque `PublicacaoService` (Task 4) precisa recalcular o draft de cada bolão antes de tirar o snapshot.

**Files:**
- Modify: `apps/backend/src/ranking/ranking.service.ts:67`

- [ ] **Step 1: Trocar a visibilidade do método**

Em `apps/backend/src/ranking/ranking.service.ts`, linha 67, trocar:

```typescript
  private async recalcularRankingBolao(bolaoId: string) {
```

Por:

```typescript
  async recalcularRankingBolao(bolaoId: string) {
```

- [ ] **Step 2: Rodar os testes do ranking (não devem quebrar)**

Run: `cd apps/backend && npx jest --testPathPattern=ranking.service.spec --no-coverage`
Expected: PASS (os testes existentes só cobrem `calcularNivel`).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/ranking/ranking.service.ts
git commit -m "refactor: tornar recalcularRankingBolao publico para uso na publicacao"
```

---

## Task 4: PublicacaoService — publicar (evento global)

**Files:**
- Create: `apps/backend/src/publicacao/publicacao.service.ts`
- Create: `apps/backend/src/publicacao/publicacao.service.spec.ts`

- [ ] **Step 1: Escrever os testes que falham**

Criar `apps/backend/src/publicacao/publicacao.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { PublicacaoService } from './publicacao.service';
import { PrismaService } from '../prisma/prisma.service';
import { RankingService } from '../ranking/ranking.service';

const prismaMock = {
  publicacao: { findFirst: jest.fn(), create: jest.fn() },
  jogo: { updateMany: jest.fn(), findMany: jest.fn() },
  bolao: { findMany: jest.fn() },
  bolaoMembro: { findMany: jest.fn() },
  ranking: { findMany: jest.fn() },
  aposta: { findMany: jest.fn() },
  rankingSnapshot: { findMany: jest.fn(), create: jest.fn() },
};
const rankingMock = { recalcularRankingBolao: jest.fn() };

describe('PublicacaoService.publicar', () => {
  let service: PublicacaoService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PublicacaoService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RankingService, useValue: rankingMock },
      ],
    }).compile();
    service = module.get(PublicacaoService);
    jest.clearAllMocks();
  });

  function setupBase() {
    prismaMock.publicacao.findFirst.mockResolvedValue({ numero: 2 }); // anterior = 2
    prismaMock.publicacao.create.mockResolvedValue({ id: 'pub-3', numero: 3, publicadoEm: new Date('2026-05-26T00:00:00Z') });
    prismaMock.jogo.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.jogo.findMany.mockResolvedValue([{ id: 'j1' }]); // jogos desta publicacao
    prismaMock.bolao.findMany.mockResolvedValue([{ id: 'b1' }]); // bolões habilitados
    prismaMock.bolaoMembro.findMany.mockResolvedValue([{ usuarioId: 'u1' }]);
    rankingMock.recalcularRankingBolao.mockResolvedValue(undefined);
    prismaMock.ranking.findMany.mockResolvedValue([
      { bolaoId: 'b1', usuarioId: 'u1', posicao: 1, pontuacaoTotal: 30,
        acertosPlacarExato: 2, acertosPlacarVencedor: 1, acertosPlacarPerdedor: 0,
        acertosEmpate: 0, acertosGanhador: 1, acertosNada: 0, apostasPostadas: 4 },
    ]);
    prismaMock.aposta.findMany.mockResolvedValue([{ usuarioId: 'u1', pontuacao: 10 }]); // pontos da rodada
    prismaMock.rankingSnapshot.create.mockResolvedValue({});
  }

  it('cria a publicacao com numero sequencial e marca jogos sem publicacao', async () => {
    setupBase();
    prismaMock.rankingSnapshot.findMany.mockResolvedValue([]); // sem snapshot anterior
    await service.publicar('admin-1');
    expect(prismaMock.publicacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { numero: 3, publicadoPorId: 'admin-1' } }),
    );
    expect(prismaMock.jogo.updateMany).toHaveBeenCalledWith({
      where: { placarCasa: { not: null }, publicacaoId: null },
      data: { publicacaoId: 'pub-3' },
    });
  });

  it('grava snapshot com pontuacaoRodada somando apostas dos jogos da publicacao', async () => {
    setupBase();
    prismaMock.rankingSnapshot.findMany.mockResolvedValue([]);
    await service.publicar('admin-1');
    expect(prismaMock.rankingSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publicacaoId: 'pub-3', bolaoId: 'b1', usuarioId: 'u1',
          posicao: 1, pontuacaoTotal: 30, pontuacaoRodada: 10, posicoesGanhas: 0,
          acertosPlacarExato: 2, apostasPostadas: 4,
        }),
      }),
    );
  });

  it('calcula posicoesGanhas como posicaoAnterior - posicao', async () => {
    setupBase();
    // snapshot anterior: usuário estava em 4º → ganhou 3 posições (4 - 1)
    prismaMock.rankingSnapshot.findMany.mockResolvedValue([
      { usuarioId: 'u1', posicao: 4 },
    ]);
    await service.publicar('admin-1');
    expect(prismaMock.rankingSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ posicoesGanhas: 3 }) }),
    );
  });

  it('primeira publicacao começa numero=1', async () => {
    setupBase();
    prismaMock.publicacao.findFirst.mockResolvedValue(null); // nenhuma anterior
    prismaMock.publicacao.create.mockResolvedValue({ id: 'pub-1', numero: 1, publicadoEm: new Date() });
    prismaMock.rankingSnapshot.findMany.mockResolvedValue([]);
    await service.publicar('admin-1');
    expect(prismaMock.publicacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { numero: 1, publicadoPorId: 'admin-1' } }),
    );
  });

  it('só recalcula bolões habilitados (status PAGO)', async () => {
    setupBase();
    prismaMock.rankingSnapshot.findMany.mockResolvedValue([]);
    await service.publicar('admin-1');
    expect(prismaMock.bolao.findMany).toHaveBeenCalledWith({
      where: { status: 'PAGO' }, select: { id: true },
    });
    expect(rankingMock.recalcularRankingBolao).toHaveBeenCalledWith('b1');
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `cd apps/backend && npx jest --testPathPattern=publicacao.service.spec --no-coverage`
Expected: FAIL — `PublicacaoService` não existe.

- [ ] **Step 3: Implementar o service**

Criar `apps/backend/src/publicacao/publicacao.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RankingService } from '../ranking/ranking.service';

@Injectable()
export class PublicacaoService {
  constructor(
    private prisma: PrismaService,
    private ranking: RankingService,
  ) {}

  async publicar(usuarioId: string) {
    const ultima = await this.prisma.publicacao.findFirst({
      orderBy: { numero: 'desc' },
    });
    const numero = (ultima?.numero ?? 0) + 1;

    const publicacao = await this.prisma.publicacao.create({
      data: { numero, publicadoPorId: usuarioId },
    });

    // Jogos encerrados (com placar) ainda não publicados entram nesta rodada.
    await this.prisma.jogo.updateMany({
      where: { placarCasa: { not: null }, publicacaoId: null },
      data: { publicacaoId: publicacao.id },
    });

    const jogosRodada = await this.prisma.jogo.findMany({
      where: { publicacaoId: publicacao.id },
      select: { id: true },
    });
    const jogoIds = jogosRodada.map((j) => j.id);

    // Pontos da rodada por usuário (apostas global, valem para todos os bolões).
    const apostasRodada = await this.prisma.aposta.findMany({
      where: { jogoId: { in: jogoIds }, pontuacao: { not: null } },
      select: { usuarioId: true, pontuacao: true },
    });
    const pontosRodadaPorUsuario = new Map<string, number>();
    for (const a of apostasRodada) {
      pontosRodadaPorUsuario.set(
        a.usuarioId,
        (pontosRodadaPorUsuario.get(a.usuarioId) ?? 0) + (a.pontuacao ?? 0),
      );
    }

    const boloes = await this.prisma.bolao.findMany({
      where: { status: 'PAGO' },
      select: { id: true },
    });

    for (const bolao of boloes) {
      await this.ranking.recalcularRankingBolao(bolao.id);

      const rankings = await this.prisma.ranking.findMany({
        where: { bolaoId: bolao.id },
        orderBy: { posicao: 'asc' },
      });

      // Posições da publicação anterior, para calcular variação.
      const anteriores = ultima
        ? await this.prisma.rankingSnapshot.findMany({
            where: { bolaoId: bolao.id, publicacaoId: ultima.id },
            select: { usuarioId: true, posicao: true },
          })
        : [];
      const posicaoAnterior = new Map<string, number>(
        anteriores.map((s) => [s.usuarioId, s.posicao]),
      );

      for (const r of rankings) {
        const anterior = posicaoAnterior.get(r.usuarioId);
        const posicoesGanhas = anterior !== undefined ? anterior - r.posicao : 0;

        await this.prisma.rankingSnapshot.create({
          data: {
            publicacaoId: publicacao.id,
            bolaoId: bolao.id,
            usuarioId: r.usuarioId,
            posicao: r.posicao,
            posicoesGanhas,
            pontuacaoTotal: r.pontuacaoTotal,
            pontuacaoRodada: pontosRodadaPorUsuario.get(r.usuarioId) ?? 0,
            acertosPlacarExato: r.acertosPlacarExato,
            acertosPlacarVencedor: r.acertosPlacarVencedor,
            acertosPlacarPerdedor: r.acertosPlacarPerdedor,
            acertosEmpate: r.acertosEmpate,
            acertosGanhador: r.acertosGanhador,
            acertosNada: r.acertosNada,
            apostasPostadas: r.apostasPostadas,
          },
        });
      }
    }

    return { numero: publicacao.numero, publicadoEm: publicacao.publicadoEm };
  }
}
```

> Nota: `ultima` (capturada antes de criar a nova publicação) é a publicação anterior; usamos seu `id` para buscar as posições anteriores. Como `findFirst` ordena por `numero desc` antes da criação, `ultima` nunca é a publicação recém-criada.

- [ ] **Step 4: Rodar os testes**

Run: `cd apps/backend && npx jest --testPathPattern=publicacao.service.spec --no-coverage`
Expected: 5 testes PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/publicacao/publicacao.service.ts apps/backend/src/publicacao/publicacao.service.spec.ts
git commit -m "feat: PublicacaoService.publicar — evento global com snapshots e variacao"
```

---

## Task 5: PublicacaoController + Module + registro no AppModule

**Files:**
- Create: `apps/backend/src/publicacao/publicacao.controller.ts`
- Create: `apps/backend/src/publicacao/publicacao.module.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: Criar o controller**

Criar `apps/backend/src/publicacao/publicacao.controller.ts`:

```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PublicacaoService } from './publicacao.service';
import { Role } from '@bolao/shared';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/publicacoes')
export class PublicacaoController {
  constructor(private service: PublicacaoService) {}

  @Post()
  publicar(@CurrentUser() user: { id: string }) {
    return this.service.publicar(user.id);
  }
}
```

- [ ] **Step 2: Criar o module**

Criar `apps/backend/src/publicacao/publicacao.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PublicacaoService } from './publicacao.service';
import { PublicacaoController } from './publicacao.controller';
import { RankingModule } from '../ranking/ranking.module';

@Module({
  imports: [RankingModule],
  controllers: [PublicacaoController],
  providers: [PublicacaoService],
})
export class PublicacaoModule {}
```

> `RankingModule` já exporta `RankingService` (ver `ranking.module.ts`), então a injeção funciona.

- [ ] **Step 3: Registrar no AppModule**

Em `apps/backend/src/app.module.ts`:

Adicionar o import no topo (após a linha `import { AdminModule } from './admin/admin.module';`):

```typescript
import { PublicacaoModule } from './publicacao/publicacao.module';
```

E adicionar `PublicacaoModule` ao array `imports`, logo após `AdminModule,`:

```typescript
    AdminModule,
    PublicacaoModule,
```

- [ ] **Step 4: Compilar o backend**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/publicacao/publicacao.controller.ts apps/backend/src/publicacao/publicacao.module.ts apps/backend/src/app.module.ts
git commit -m "feat: expor POST /admin/publicacoes e registrar PublicacaoModule"
```

---

## Task 6: RankingService — obterRanking via snapshot, listarPublicacoes, evolucao

**Files:**
- Modify: `apps/backend/src/ranking/ranking.service.ts:59-65`
- Modify: `apps/backend/src/ranking/ranking.service.spec.ts`

- [ ] **Step 1: Escrever os testes que falham**

Em `apps/backend/src/ranking/ranking.service.spec.ts`, adicionar um novo bloco `describe` no final do arquivo (mantendo o `describe('RankingService.calcularNivel'...)` existente). Este bloco usa um prisma mock próprio:

```typescript
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';

describe('RankingService leitura de snapshot', () => {
  const prismaMock = {
    publicacao: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    rankingSnapshot: { findMany: jest.fn() },
  };
  let service: RankingService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [RankingService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(RankingService);
    jest.clearAllMocks();
  });

  describe('obterRanking', () => {
    it('retorna [] quando não há publicação', async () => {
      prismaMock.publicacao.findFirst.mockResolvedValue(null);
      const r = await service.obterRanking('b1');
      expect(r).toEqual([]);
      expect(prismaMock.rankingSnapshot.findMany).not.toHaveBeenCalled();
    });

    it('usa a última publicação quirando numero não é informado', async () => {
      prismaMock.publicacao.findFirst.mockResolvedValue({ id: 'pub-3', numero: 3 });
      prismaMock.rankingSnapshot.findMany.mockResolvedValue([{ id: 's1', posicao: 1 }]);
      const r = await service.obterRanking('b1');
      expect(prismaMock.rankingSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { bolaoId: 'b1', publicacaoId: 'pub-3' } }),
      );
      expect(r).toHaveLength(1);
    });

    it('usa a publicação informada por numero', async () => {
      prismaMock.publicacao.findUnique.mockResolvedValue({ id: 'pub-2', numero: 2 });
      prismaMock.rankingSnapshot.findMany.mockResolvedValue([]);
      await service.obterRanking('b1', 2);
      expect(prismaMock.publicacao.findUnique).toHaveBeenCalledWith({ where: { numero: 2 } });
      expect(prismaMock.rankingSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { bolaoId: 'b1', publicacaoId: 'pub-2' } }),
      );
    });
  });

  describe('listarPublicacoes', () => {
    it('retorna numeros das publicações com snapshot do bolão, desc', async () => {
      prismaMock.rankingSnapshot.findMany.mockResolvedValue([
        { publicacao: { numero: 3, publicadoEm: new Date('2026-05-26') } },
        { publicacao: { numero: 2, publicadoEm: new Date('2026-05-25') } },
      ]);
      const r = await service.listarPublicacoes('b1');
      expect(r).toEqual([
        { numero: 3, publicadoEm: new Date('2026-05-26') },
        { numero: 2, publicadoEm: new Date('2026-05-25') },
      ]);
    });
  });

  describe('evolucao', () => {
    it('retorna série {numero, posicao} ordenada por numero asc', async () => {
      prismaMock.rankingSnapshot.findMany.mockResolvedValue([
        { posicao: 5, publicacao: { numero: 1 } },
        { posicao: 2, publicacao: { numero: 2 } },
      ]);
      const r = await service.evolucao('b1', 'u1');
      expect(r).toEqual([
        { numero: 1, posicao: 5 },
        { numero: 2, posicao: 2 },
      ]);
      expect(prismaMock.rankingSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { bolaoId: 'b1', usuarioId: 'u1' } }),
      );
    });
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `cd apps/backend && npx jest --testPathPattern=ranking.service.spec --no-coverage`
Expected: FAIL — métodos novos não existem e `obterRanking` ainda lê de `ranking`.

- [ ] **Step 3: Reescrever `obterRanking` e adicionar os métodos**

Em `apps/backend/src/ranking/ranking.service.ts`, substituir o método `obterRanking` inteiro (linhas 59-65) por:

```typescript
  async obterRanking(bolaoId: string, numero?: number) {
    const publicacao = numero
      ? await this.prisma.publicacao.findUnique({ where: { numero } })
      : await this.prisma.publicacao.findFirst({ orderBy: { numero: 'desc' } });
    if (!publicacao) return [];

    return this.prisma.rankingSnapshot.findMany({
      where: { bolaoId, publicacaoId: publicacao.id },
      include: { usuario: { select: { id: true, nome: true, avatarUrl: true } } },
      orderBy: { posicao: 'asc' },
    });
  }

  async listarPublicacoes(bolaoId: string) {
    const snapshots = await this.prisma.rankingSnapshot.findMany({
      where: { bolaoId },
      distinct: ['publicacaoId'],
      include: { publicacao: { select: { numero: true, publicadoEm: true } } },
      orderBy: { publicacao: { numero: 'desc' } },
    });
    return snapshots.map((s) => ({
      numero: s.publicacao.numero,
      publicadoEm: s.publicacao.publicadoEm,
    }));
  }

  async evolucao(bolaoId: string, usuarioId: string) {
    const snapshots = await this.prisma.rankingSnapshot.findMany({
      where: { bolaoId, usuarioId },
      include: { publicacao: { select: { numero: true } } },
      orderBy: { publicacao: { numero: 'asc' } },
    });
    return snapshots.map((s) => ({ numero: s.publicacao.numero, posicao: s.posicao }));
  }
```

> A relação `usuario` em `RankingSnapshot` (e a back-relation `Usuario.rankingSnapshots`) já foram criadas na Task 1, então o `include` acima funciona sem nova migração.

- [ ] **Step 4: Rodar os testes do ranking**

Run: `cd apps/backend && npx jest --testPathPattern=ranking.service.spec --no-coverage`
Expected: PASS (incluindo os de `calcularNivel`).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/ranking/ranking.service.ts apps/backend/src/ranking/ranking.service.spec.ts
git commit -m "feat: ranking lido de snapshot + listarPublicacoes + evolucao"
```

---

## Task 7: RankingController — rotas de publicacao e evolucao

**Files:**
- Modify: `apps/backend/src/ranking/ranking.controller.ts`

- [ ] **Step 1: Reescrever o controller**

Substituir todo o conteúdo de `apps/backend/src/ranking/ranking.controller.ts`:

```typescript
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RankingService } from './ranking.service';

@UseGuards(JwtAuthGuard)
@Controller('boloes/:bolaoId/ranking')
export class RankingController {
  constructor(private service: RankingService) {}

  @Get()
  obter(@Param('bolaoId') bolaoId: string, @Query('publicacao') publicacao?: string) {
    return this.service.obterRanking(bolaoId, publicacao ? Number(publicacao) : undefined);
  }

  @Get('publicacoes')
  publicacoes(@Param('bolaoId') bolaoId: string) {
    return this.service.listarPublicacoes(bolaoId);
  }

  @Get('evolucao')
  evolucao(
    @Param('bolaoId') bolaoId: string,
    @CurrentUser() user: { id: string },
    @Query('usuarioId') usuarioId?: string,
  ) {
    return this.service.evolucao(bolaoId, usuarioId ?? user.id);
  }
}
```

> Ordem das rotas: rotas literais (`publicacoes`, `evolucao`) coexistem com `@Get()` raiz sem conflito porque são paths distintos sob o mesmo prefixo. NestJS resolve corretamente.

- [ ] **Step 2: Compilar**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/ranking/ranking.controller.ts
git commit -m "feat: rotas GET ranking (com ?publicacao), /publicacoes e /evolucao"
```

---

## Task 8: AdminService — draft com variação, listar bolões, user mgmt

**Files:**
- Modify: `apps/backend/src/admin/admin.service.ts`
- Modify: `apps/backend/src/admin/admin.module.ts`
- Create: `apps/backend/src/admin/admin.service.spec.ts`

- [ ] **Step 1: Escrever os testes que falham**

Criar `apps/backend/src/admin/admin.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { RankingService } from '../ranking/ranking.service';
import { NotFoundException } from '@nestjs/common';

const prismaMock = {
  bolao: { findUnique: jest.fn(), findMany: jest.fn() },
  ranking: { findMany: jest.fn() },
  publicacao: { findFirst: jest.fn() },
  rankingSnapshot: { findMany: jest.fn() },
  usuario: { findMany: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
};
const rankingMock = { recalcularRankingBolao: jest.fn() };
const mailerMock = { sendMail: jest.fn() };

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RankingService, useValue: rankingMock },
        { provide: 'MAILER', useValue: mailerMock },
      ],
    }).compile();
    service = module.get(AdminService);
    jest.clearAllMocks();
  });

  describe('getRankingDraft', () => {
    it('lança NotFound se bolão não existe', async () => {
      prismaMock.bolao.findUnique.mockResolvedValue(null);
      await expect(service.getRankingDraft('b1')).rejects.toThrow(NotFoundException);
    });

    it('recalcula e anota variação projetada vs último snapshot', async () => {
      prismaMock.bolao.findUnique.mockResolvedValue({ id: 'b1' });
      rankingMock.recalcularRankingBolao.mockResolvedValue(undefined);
      prismaMock.ranking.findMany.mockResolvedValue([
        { usuarioId: 'u1', posicao: 1, pontuacaoTotal: 30,
          usuario: { id: 'u1', nome: 'Alice', avatarUrl: null } },
      ]);
      prismaMock.publicacao.findFirst.mockResolvedValue({ id: 'pub-2' });
      prismaMock.rankingSnapshot.findMany.mockResolvedValue([{ usuarioId: 'u1', posicao: 3 }]);
      const r = await service.getRankingDraft('b1');
      expect(rankingMock.recalcularRankingBolao).toHaveBeenCalledWith('b1');
      expect(r[0].posicoesGanhas).toBe(2); // 3 - 1
    });

    it('variação 0 quando não há publicação anterior', async () => {
      prismaMock.bolao.findUnique.mockResolvedValue({ id: 'b1' });
      prismaMock.ranking.findMany.mockResolvedValue([
        { usuarioId: 'u1', posicao: 1, pontuacaoTotal: 30,
          usuario: { id: 'u1', nome: 'Alice', avatarUrl: null } },
      ]);
      prismaMock.publicacao.findFirst.mockResolvedValue(null);
      const r = await service.getRankingDraft('b1');
      expect(r[0].posicoesGanhas).toBe(0);
    });
  });

  describe('atualizarUsuario', () => {
    it('atualiza ativo e role', async () => {
      prismaMock.usuario.update.mockResolvedValue({ id: 'u1', ativo: false, role: 'USER' });
      await service.atualizarUsuario('u1', { ativo: false });
      expect(prismaMock.usuario.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { ativo: false },
        select: { id: true, nome: true, email: true, role: true, ativo: true },
      });
    });
  });

  describe('resetarSenha', () => {
    it('lança NotFound se usuário não existe', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue(null);
      await expect(service.resetarSenha('u1')).rejects.toThrow(NotFoundException);
    });

    it('dispara e-mail de reset', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue({ id: 'u1', email: 'a@a.com' });
      const r = await service.resetarSenha('u1');
      expect(mailerMock.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'a@a.com' }),
      );
      expect(r).toEqual({ message: 'E-mail de redefinição enviado.' });
    });
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `cd apps/backend && npx jest --testPathPattern=admin.service.spec --no-coverage`
Expected: FAIL — métodos não existem com essas assinaturas.

- [ ] **Step 3: Reescrever o AdminService**

Substituir todo o conteúdo de `apps/backend/src/admin/admin.service.ts`:

```typescript
import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RankingService } from '../ranking/ranking.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private ranking: RankingService,
    private jwt: JwtService,
    private config: ConfigService,
    @Inject('MAILER') private mailer: any,
  ) {}

  async listarBoloes() {
    return this.prisma.bolao.findMany({
      select: {
        id: true, nome: true, descricao: true, status: true,
        precoReais: true, maxParticipantes: true,
        _count: { select: { membros: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async getRankingDraft(bolaoId: string) {
    const bolao = await this.prisma.bolao.findUnique({ where: { id: bolaoId } });
    if (!bolao) throw new NotFoundException('Bolão não encontrado.');

    await this.ranking.recalcularRankingBolao(bolaoId);
    const rankings = await this.prisma.ranking.findMany({
      where: { bolaoId },
      include: { usuario: { select: { id: true, nome: true, avatarUrl: true } } },
      orderBy: { posicao: 'asc' },
    });

    const ultima = await this.prisma.publicacao.findFirst({ orderBy: { numero: 'desc' } });
    const anteriores = ultima
      ? await this.prisma.rankingSnapshot.findMany({
          where: { bolaoId, publicacaoId: ultima.id },
          select: { usuarioId: true, posicao: true },
        })
      : [];
    const posicaoAnterior = new Map<string, number>(
      anteriores.map((s) => [s.usuarioId, s.posicao]),
    );

    return rankings.map((r) => ({
      ...r,
      posicoesGanhas:
        posicaoAnterior.get(r.usuarioId) !== undefined
          ? (posicaoAnterior.get(r.usuarioId) as number) - r.posicao
          : 0,
    }));
  }

  async listarUsuarios() {
    return this.prisma.usuario.findMany({
      select: { id: true, nome: true, email: true, role: true, ativo: true, avatarUrl: true, criadoEm: true },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async atualizarUsuario(id: string, dto: { role?: 'ADMIN' | 'USER'; ativo?: boolean }) {
    return this.prisma.usuario.update({
      where: { id },
      data: dto,
      select: { id: true, nome: true, email: true, role: true, ativo: true },
    });
  }

  async resetarSenha(id: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuário não encontrado.');

    const token = await this.jwt.signAsync(
      { sub: usuario.id, type: 'reset-password' },
      { secret: this.config.get('JWT_SECRET'), expiresIn: '1h' },
    );
    const url = `${this.config.get('APP_URL')}/auth/nova-senha?token=${token}`;
    await this.mailer.sendMail({
      to: usuario.email,
      subject: 'Redefinição de senha — Bolão Trovão',
      html: `<p>Um administrador solicitou a redefinição da sua senha. Clique: <a href="${url}">${url}</a></p>`,
    });
    return { message: 'E-mail de redefinição enviado.' };
  }
}
```

> O `publicarRanking` antigo foi removido — publicar agora é global em `PublicacaoController`.

- [ ] **Step 4: Atualizar o AdminModule para injetar dependências**

Substituir todo o conteúdo de `apps/backend/src/admin/admin.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { RankingModule } from '../ranking/ranking.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [RankingModule, JwtModule, MailerModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
```

> `MailerModule` (`apps/backend/src/mailer/mailer.module.ts`) provê e exporta o token `'MAILER'` — é o mesmo módulo importado pelo `AuthModule`. `JwtModule` (sem opções) basta porque o `signAsync` recebe `secret`/`expiresIn` explícitos, igual ao `AuthService`. Se ao subir o Nest reclamar que `'MAILER'` não é exportado, confira o `exports` de `mailer.module.ts`.

- [ ] **Step 5: Rodar os testes do admin**

Run: `cd apps/backend && npx jest --testPathPattern=admin.service.spec --no-coverage`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/admin/admin.service.ts apps/backend/src/admin/admin.module.ts apps/backend/src/admin/admin.service.spec.ts
git commit -m "feat: admin draft com variacao, listar boloes e gestao de usuarios"
```

---

## Task 9: AdminController — rotas de bolões e usuários

**Files:**
- Modify: `apps/backend/src/admin/admin.controller.ts`

- [ ] **Step 1: Reescrever o controller**

Substituir todo o conteúdo de `apps/backend/src/admin/admin.controller.ts`:

```typescript
import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { Role } from '@bolao/shared';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private service: AdminService) {}

  @Get('boloes')
  listarBoloes() {
    return this.service.listarBoloes();
  }

  @Get('ranking/:bolaoId/draft')
  getRankingDraft(@Param('bolaoId') bolaoId: string) {
    return this.service.getRankingDraft(bolaoId);
  }

  @Get('usuarios')
  listarUsuarios() {
    return this.service.listarUsuarios();
  }

  @Patch('usuarios/:id')
  atualizarUsuario(
    @Param('id') id: string,
    @Body() dto: { role?: 'ADMIN' | 'USER'; ativo?: boolean },
  ) {
    return this.service.atualizarUsuario(id, dto);
  }

  @Post('usuarios/:id/reset-senha')
  resetarSenha(@Param('id') id: string) {
    return this.service.resetarSenha(id);
  }
}
```

> A rota de publicar saiu daqui (agora em `PublicacaoController`). Habilitar/desabilitar bolão continua em `PATCH /boloes/:bolaoId/status`.

- [ ] **Step 2: Compilar e rodar toda a suíte do backend**

Run: `cd apps/backend && npx tsc --noEmit && npx jest --no-coverage`
Expected: tudo PASS, sem erros de tipo.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/admin/admin.controller.ts
git commit -m "feat: rotas admin para boloes e gestao de usuarios"
```

---

## Task 10: Frontend — instalar Recharts e tipos

**Files:**
- Modify: `apps/frontend/package.json`
- Modify: `apps/frontend/src/types/api.ts`

- [ ] **Step 1: Instalar Recharts**

Run: `cd apps/frontend && pnpm add recharts`
Expected: `recharts` adicionado a `dependencies` em `apps/frontend/package.json`.

- [ ] **Step 2: Adicionar/atualizar tipos**

Em `apps/frontend/src/types/api.ts`:

Adicionar `ativo` ao `Usuario` (após `role`):

```typescript
  ativo?: boolean;
```

Substituir a interface `RankingEntry` (linhas 58-69) por uma versão baseada em snapshot:

```typescript
export interface RankingEntry {
  id: string;
  usuarioId: string;
  posicao: number;
  posicoesGanhas: number;
  pontuacaoTotal: number;
  pontuacaoRodada: number;
  acertosPlacarExato: number;
  acertosPlacarVencedor: number;
  acertosPlacarPerdedor: number;
  acertosEmpate: number;
  acertosGanhador: number;
  acertosNada: number;
  apostasPostadas: number;
  usuario: { id: string; nome: string; avatarUrl: string | null };
}

export interface PublicacaoResumo {
  numero: number;
  publicadoEm: string;
}

export interface EvolucaoPonto {
  numero: number;
  posicao: number;
}

export interface AdminBolao {
  id: string;
  nome: string;
  descricao: string | null;
  status: 'ATIVO' | 'PAGO' | 'ARQUIVADO';
  precoReais: string;
  maxParticipantes: number;
  _count: { membros: number };
}

export interface AdminUsuario {
  id: string;
  nome: string;
  email: string;
  role: 'ADMIN' | 'USER';
  ativo: boolean;
  avatarUrl: string | null;
  criadoEm: string;
}
```

> O draft do admin (`getRankingDraft`) retorna o mesmo shape de `RankingEntry` (campos do `Ranking` + `posicoesGanhas`), então reusamos `RankingEntry` para ele.

- [ ] **Step 3: Compilar o frontend**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: erros ESPERADOS em `RankingRow.tsx`/`RankingPodium.tsx` se referenciarem campos removidos — serão resolvidos nas próximas tasks. Se houver erro só por campo novo ausente, seguir.

> Se preferir um checkpoint limpo, rode `npx tsc --noEmit` após a Task 12.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/package.json apps/frontend/pnpm-lock.yaml apps/frontend/src/types/api.ts
git commit -m "feat: recharts e tipos de snapshot/evolucao/admin no frontend"
```

---

## Task 11: Frontend — RankingRow exibe variação

**Files:**
- Modify: `apps/frontend/src/components/RankingRow.tsx:35-44`

- [ ] **Step 1: Adicionar o indicador de variação**

Em `apps/frontend/src/components/RankingRow.tsx`, dentro do `<button>`, logo após o `<span>` do nome (linha 37, o que contém `{entry.usuario.nome}`) e antes do `<span>` da pontuação (linha 39), inserir:

```tsx
        {entry.posicoesGanhas !== 0 && (
          <span className={`text-xs font-semibold tabular-nums ${
            entry.posicoesGanhas > 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {entry.posicoesGanhas > 0 ? '▲' : '▼'}{Math.abs(entry.posicoesGanhas)}
          </span>
        )}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: `RankingRow.tsx` sem erros (os campos `acertos*` e `posicoesGanhas` agora existem em `RankingEntry`).

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/RankingRow.tsx
git commit -m "feat: RankingRow mostra variacao de posicao"
```

---

## Task 12: Frontend — RankingEvolucao (gráfico Recharts)

**Files:**
- Create: `apps/frontend/src/components/RankingEvolucao.tsx`
- Create: `apps/frontend/src/__tests__/RankingEvolucao.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/frontend/src/__tests__/RankingEvolucao.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { RankingEvolucao } from '@/components/RankingEvolucao';

// Recharts usa ResizeObserver e dimensões; mockar para jsdom.
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  } as any;
});

describe('RankingEvolucao', () => {
  it('mostra estado vazio quando sem dados', () => {
    render(<RankingEvolucao dados={[]} />);
    expect(screen.getByText(/sem hist[oó]rico/i)).toBeInTheDocument();
  });

  it('renderiza o gráfico quando há pontos', () => {
    const { container } = render(
      <RankingEvolucao dados={[{ numero: 1, posicao: 5 }, { numero: 2, posicao: 2 }]} />,
    );
    // Recharts renderiza um container com a classe recharts-responsive-container
    expect(container.querySelector('.recharts-responsive-container')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `cd apps/frontend && npx jest --testPathPattern=RankingEvolucao --no-coverage`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar o componente**

Criar `apps/frontend/src/components/RankingEvolucao.tsx`:

```tsx
'use client';

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { EvolucaoPonto } from '@/types/api';

interface RankingEvolucaoProps {
  dados: EvolucaoPonto[];
}

export function RankingEvolucao({ dados }: RankingEvolucaoProps) {
  if (dados.length === 0) {
    return (
      <p className="text-trovao-muted text-sm text-center py-6">
        Sem histórico de posições ainda.
      </p>
    );
  }

  const maxPos = Math.max(...dados.map((d) => d.posicao));

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
          <XAxis
            dataKey="numero"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            label={{ value: 'Rodada', position: 'insideBottom', offset: -2, fill: '#9ca3af', fontSize: 11 }}
          />
          <YAxis
            reversed
            domain={[1, maxPos]}
            allowDecimals={false}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
          />
          <Tooltip
            formatter={(v: number) => [`${v}º`, 'Posição']}
            labelFormatter={(l) => `Rodada ${l}`}
            contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, color: '#fff' }}
          />
          <Line type="monotone" dataKey="posicao" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Rodar o teste**

Run: `cd apps/frontend && npx jest --testPathPattern=RankingEvolucao --no-coverage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/RankingEvolucao.tsx apps/frontend/src/__tests__/RankingEvolucao.test.tsx
git commit -m "feat: grafico de evolucao de posicao com recharts"
```

---

## Task 13: Frontend — página de ranking com toggle, seletor e gráfico

**Files:**
- Modify: `apps/frontend/src/app/(app)/ranking/[bolaoId]/page.tsx`

- [ ] **Step 1: Reescrever a página**

Substituir todo o conteúdo de `apps/frontend/src/app/(app)/ranking/[bolaoId]/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { RankingPodium } from '@/components/RankingPodium';
import { RankingRow } from '@/components/RankingRow';
import { RankingEvolucao } from '@/components/RankingEvolucao';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import type { RankingEntry, PublicacaoResumo, EvolucaoPonto } from '@/types/api';

type Aba = 'geral' | 'rodada';

export default function RankingPage() {
  const { bolaoId } = useParams<{ bolaoId: string }>();
  const { user } = useAuth();
  const [aba, setAba] = useState<Aba>('geral');
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [publicacoes, setPublicacoes] = useState<PublicacaoResumo[]>([]);
  const [publicacaoSel, setPublicacaoSel] = useState<number | null>(null);
  const [evolucao, setEvolucao] = useState<EvolucaoPonto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<RankingEntry[]>(`/boloes/${bolaoId}/ranking`).catch(() => [] as RankingEntry[]),
      api.get<PublicacaoResumo[]>(`/boloes/${bolaoId}/ranking/publicacoes`).catch(() => [] as PublicacaoResumo[]),
      api.get<EvolucaoPonto[]>(`/boloes/${bolaoId}/ranking/evolucao`).catch(() => [] as EvolucaoPonto[]),
    ]).then(([r, pubs, ev]) => {
      setRanking(r);
      setPublicacoes(pubs);
      setPublicacaoSel(pubs[0]?.numero ?? null);
      setEvolucao(ev);
      setLoading(false);
    });
  }, [bolaoId]);

  // Ao trocar a publicação selecionada na aba rodada, recarrega aquele snapshot.
  useEffect(() => {
    if (publicacaoSel === null) return;
    api.get<RankingEntry[]>(`/boloes/${bolaoId}/ranking?publicacao=${publicacaoSel}`)
      .then(setRanking)
      .catch(() => setRanking([]));
  }, [publicacaoSel, bolaoId]);

  const ordenado = aba === 'rodada'
    ? [...ranking].sort((a, b) => b.pontuacaoRodada - a.pontuacaoRodada)
    : ranking;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ranking</h1>
        <Link href={`/boloes/${bolaoId}`} className="text-trovao-muted text-sm hover:text-white">← Voltar</Link>
      </div>

      {loading ? (
        <PageSkeleton />
      ) : ranking.length === 0 && publicacoes.length === 0 ? (
        <EmptyState
          titulo="Aguardando publicação"
          descricao="O ranking será publicado pelo administrador após os jogos."
        />
      ) : (
        <>
          <div className="flex gap-2">
            <button onClick={() => setAba('geral')}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                aba === 'geral' ? 'bg-trovao-gold text-trovao-base border-trovao-gold'
                  : 'bg-trovao-surface text-trovao-muted border-trovao-border'}`}>
              Geral
            </button>
            <button onClick={() => setAba('rodada')}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                aba === 'rodada' ? 'bg-trovao-gold text-trovao-base border-trovao-gold'
                  : 'bg-trovao-surface text-trovao-muted border-trovao-border'}`}>
              Rodada
            </button>
          </div>

          {aba === 'rodada' && publicacoes.length > 0 && (
            <select
              value={publicacaoSel ?? ''}
              onChange={(e) => setPublicacaoSel(Number(e.target.value))}
              className="bg-trovao-surface border border-trovao-border rounded-lg text-sm px-2 py-1 text-white"
            >
              {publicacoes.map((p) => (
                <option key={p.numero} value={p.numero}>Rodada {p.numero}</option>
              ))}
            </select>
          )}

          {aba === 'geral' && (
            <>
              <RankingPodium ranking={ordenado} myId={user?.id} />
              <div className="mt-2">
                <h2 className="text-sm font-semibold text-trovao-muted mb-2">Sua evolução</h2>
                <RankingEvolucao dados={evolucao} />
              </div>
            </>
          )}

          <div className="space-y-2 mt-4">
            {(aba === 'geral' ? ordenado.slice(3) : ordenado).map((entry) => (
              <RankingRow
                key={entry.id}
                entry={aba === 'rodada'
                  ? { ...entry, pontuacaoTotal: entry.pontuacaoRodada, posicoesGanhas: 0 }
                  : entry}
                myId={user?.id}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

> Na aba "rodada" passamos `pontuacaoTotal = pontuacaoRodada` e zeramos `posicoesGanhas` para reusar `RankingRow` sem variação (regra: ranking detalhado não tem variação).

- [ ] **Step 2: Verificar tipos e rodar testes do frontend**

Run: `cd apps/frontend && npx tsc --noEmit && npx jest --no-coverage`
Expected: sem erros de tipo; testes existentes + `RankingEvolucao` PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/frontend/src/app/(app)/ranking/[bolaoId]/page.tsx"
git commit -m "feat: ranking com aba geral/rodada, seletor de publicacao e grafico"
```

---

## Task 14: Frontend — layout admin com guard de role

**Files:**
- Create: `apps/frontend/src/app/(admin)/layout.tsx`

- [ ] **Step 1: Criar o layout admin**

Criar `apps/frontend/src/app/(admin)/layout.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

const LINKS = [
  { href: '/boloes', label: 'Bolões' },
  { href: '/placares', label: 'Placares' },
  { href: '/ranking', label: 'Ranking' },
  { href: '/usuarios', label: 'Usuários' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && user && user.role !== 'ADMIN') {
      router.replace('/jogos');
    }
  }, [user, loading, router]);

  if (loading) return null;
  if (!user || user.role !== 'ADMIN') return null;

  return (
    <div className="space-y-4">
      <nav className="flex gap-2 border-b border-trovao-border pb-2">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href}
            className={`px-3 py-1 rounded-lg text-sm ${
              pathname?.startsWith(l.href) ? 'bg-trovao-gold text-trovao-base' : 'text-trovao-muted hover:text-white'
            }`}>
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
```

> `useAuth()` (em `apps/frontend/src/components/AuthProvider.tsx`) expõe `{ user, loading, ... }`, e `user` é do tipo `Usuario` com `role`, então o guard acima funciona como escrito. Se as rotas admin precisarem do mesmo shell visual do `(app)`, replique o wrapper usado em `apps/frontend/src/app/(app)/layout.tsx`.

- [ ] **Step 2: Compilar**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "apps/frontend/src/app/(admin)/layout.tsx"
git commit -m "feat: layout admin com guard de role"
```

---

## Task 15: Frontend — tela admin de bolões (habilitar/desabilitar)

**Files:**
- Create: `apps/frontend/src/app/(admin)/boloes/page.tsx`

- [ ] **Step 1: Criar a página**

Criar `apps/frontend/src/app/(admin)/boloes/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageSkeleton } from '@/components/PageSkeleton';
import type { AdminBolao } from '@/types/api';

export default function AdminBoloesPage() {
  const [boloes, setBoloes] = useState<AdminBolao[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    const data = await api.get<AdminBolao[]>('/admin/boloes').catch(() => [] as AdminBolao[]);
    setBoloes(data);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function alternar(b: AdminBolao) {
    const novo = b.status === 'PAGO' ? 'ATIVO' : 'PAGO';
    await api.patch(`/boloes/${b.id}/status`, { status: novo }).catch(() => {});
    carregar();
  }

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Bolões</h1>
      {boloes.map((b) => (
        <div key={b.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-trovao-card border border-trovao-border">
          <div>
            <p className="text-white text-sm font-semibold">{b.nome}</p>
            <p className="text-trovao-muted text-xs">
              {b._count.membros} membros · R$ {b.precoReais}
            </p>
          </div>
          <button onClick={() => alternar(b)}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              b.status === 'PAGO'
                ? 'bg-green-500/10 text-green-400 border-green-500/40'
                : 'bg-trovao-surface text-trovao-muted border-trovao-border'}`}>
            {b.status === 'PAGO' ? 'Habilitado' : 'Habilitar'}
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Compilar**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "apps/frontend/src/app/(admin)/boloes/page.tsx"
git commit -m "feat: tela admin para habilitar/desabilitar boloes"
```

---

## Task 16: Frontend — tela admin de ranking (preview + publicar)

**Files:**
- Create: `apps/frontend/src/app/(admin)/ranking/page.tsx`

- [ ] **Step 1: Criar a página**

Criar `apps/frontend/src/app/(admin)/ranking/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { RankingRow } from '@/components/RankingRow';
import { PageSkeleton } from '@/components/PageSkeleton';
import type { AdminBolao, RankingEntry } from '@/types/api';

export default function AdminRankingPage() {
  const [boloes, setBoloes] = useState<AdminBolao[]>([]);
  const [bolaoSel, setBolaoSel] = useState<string>('');
  const [draft, setDraft] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [publicando, setPublicando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.get<AdminBolao[]>('/admin/boloes')
      .then((data) => {
        setBoloes(data);
        setBolaoSel(data[0]?.id ?? '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!bolaoSel) return;
    api.get<RankingEntry[]>(`/admin/ranking/${bolaoSel}/draft`)
      .then(setDraft)
      .catch(() => setDraft([]));
  }, [bolaoSel]);

  async function publicar() {
    setPublicando(true);
    setMsg(null);
    try {
      const r = await api.post<{ numero: number }>('/admin/publicacoes');
      setMsg(`Rodada ${r.numero} publicada!`);
      if (bolaoSel) setDraft(await api.get<RankingEntry[]>(`/admin/ranking/${bolaoSel}/draft`));
    } catch {
      setMsg('Erro ao publicar.');
    }
    setPublicando(false);
  }

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Pré-visualização do ranking</h1>
        <button onClick={publicar} disabled={publicando}
          className="px-4 py-1.5 rounded-lg bg-trovao-gold text-trovao-base text-sm font-semibold disabled:opacity-50">
          {publicando ? 'Publicando...' : 'Publicar rodada'}
        </button>
      </div>

      {msg && <p className="text-sm text-trovao-gold">{msg}</p>}

      <select value={bolaoSel} onChange={(e) => setBolaoSel(e.target.value)}
        className="bg-trovao-surface border border-trovao-border rounded-lg text-sm px-2 py-1 text-white">
        {boloes.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
      </select>

      <div className="space-y-2">
        {draft.map((entry) => <RankingRow key={entry.id} entry={entry} />)}
      </div>
    </div>
  );
}
```

> Publicar é global; o botão age sobre todos os bolões habilitados. O `select` só escolhe qual bolão pré-visualizar.

- [ ] **Step 2: Compilar**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "apps/frontend/src/app/(admin)/ranking/page.tsx"
git commit -m "feat: tela admin de preview e publicacao de ranking"
```

---

## Task 17: Frontend — tela admin de usuários

**Files:**
- Create: `apps/frontend/src/app/(admin)/usuarios/page.tsx`

- [ ] **Step 1: Criar a página**

Criar `apps/frontend/src/app/(admin)/usuarios/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageSkeleton } from '@/components/PageSkeleton';
import type { AdminUsuario } from '@/types/api';

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<AdminUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  async function carregar() {
    const data = await api.get<AdminUsuario[]>('/admin/usuarios').catch(() => [] as AdminUsuario[]);
    setUsuarios(data);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function alternarAtivo(u: AdminUsuario) {
    await api.patch(`/admin/usuarios/${u.id}`, { ativo: !u.ativo }).catch(() => {});
    carregar();
  }

  async function alternarRole(u: AdminUsuario) {
    const role = u.role === 'ADMIN' ? 'USER' : 'ADMIN';
    await api.patch(`/admin/usuarios/${u.id}`, { role }).catch(() => {});
    carregar();
  }

  async function resetar(u: AdminUsuario) {
    await api.post(`/admin/usuarios/${u.id}/reset-senha`).catch(() => {});
    setMsg(`E-mail de redefinição enviado para ${u.email}.`);
  }

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Usuários</h1>
      {msg && <p className="text-sm text-trovao-gold">{msg}</p>}
      {usuarios.map((u) => (
        <div key={u.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-trovao-card border border-trovao-border">
          <div>
            <p className="text-white text-sm font-semibold">{u.nome}</p>
            <p className="text-trovao-muted text-xs">{u.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => alternarRole(u)}
              className="px-2 py-1 rounded-full text-xs border border-trovao-border text-trovao-muted">
              {u.role}
            </button>
            <button onClick={() => alternarAtivo(u)}
              className={`px-2 py-1 rounded-full text-xs border ${
                u.ativo ? 'bg-green-500/10 text-green-400 border-green-500/40'
                  : 'bg-red-500/10 text-red-400 border-red-500/40'}`}>
              {u.ativo ? 'Ativo' : 'Inativo'}
            </button>
            <button onClick={() => resetar(u)}
              className="px-2 py-1 rounded-full text-xs border border-trovao-border text-trovao-muted">
              Reset senha
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Compilar e rodar a suíte do frontend**

Run: `cd apps/frontend && npx tsc --noEmit && npx jest --no-coverage`
Expected: sem erros de tipo; testes PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/frontend/src/app/(admin)/usuarios/page.tsx"
git commit -m "feat: tela admin de gestao de usuarios (ativo/role/reset-senha)"
```

---

## Task 18: Verificação end-to-end manual

**Files:** nenhum (validação manual).

- [ ] **Step 1: Subir backend e frontend**

Run (em terminais separados):
- `cd apps/backend && pnpm dev`
- `cd apps/frontend && pnpm dev`

Expected: ambos sobem sem erro de inicialização (Nest registra `PublicacaoController`, `AdminController`, `RankingController`).

- [ ] **Step 2: Fluxo do admin**

Com um usuário `ADMIN`, no navegador:
1. `/boloes` (admin) → habilitar um bolão privado (status vira "Habilitado").
2. `/placares` (admin) ou via `PATCH /jogos/:id/placar` → lançar placar de jogos.
3. `/ranking` (admin) → ver o draft com variação; clicar "Publicar rodada".
4. Confirmar mensagem "Rodada N publicada!".

- [ ] **Step 3: Fluxo do participante**

Com um usuário comum, membro do bolão habilitado:
1. `/ranking/[bolaoId]` → aba Geral mostra posições + variação + gráfico de evolução.
2. Aba Rodada → seletor de publicação, pontuação da rodada, sem variação.
3. Lançar um novo placar como admin (sem publicar) → confirmar que o participante **não** vê a mudança até nova publicação.

- [ ] **Step 4: Fluxo de usuário inativo**

1. Admin desativa um usuário em `/usuarios`.
2. Logout e tentativa de login com esse usuário → erro "Sua conta está desativada.".

- [ ] **Step 5: Commit final (se houver ajustes)**

```bash
git add -A
git commit -m "chore: ajustes finais da verificacao e2e de publicacao/ranking"
```

---

## Notas de implementação

- **Sem `$transaction` em `publicar`:** as operações são sequenciais para manter os testes mockáveis e os passos pequenos. Como publicar é uma ação rara e gated por admin, o risco de concorrência é baixo. Endurecer com `prisma.$transaction` é uma melhoria futura, não um requisito deste plano.
- **Correção de placar pós-publicação:** o jogo mantém seu `publicacaoId` original (o `updateMany` só pega `publicacaoId: null`), então a correção reflete só no draft ao vivo e chega ao participante na próxima publicação — conforme a spec.
- **Provider `MAILER`:** vem do `MailerModule` compartilhado, importado tanto pelo `AuthModule` quanto pelo `AdminModule` (Task 8, Step 4).
