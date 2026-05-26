# Apostas Globais — Uma Aposta por Jogo por Usuário Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar apostas de per-bolão para globais — um usuário faz uma única aposta por jogo que vale para todos os bolões em que participa.

**Architecture:** Remove `bolaoId` do modelo `Aposta` (schema + migration com deduplicação), atualiza backend para limite global e palpites com check de prazo no servidor, e reestrutura frontend movendo controle de apostas exclusivamente para a página Jogos e criando nova página de palpites acessível via contexto de bolão.

**Tech Stack:** NestJS + Prisma + PostgreSQL (backend), Next.js 14 App Router + React + Tailwind (frontend), Jest (testes).

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `packages/shared/src/enums.ts` | Modificar — `MAX_APOSTAS_IGUAIS_GRUPOS` 25 → 18 |
| `apps/backend/prisma/schema.prisma` | Modificar — remover `bolaoId` de `Aposta`, ajustar relação em `Bolao` |
| `apps/backend/prisma/migrations/<timestamp>_apostas_globais/migration.sql` | Criar — SQL com deduplicação + remoção da coluna |
| `apps/backend/src/aposta/dto/upsert-aposta.dto.ts` | Modificar — remover `bolaoId` |
| `apps/backend/src/aposta/aposta.service.ts` | Modificar — upsert global, listar global, palpites com prazo |
| `apps/backend/src/aposta/aposta.controller.ts` | Modificar — `GET /apostas/bolao/:id` → `GET /apostas` |
| `apps/backend/src/aposta/aposta.service.spec.ts` | Modificar — remover bolaoId, atualizar limite 18, novos testes |
| `apps/backend/src/ranking/ranking.service.ts` | Modificar — join via BolaoMembro |
| `apps/frontend/src/types/api.ts` | Modificar — remover `bolaoId` de `Aposta` |
| `apps/frontend/src/components/ApostaDrawer.tsx` | Modificar — remover `bolaoId` das props e do POST |
| `apps/frontend/src/__tests__/ApostaDrawer.test.tsx` | Modificar — remover `bolaoId` dos testes |
| `apps/frontend/src/app/(app)/jogos/page.tsx` | Modificar — `GET /apostas`, remover `bolaoId` do ApostaDrawer |
| `apps/frontend/src/app/(app)/boloes/[id]/page.tsx` | Modificar — remover ApostaDrawer, usar `GET /apostas`, adicionar link palpites |
| `apps/frontend/src/app/(app)/boloes/[id]/palpites/[jogoId]/page.tsx` | Criar — nova página de palpites com seletor de bolão |
| `apps/frontend/src/app/(app)/palpites/[jogoId]/page.tsx` | Deletar |

---

## Task 1: Atualizar constante MAX_APOSTAS_IGUAIS_GRUPOS para 18

**Files:**
- Modify: `packages/shared/src/enums.ts`
- Modify: `apps/backend/src/aposta/aposta.service.spec.ts`

- [ ] **Step 1: Atualizar a constante**

Em `packages/shared/src/enums.ts`, linha 40, trocar:

```typescript
export const MAX_APOSTAS_IGUAIS_GRUPOS = 25;
```

Por:

```typescript
export const MAX_APOSTAS_IGUAIS_GRUPOS = 18;
```

- [ ] **Step 2: Atualizar o teste que verifica o limite de grupos**

Em `apps/backend/src/aposta/aposta.service.spec.ts`, atualizar o teste que testa o limite de 25 para 18. Trocar:

```typescript
it('lança BadRequestException ao exceder 25 apostas iguais na fase de grupos', async () => {
  prismaMock.jogo.findUnique.mockResolvedValue(jogoGrupos);
  prismaMock.bolaoMembro.findUnique.mockResolvedValue({ papel: 'PARTICIPANTE' });
  prismaMock.aposta.findUnique.mockResolvedValue(null);
  prismaMock.aposta.count.mockResolvedValue(25);
  await expect(
    service.upsert('user-1', { jogoId: 'jogo-1', bolaoId: 'b1', placarCasa: 1, placarVisitante: 0 }),
  ).rejects.toThrow(BadRequestException);
});
```

Por (apenas atualizar o count e o texto — bolaoId e membership serão removidos na Task 3):

```typescript
it('lança BadRequestException ao exceder 18 apostas iguais na fase de grupos', async () => {
  prismaMock.jogo.findUnique.mockResolvedValue(jogoGrupos);
  prismaMock.bolaoMembro.findUnique.mockResolvedValue({ papel: 'PARTICIPANTE' });
  prismaMock.aposta.findUnique.mockResolvedValue(null);
  prismaMock.aposta.count.mockResolvedValue(18);
  await expect(
    service.upsert('user-1', { jogoId: 'jogo-1', bolaoId: 'b1', placarCasa: 1, placarVisitante: 0 }),
  ).rejects.toThrow(BadRequestException);
});
```

- [ ] **Step 3: Rodar testes do backend para confirmar que apenas o limite muda**

```bash
cd apps/backend && npx jest --no-coverage
```

Esperado: todos os testes PASS (o limite mudou, o teste foi atualizado).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/enums.ts apps/backend/src/aposta/aposta.service.spec.ts
git commit -m "feat: reduzir limite de apostas idênticas em grupos de 25 para 18"
```

---

## Task 2: Migração do schema — remover bolaoId de Aposta

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/<timestamp>_apostas_globais/migration.sql`

- [ ] **Step 1: Atualizar schema.prisma**

Em `apps/backend/prisma/schema.prisma`:

**No modelo `Bolao`** (linha 77), remover a linha:
```prisma
apostas  Aposta[]
```

**No modelo `Aposta`** (linhas 153–169), substituir o bloco inteiro por:

```prisma
model Aposta {
  id              String   @id @default(uuid())
  usuarioId       String
  usuario         Usuario  @relation(fields: [usuarioId], references: [id])
  jogoId          String
  jogo            Jogo     @relation(fields: [jogoId], references: [id])
  placarCasa      Int
  placarVisitante Int
  pontuacao       Int?
  criadoEm       DateTime @default(now())
  atualizadoEm   DateTime @updatedAt

  @@unique([usuarioId, jogoId])
  @@map("aposta")
}
```

- [ ] **Step 2: Gerar migration sem aplicar**

```bash
cd apps/backend && npx prisma migrate dev --create-only --name apostas_globais
```

Esperado: cria `prisma/migrations/<timestamp>_apostas_globais/migration.sql` com o SQL gerado.

- [ ] **Step 3: Editar o arquivo de migration para adicionar deduplicação**

Abrir o arquivo gerado em `prisma/migrations/<timestamp>_apostas_globais/migration.sql` e **adicionar o bloco de deduplicação no início**, antes de qualquer outra instrução:

```sql
-- Deduplicate apostas: para cada (usuarioId, jogoId) manter apenas um registro.
-- Prioridade: aposta do bolão global (00000000-0000-0000-0000-000000000001),
-- senão a mais recente por atualizadoEm.
DELETE FROM aposta
WHERE id NOT IN (
  SELECT DISTINCT ON ("usuarioId", "jogoId") id
  FROM aposta
  ORDER BY
    "usuarioId",
    "jogoId",
    CASE WHEN "bolaoId" = '00000000-0000-0000-0000-000000000001' THEN 0 ELSE 1 END,
    "atualizadoEm" DESC
);

-- DropForeignKey (gerado pelo Prisma abaixo)
```

O arquivo final deve começar com o bloco de deduplicação e continuar com o SQL gerado pelo Prisma (DropForeignKey, DropIndex, AlterTable DROP COLUMN, CreateIndex).

- [ ] **Step 4: Aplicar a migration**

```bash
cd apps/backend && npx prisma migrate dev
```

Esperado: migration aplicada com sucesso, Prisma Client regenerado.

- [ ] **Step 5: Verificar que o Prisma Client não tem mais bolaoId em Aposta**

```bash
cd apps/backend && npx prisma generate
```

Esperado: sem erros. O tipo `Aposta` no client não deve ter `bolaoId`.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations/
git commit -m "feat: remover bolaoId do modelo Aposta — apostas agora são globais"
```

---

## Task 3: Backend — DTO, Service e Controller de apostas

**Files:**
- Modify: `apps/backend/src/aposta/dto/upsert-aposta.dto.ts`
- Modify: `apps/backend/src/aposta/aposta.service.ts`
- Modify: `apps/backend/src/aposta/aposta.controller.ts`
- Modify: `apps/backend/src/aposta/aposta.service.spec.ts`

- [ ] **Step 1: Reescrever os testes do ApostaService**

Substituir todo o conteúdo de `apps/backend/src/aposta/aposta.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ApostaService } from './aposta.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JogoFase } from '@bolao/shared';

const jogoGrupos = {
  id: 'jogo-1',
  dataHora: new Date(Date.now() + 3 * 60 * 60 * 1000),
  fase: JogoFase.GRUPOS,
  placarCasa: null,
  placarVisitante: null,
};
const jogoElim = { ...jogoGrupos, fase: JogoFase.OITAVAS };
const jogoPassado = {
  ...jogoGrupos,
  dataHora: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h no passado
};

const prismaMock = {
  jogo: { findUnique: jest.fn() },
  bolaoMembro: { findMany: jest.fn() },
  aposta: { findUnique: jest.fn(), upsert: jest.fn(), count: jest.fn(), findMany: jest.fn() },
};

describe('ApostaService', () => {
  let service: ApostaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ApostaService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(ApostaService);
    jest.clearAllMocks();
  });

  describe('upsert', () => {
    it('lança ForbiddenException se aposta após prazo (< 1h antes)', async () => {
      prismaMock.jogo.findUnique.mockResolvedValue({
        ...jogoGrupos,
        dataHora: new Date(Date.now() + 30 * 60 * 1000),
      });
      await expect(
        service.upsert('user-1', { jogoId: 'jogo-1', placarCasa: 1, placarVisitante: 0 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lança BadRequestException ao exceder 18 apostas iguais na fase de grupos', async () => {
      prismaMock.jogo.findUnique.mockResolvedValue(jogoGrupos);
      prismaMock.aposta.findUnique.mockResolvedValue(null);
      prismaMock.aposta.count.mockResolvedValue(18);
      await expect(
        service.upsert('user-1', { jogoId: 'jogo-1', placarCasa: 1, placarVisitante: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException ao exceder 8 apostas iguais na fase eliminatória', async () => {
      prismaMock.jogo.findUnique.mockResolvedValue(jogoElim);
      prismaMock.aposta.findUnique.mockResolvedValue(null);
      prismaMock.aposta.count.mockResolvedValue(8);
      await expect(
        service.upsert('user-1', { jogoId: 'jogo-1', placarCasa: 2, placarVisitante: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('permite editar aposta existente com mesmo placar sem contar como nova', async () => {
      prismaMock.jogo.findUnique.mockResolvedValue(jogoGrupos);
      prismaMock.aposta.findUnique.mockResolvedValue({ id: 'a1', placarCasa: 1, placarVisitante: 0 });
      prismaMock.aposta.count.mockResolvedValue(18);
      prismaMock.aposta.upsert.mockResolvedValue({});
      await expect(
        service.upsert('user-1', { jogoId: 'jogo-1', placarCasa: 1, placarVisitante: 0 }),
      ).resolves.not.toThrow();
    });

    it('não chama bolaoMembro ao fazer aposta', async () => {
      prismaMock.jogo.findUnique.mockResolvedValue(jogoGrupos);
      prismaMock.aposta.findUnique.mockResolvedValue(null);
      prismaMock.aposta.count.mockResolvedValue(0);
      prismaMock.aposta.upsert.mockResolvedValue({});
      await service.upsert('user-1', { jogoId: 'jogo-1', placarCasa: 1, placarVisitante: 0 });
      expect(prismaMock.bolaoMembro.findMany).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('retorna apostas do usuário sem filtro de bolão', async () => {
      const apostas = [{ id: 'a1', jogoId: 'j1', usuarioId: 'user-1' }];
      prismaMock.aposta.findMany.mockResolvedValue(apostas);
      const result = await service.listar('user-1');
      expect(result).toEqual(apostas);
      expect(prismaMock.aposta.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { usuarioId: 'user-1' } }),
      );
    });
  });

  describe('listarPalpitesPorJogo', () => {
    it('lança ForbiddenException se apostas ainda abertas', async () => {
      prismaMock.jogo.findUnique.mockResolvedValue(jogoGrupos); // 3h no futuro
      await expect(
        service.listarPalpitesPorJogo('bolao-1', 'jogo-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lança NotFoundException se jogo não encontrado', async () => {
      prismaMock.jogo.findUnique.mockResolvedValue(null);
      await expect(
        service.listarPalpitesPorJogo('bolao-1', 'jogo-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('retorna palpites dos membros do bolão após prazo', async () => {
      prismaMock.jogo.findUnique.mockResolvedValue(jogoPassado);
      prismaMock.bolaoMembro.findMany.mockResolvedValue([
        { usuarioId: 'user-1' },
        { usuarioId: 'user-2' },
      ]);
      prismaMock.aposta.findMany.mockResolvedValue([
        { usuarioId: 'user-1', placarCasa: 2, placarVisitante: 1, pontuacao: null,
          usuario: { id: 'user-1', nome: 'Alice', avatarUrl: null } },
      ]);
      const result = await service.listarPalpitesPorJogo('bolao-1', 'jogo-1');
      expect(result).toHaveLength(1);
      expect(result[0].nome).toBe('Alice');
      expect(prismaMock.aposta.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { jogoId: 'jogo-1', usuarioId: { in: ['user-1', 'user-2'] } },
        }),
      );
    });
  });
});
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

```bash
cd apps/backend && npx jest --testPathPattern=aposta.service.spec --no-coverage
```

Esperado: FAIL — o service ainda usa bolaoId.

- [ ] **Step 3: Reescrever o DTO**

Substituir todo o conteúdo de `apps/backend/src/aposta/dto/upsert-aposta.dto.ts`:

```typescript
import { IsString, IsInt, Min } from 'class-validator';

export class UpsertApostaDto {
  @IsString() jogoId: string;
  @IsInt() @Min(0) placarCasa: number;
  @IsInt() @Min(0) placarVisitante: number;
}
```

- [ ] **Step 4: Reescrever o ApostaService**

Substituir todo o conteúdo de `apps/backend/src/aposta/aposta.service.ts`:

```typescript
import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertApostaDto } from './dto/upsert-aposta.dto';
import {
  FASES_ELIMINATORIAS, MAX_APOSTAS_IGUAIS_GRUPOS,
  MAX_APOSTAS_IGUAIS_ELIMINATORIAS, MINUTOS_PRAZO_APOSTA,
} from '@bolao/shared';

@Injectable()
export class ApostaService {
  constructor(private prisma: PrismaService) {}

  async upsert(usuarioId: string, dto: UpsertApostaDto) {
    const jogo = await this.prisma.jogo.findUnique({ where: { id: dto.jogoId } });
    if (!jogo) throw new NotFoundException('Jogo não encontrado.');

    const prazo = new Date(jogo.dataHora.getTime() - MINUTOS_PRAZO_APOSTA * 60 * 1000);
    if (new Date() >= prazo) throw new ForbiddenException('Prazo para apostas encerrado.');

    const apostaExistente = await this.prisma.aposta.findUnique({
      where: { usuarioId_jogoId: { usuarioId, jogoId: dto.jogoId } },
    });

    const placarMudou =
      !apostaExistente ||
      apostaExistente.placarCasa !== dto.placarCasa ||
      apostaExistente.placarVisitante !== dto.placarVisitante;

    if (placarMudou) {
      const isElim = FASES_ELIMINATORIAS.includes(jogo.fase as any);
      const limite = isElim ? MAX_APOSTAS_IGUAIS_ELIMINATORIAS : MAX_APOSTAS_IGUAIS_GRUPOS;

      const totalIguais = await this.prisma.aposta.count({
        where: {
          usuarioId,
          placarCasa: dto.placarCasa,
          placarVisitante: dto.placarVisitante,
          jogo: { fase: isElim ? { in: FASES_ELIMINATORIAS as any } : { equals: 'GRUPOS' as any } },
        },
      });

      if (totalIguais >= limite) {
        throw new BadRequestException(
          `Limite de ${limite} apostas idênticas atingido para a fase ${isElim ? 'eliminatória' : 'de grupos'}.`,
        );
      }
    }

    return this.prisma.aposta.upsert({
      where: { usuarioId_jogoId: { usuarioId, jogoId: dto.jogoId } },
      update: { placarCasa: dto.placarCasa, placarVisitante: dto.placarVisitante, pontuacao: null },
      create: { usuarioId, jogoId: dto.jogoId, placarCasa: dto.placarCasa, placarVisitante: dto.placarVisitante },
    });
  }

  async listar(usuarioId: string) {
    return this.prisma.aposta.findMany({
      where: { usuarioId },
      include: { jogo: { include: { selecaoCasa: true, selecaoVisitante: true } } },
      orderBy: { jogo: { dataHora: 'asc' } },
    });
  }

  async listarPalpitesPorJogo(bolaoId: string, jogoId: string) {
    const jogo = await this.prisma.jogo.findUnique({ where: { id: jogoId } });
    if (!jogo) throw new NotFoundException('Jogo não encontrado.');

    const prazo = new Date(jogo.dataHora.getTime() - MINUTOS_PRAZO_APOSTA * 60 * 1000);
    if (new Date() < prazo) {
      throw new ForbiddenException('Palpites disponíveis apenas após o encerramento das apostas.');
    }

    const membros = await this.prisma.bolaoMembro.findMany({
      where: { bolaoId },
      select: { usuarioId: true },
    });
    const usuarioIds = membros.map(m => m.usuarioId);

    const apostas = await this.prisma.aposta.findMany({
      where: { jogoId, usuarioId: { in: usuarioIds } },
      include: { usuario: { select: { id: true, nome: true, avatarUrl: true } } },
      orderBy: [{ pontuacao: 'desc' }, { usuario: { nome: 'asc' } }],
    });

    return apostas.map(a => ({
      usuarioId: a.usuarioId,
      nome: a.usuario.nome,
      avatarUrl: a.usuario.avatarUrl,
      placarCasa: a.placarCasa,
      placarVisitante: a.placarVisitante,
      pontuacao: a.pontuacao,
    }));
  }
}
```

- [ ] **Step 5: Atualizar o ApostaController**

Substituir todo o conteúdo de `apps/backend/src/aposta/aposta.controller.ts`:

```typescript
import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApostaService } from './aposta.service';
import { UpsertApostaDto } from './dto/upsert-aposta.dto';

@UseGuards(JwtAuthGuard)
@Controller('apostas')
export class ApostaController {
  constructor(private service: ApostaService) {}

  @Post()
  upsert(@CurrentUser() user: { id: string }, @Body() dto: UpsertApostaDto) {
    return this.service.upsert(user.id, dto);
  }

  @Get()
  listar(@CurrentUser() user: { id: string }) {
    return this.service.listar(user.id);
  }
}
```

- [ ] **Step 6: Rodar testes do backend**

```bash
cd apps/backend && npx jest --no-coverage
```

Esperado: 18 testes PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/aposta/
git commit -m "feat: apostas globais — remover bolaoId do upsert, limite global, palpites com check de prazo"
```

---

## Task 4: Backend — Ranking Service

**Files:**
- Modify: `apps/backend/src/ranking/ranking.service.ts`

- [ ] **Step 1: Atualizar `recalcularParaJogo`**

Em `apps/backend/src/ranking/ranking.service.ts`, substituir as linhas 48–51 (o bloco que calcula `bolaoIds` a partir de `apostas.map(a => a.bolaoId)`):

```typescript
// Antes (linhas 48–51):
const bolaoIds = [...new Set(apostas.map((a) => a.bolaoId))];
for (const bolaoId of bolaoIds) {
  await this.recalcularRankingBolao(bolaoId);
}

// Depois:
const usuarioIds = apostas.map(a => a.usuarioId);
const membros = await this.prisma.bolaoMembro.findMany({
  where: { usuarioId: { in: usuarioIds } },
  select: { bolaoId: true },
});
const bolaoIds = [...new Set(membros.map(m => m.bolaoId))];
for (const bolaoId of bolaoIds) {
  await this.recalcularRankingBolao(bolaoId);
}
```

- [ ] **Step 2: Atualizar `recalcularRankingBolao`**

Em `apps/backend/src/ranking/ranking.service.ts`, substituir as linhas 63–66 (o bloco que busca apostas por `bolaoId`):

```typescript
// Antes (linhas 63–66):
private async recalcularRankingBolao(bolaoId: string) {
  const apostas = await this.prisma.aposta.findMany({
    where: { bolaoId, pontuacao: { not: null } },
    include: { jogo: true },
  });

// Depois:
private async recalcularRankingBolao(bolaoId: string) {
  const membros = await this.prisma.bolaoMembro.findMany({
    where: { bolaoId },
    select: { usuarioId: true },
  });
  const usuarioIds = membros.map(m => m.usuarioId);

  const apostas = await this.prisma.aposta.findMany({
    where: { usuarioId: { in: usuarioIds }, pontuacao: { not: null } },
    include: { jogo: true },
  });
```

- [ ] **Step 3: Rodar testes do backend**

```bash
cd apps/backend && npx jest --no-coverage
```

Esperado: 18 testes PASS (os testes de RankingService testam apenas `calcularNivel`, que não muda).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/ranking/ranking.service.ts
git commit -m "feat: ranking — buscar apostas via membros do bolão em vez de bolaoId na aposta"
```

---

## Task 5: Frontend — types, ApostaDrawer e Jogos page

**Files:**
- Modify: `apps/frontend/src/types/api.ts`
- Modify: `apps/frontend/src/components/ApostaDrawer.tsx`
- Modify: `apps/frontend/src/__tests__/ApostaDrawer.test.tsx`
- Modify: `apps/frontend/src/app/(app)/jogos/page.tsx`

- [ ] **Step 1: Atualizar o teste do ApostaDrawer (vai falhar primeiro)**

Em `apps/frontend/src/__tests__/ApostaDrawer.test.tsx`:

**Remover `bolaoId: 'b1'` de `props`** (linhas 23–29), passando para:

```typescript
const props = {
  jogo,
  aberto: true,
  onFechar: jest.fn(),
  onSalvo: jest.fn(),
};
```

**Atualizar o teste que verifica o payload do POST** para não incluir `bolaoId`:

```typescript
it('Confirmar chama api.post com payload correto', async () => {
  render(<ApostaDrawer {...props} />);
  fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);
  fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);
  fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
  await waitFor(() => {
    expect(mockPost).toHaveBeenCalledWith('/apostas', {
      jogoId: 'j1', placarCasa: 2, placarVisitante: 0,
    });
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
cd apps/frontend && npx jest --testPathPattern=ApostaDrawer --no-coverage
```

Esperado: FAIL — o componente ainda envia `bolaoId`.

- [ ] **Step 3: Remover bolaoId do tipo Aposta**

Em `apps/frontend/src/types/api.ts`, no interface `Aposta` (linhas 49–57), remover a linha `bolaoId: string;`:

```typescript
export interface Aposta {
  id: string;
  jogoId: string;
  placarCasa: number;
  placarVisitante: number;
  pontuacao: number | null;
  jogo: Jogo;
}
```

- [ ] **Step 4: Remover bolaoId do ApostaDrawer**

Em `apps/frontend/src/components/ApostaDrawer.tsx`:

Substituir o bloco de interface e desestruturação (linhas 14–23):

```typescript
interface ApostaDrawerProps {
  jogo: Jogo;
  aposta?: Aposta;
  aberto: boolean;
  onFechar: () => void;
  onSalvo: () => void;
}

export function ApostaDrawer({ jogo, aposta, aberto, onFechar, onSalvo }: ApostaDrawerProps) {
```

Substituir linha 34 (o `api.post`):

```typescript
await api.post('/apostas', { jogoId: jogo.id, placarCasa, placarVisitante });
```

- [ ] **Step 5: Atualizar a Jogos page**

Em `apps/frontend/src/app/(app)/jogos/page.tsx`:

**Linha 11** — remover `BOLAO_GLOBAL_ID` do import (já não é necessário):

```typescript
import { JogoFase } from '@bolao/shared';
```

**Linhas 37–50** — atualizar `carregar` e `recarregarApostas`:

```typescript
async function carregar() {
  setLoading(true);
  const params = fase !== 'Todos' ? `?fase=${fase}` : '';
  const [jogosData, apostasData] = await Promise.all([
    api.get<Jogo[]>(`/jogos${params}`).catch(() => [] as Jogo[]),
    api.get<Aposta[]>('/apostas').catch(() => [] as Aposta[]),
  ]);
  setJogos(jogosData);
  setApostas(new Map(apostasData.map(a => [a.jogoId, a])));
  setLoading(false);
}

async function recarregarApostas() {
  const apostasData = await api.get<Aposta[]>('/apostas').catch(() => [] as Aposta[]);
  setApostas(new Map(apostasData.map(a => [a.jogoId, a])));
}
```

**Linhas 90–99** — remover `bolaoId` do ApostaDrawer:

```tsx
{jogoSelecionado && (
  <ApostaDrawer
    key={jogoSelecionado.id}
    jogo={jogoSelecionado}
    aposta={apostas.get(jogoSelecionado.id)}
    aberto={true}
    onFechar={() => setJogoSelecionado(null)}
    onSalvo={recarregarApostas}
  />
)}
```

- [ ] **Step 6: Rodar testes do frontend**

```bash
cd apps/frontend && npx jest --no-coverage
```

Esperado: todos os testes PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/types/api.ts apps/frontend/src/components/ApostaDrawer.tsx apps/frontend/src/__tests__/ApostaDrawer.test.tsx "apps/frontend/src/app/(app)/jogos/page.tsx"
git commit -m "feat: remover bolaoId do ApostaDrawer e jogos page — apostas globais"
```

---

## Task 6: Frontend — Bolão page (remover apostas, adicionar link palpites)

**Files:**
- Modify: `apps/frontend/src/app/(app)/boloes/[id]/page.tsx`

- [ ] **Step 1: Reescrever a página do bolão**

Substituir todo o conteúdo de `apps/frontend/src/app/(app)/boloes/[id]/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { JogoCard } from '@/components/JogoCard';
import { ModeradorPanel } from '@/components/ModeradorPanel';
import { ConvitePanel } from '@/components/ConvitePanel';
import { MINUTOS_PRAZO_APOSTA } from '@bolao/shared';
import type { Bolao, Jogo, Aposta } from '@/types/api';

function prazoEncerrado(jogo: Jogo): boolean {
  const prazo = new Date(new Date(jogo.dataHora).getTime() - MINUTOS_PRAZO_APOSTA * 60 * 1000);
  return new Date() >= prazo;
}

export default function BolaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [bolao, setBolao] = useState<Bolao | null>(null);
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [apostas, setApostas] = useState<Map<string, Aposta>>(new Map());
  const [loading, setLoading] = useState(true);

  async function carregar() {
    const [b, js, as_] = await Promise.all([
      api.get<Bolao>(`/boloes/${id}`).catch(() => null),
      api.get<Jogo[]>('/jogos').catch(() => []),
      api.get<Aposta[]>('/apostas').catch(() => []),
    ]);
    setBolao(b);
    setJogos(js);
    setApostas(new Map(as_.map(a => [a.jogoId, a])));
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [id]);

  if (loading) return <p className="text-gray-500">Carregando...</p>;
  if (!bolao) return <p className="text-red-400">Bolão não encontrado.</p>;

  const isModerador = bolao.membros?.find(m => m.usuarioId === user?.id)?.papel === 'MODERADOR';

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">{bolao.nome}</h1>
          {bolao.descricao && <p className="text-gray-400 text-sm mt-1">{bolao.descricao}</p>}
        </div>
        <Link href={`/ranking/${id}`}
          className="text-sm text-yellow-400 hover:underline">Ver ranking</Link>
      </div>

      {isModerador && (
        <div className="space-y-4">
          <ConvitePanel bolaoId={id} />
          <ModeradorPanel bolaoId={id} membros={bolao.membros ?? []} onAtualizado={carregar} />
        </div>
      )}

      {!isModerador && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 mb-3">
            Membros ({bolao.membros?.length ?? 0})
          </h2>
          <div className="flex flex-wrap gap-2">
            {bolao.membros?.map(m => (
              <div key={m.id} className="flex items-center gap-1.5 bg-gray-800 rounded-full px-3 py-1 text-xs">
                {m.usuario.avatarUrl && <img src={m.usuario.avatarUrl} alt="" className="w-4 h-4 rounded-full" />}
                <span>{m.usuario.nome}</span>
                {m.papel === 'MODERADOR' && <span className="text-yellow-400">★</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Jogos</h2>
        <div className="space-y-3">
          {jogos.map(jogo => (
            <div key={jogo.id} className="space-y-1">
              <JogoCard jogo={jogo} aposta={apostas.get(jogo.id)} />
              {prazoEncerrado(jogo) && (
                <Link
                  href={`/boloes/${id}/palpites/${jogo.id}`}
                  className="block text-center text-xs text-yellow-400 hover:underline py-1"
                >
                  Ver palpites
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rodar testes do frontend**

```bash
cd apps/frontend && npx jest --no-coverage
```

Esperado: todos os testes PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/frontend/src/app/(app)/boloes/[id]/page.tsx"
git commit -m "feat: bolão page — apostas globais via GET /apostas, link palpites após prazo"
```

---

## Task 7: Frontend — Nova página de Palpites e remoção da antiga

**Files:**
- Create: `apps/frontend/src/app/(app)/boloes/[id]/palpites/[jogoId]/page.tsx`
- Delete: `apps/frontend/src/app/(app)/palpites/[jogoId]/page.tsx`

- [ ] **Step 1: Criar a nova página de palpites**

Criar `apps/frontend/src/app/(app)/boloes/[id]/palpites/[jogoId]/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { MINUTOS_PRAZO_APOSTA, BOLAO_GLOBAL_ID } from '@bolao/shared';
import type { Bolao, Jogo } from '@/types/api';

interface Palpite {
  usuarioId: string;
  nome: string;
  avatarUrl: string | null;
  placarCasa: number;
  placarVisitante: number;
  pontuacao: number | null;
}

function prazoEncerrado(dataHora: string): boolean {
  const prazo = new Date(new Date(dataHora).getTime() - MINUTOS_PRAZO_APOSTA * 60 * 1000);
  return new Date() >= prazo;
}

export default function PalpitesPage() {
  const { id: bolaoId, jogoId } = useParams<{ id: string; jogoId: string }>();
  const router = useRouter();
  const [jogo, setJogo] = useState<Jogo | null>(null);
  const [palpites, setPalpites] = useState<Palpite[]>([]);
  const [boloes, setBoloes] = useState<Bolao[]>([]);
  const [loading, setLoading] = useState(true);
  const [prazoPassou, setPrazoPassou] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Jogo>(`/jogos/${jogoId}`).catch(() => null),
      api.get<Bolao[]>('/boloes').catch(() => [] as Bolao[]),
    ]).then(([j, bs]) => {
      setJogo(j);
      setBoloes(bs);
      if (j && prazoEncerrado(j.dataHora)) {
        setPrazoPassou(true);
        api.get<Palpite[]>(`/boloes/${bolaoId}/apostas?jogoId=${jogoId}`)
          .then(setPalpites)
          .catch(() => setPalpites([]));
      }
      setLoading(false);
    });
  }, [bolaoId, jogoId]);

  if (loading) return <PageSkeleton />;
  if (!jogo) return <EmptyState titulo="Jogo não encontrado" />;

  const boloesPrivados = boloes.filter(b => b.id !== BOLAO_GLOBAL_ID);
  const temMultiplosBoloesPrivados = boloesPrivados.length > 1;

  function navegarBolao(novoBolaoId: string) {
    router.push(`/boloes/${novoBolaoId}/palpites/${jogoId}`);
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho do jogo */}
      <div className="text-center">
        <p className="text-trovao-muted text-xs mb-1">{jogo.fase} · Rodada {jogo.rodada}</p>
        <h1 className="text-lg font-bold text-white">
          {jogo.selecaoCasa.codigo} × {jogo.selecaoVisitante.codigo}
        </h1>
        {jogo.placarCasa !== null && (
          <p className="text-trovao-gold font-mono text-2xl font-bold mt-1">
            {jogo.placarCasa} : {jogo.placarVisitante}
          </p>
        )}
      </div>

      {/* Seletor de bolão */}
      {(temMultiplosBoloesPrivados || boloesPrivados.length === 0) && (
        <div className="flex gap-2 flex-wrap">
          {boloesPrivados.map(b => (
            <button
              key={b.id}
              onClick={() => navegarBolao(b.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                b.id === bolaoId
                  ? 'bg-trovao-gold text-trovao-base border-trovao-gold'
                  : 'bg-trovao-surface text-trovao-muted border-trovao-border hover:border-trovao-gold'
              }`}
            >
              {b.nome}
            </button>
          ))}
          <button
            onClick={() => navegarBolao(BOLAO_GLOBAL_ID)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              bolaoId === BOLAO_GLOBAL_ID
                ? 'bg-trovao-gold text-trovao-base border-trovao-gold'
                : 'bg-trovao-surface text-trovao-muted border-trovao-border hover:border-trovao-gold'
            }`}
          >
            Global
          </button>
        </div>
      )}

      {/* Conteúdo dos palpites */}
      {!prazoPassou ? (
        <div className="text-center py-8">
          <p className="text-trovao-muted text-sm">
            Os palpites serão revelados quando as apostas encerrarem.
          </p>
        </div>
      ) : palpites.length === 0 ? (
        <EmptyState titulo="Nenhum palpite" descricao="Nenhum membro apostou neste jogo." />
      ) : (
        <div className="space-y-2">
          <p className="text-trovao-muted text-xs px-1">{palpites.length} palpites</p>
          {palpites.map(p => (
            <div key={p.usuarioId}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-trovao-card border border-trovao-border">
              <div className="flex items-center gap-2">
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt={p.nome} className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-trovao-surface flex items-center justify-center text-xs font-bold text-trovao-muted">
                    {p.nome.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-white text-sm font-medium">{p.nome}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white font-mono text-sm font-semibold">
                  {p.placarCasa} × {p.placarVisitante}
                </span>
                {p.pontuacao !== null && (
                  <span className="text-trovao-gold text-sm font-bold tabular-nums">
                    +{p.pontuacao}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Deletar a página antiga de palpites**

```bash
rm -rf "apps/frontend/src/app/(app)/palpites"
```

- [ ] **Step 3: Rodar testes do frontend**

```bash
cd apps/frontend && npx jest --no-coverage
```

Esperado: todos os testes PASS.

- [ ] **Step 4: Commit**

```bash
git add "apps/frontend/src/app/(app)/boloes/[id]/palpites/" && git rm -r "apps/frontend/src/app/(app)/palpites/"
git commit -m "feat: nova página de palpites em /boloes/[id]/palpites/[jogoId] com seletor de bolão"
```
