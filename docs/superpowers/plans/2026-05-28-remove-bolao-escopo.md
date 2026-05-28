# Remove BolaoEscopo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover o campo `escopo` do bolão e o enum `BolaoEscopo` de todo o codebase, e consolidar as 5 migrations existentes em uma única migration `init` limpa.

**Architecture:** A remoção parte do enum compartilhado (`@bolao/shared`) e propaga a todos os consumidores TypeScript (DTO, spec, notificação, e2e, frontend) em um único task. Em seguida, o schema Prisma é atualizado, as migrations são consolidadas e o banco é resetado.

**Tech Stack:** NestJS, Prisma (PostgreSQL), Next.js 14, TypeScript, Jest, pnpm monorepo.

---

## File Map

| Arquivo | O que muda |
|---|---|
| `packages/shared/src/enums.ts` | Remove enum `BolaoEscopo` inteiro |
| `apps/backend/src/bolao/dto/create-bolao.dto.ts` | Remove campo `escopo` e import |
| `apps/backend/src/bolao/bolao.service.spec.ts` | Remove `escopo: BolaoEscopo.AMBOS` de todos os calls |
| `apps/backend/src/notificacao/notificacao.service.ts` | Remove filtro `escopo` do where |
| `e2e/data/factories.ts` | Remove `escopo: 'AMBOS'` do `newBolao()` |
| `apps/frontend/src/types/api.ts` | Remove `escopo` das interfaces |
| `apps/frontend/src/app/admin/boloes/page.tsx` | Remove import, campo, select e resets |
| `apps/backend/prisma/schema.prisma` | Remove `BolaoEscopo` enum e coluna `escopo` |
| `apps/backend/prisma/migrations/` | Deleta 5 dirs, cria `init` consolidado |
| `apps/backend/src/bolao/bolao.service.ts` | Remove `escopo` do select em `buscarPorNome` |

---

## Task 1: Remover BolaoEscopo de todos os consumidores TypeScript

**Files:**
- Modify: `packages/shared/src/enums.ts`
- Modify: `apps/backend/src/bolao/dto/create-bolao.dto.ts`
- Modify: `apps/backend/src/bolao/bolao.service.spec.ts`
- Modify: `apps/backend/src/notificacao/notificacao.service.ts`
- Modify: `e2e/data/factories.ts`
- Modify: `apps/frontend/src/types/api.ts`
- Modify: `apps/frontend/src/app/admin/boloes/page.tsx`

- [ ] **Step 1: Remover BolaoEscopo de enums.ts**

Em `packages/shared/src/enums.ts`, remover o enum `BolaoEscopo` inteiro. O restante do arquivo permanece igual (`BolaoStatus`, `Role`, `JogoFase`, `BolaoMembroPapel`, constantes):

```ts
export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export enum BolaoStatus {
  ATIVO = 'ATIVO',
  INATIVO = 'INATIVO',
}

export enum JogoFase {
  GRUPOS = 'GRUPOS',
  OITAVAS = 'OITAVAS',
  QUARTAS = 'QUARTAS',
  SEMIS = 'SEMIS',
  TERCEIRO_LUGAR = 'TERCEIRO_LUGAR',
  FINAL = 'FINAL',
}

export enum BolaoMembroPapel {
  MODERADOR = 'MODERADOR',
  PARTICIPANTE = 'PARTICIPANTE',
}

export const FASES_ELIMINATORIAS: JogoFase[] = [
  JogoFase.OITAVAS,
  JogoFase.QUARTAS,
  JogoFase.SEMIS,
  JogoFase.TERCEIRO_LUGAR,
  JogoFase.FINAL,
];

export const MAX_APOSTAS_IGUAIS_GRUPOS = 18;
export const MAX_APOSTAS_IGUAIS_ELIMINATORIAS = 8;
export const MINUTOS_PRAZO_APOSTA = 60;
export const BOLAO_GLOBAL_ID = '00000000-0000-0000-0000-000000000001';
```

- [ ] **Step 2: Atualizar create-bolao.dto.ts**

Substituir o conteúdo de `apps/backend/src/bolao/dto/create-bolao.dto.ts`:

```ts
import { IsString, IsInt, Min, IsOptional, IsUUID } from 'class-validator';

export class CreateBolaoDto {
  @IsString()
  nome: string;

  @IsOptional() @IsString()
  descricao?: string;

  @IsInt() @Min(10)
  maxParticipantes: number;

  @IsUUID()
  moderadorId: string;
}
```

- [ ] **Step 3: Atualizar bolao.service.spec.ts**

Substituir o conteúdo completo de `apps/backend/src/bolao/bolao.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { BolaoService } from './bolao.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BolaoMembroPapel } from '@bolao/shared';

const prismaMock = {
  bolao: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  bolaoMembro: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), update: jest.fn(), count: jest.fn(), deleteMany: jest.fn() },
  bolaoConvite: { findUnique: jest.fn(), create: jest.fn() },
  ranking: { create: jest.fn(), deleteMany: jest.fn() },
  usuario: { findUnique: jest.fn() },
};

describe('BolaoService', () => {
  let service: BolaoService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [BolaoService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(BolaoService);
    jest.clearAllMocks();
  });

  it('criar lança BadRequestException se maxParticipantes não é múltiplo de 10', async () => {
    await expect(
      service.criar('admin-1', { nome: 'Test', maxParticipantes: 15, moderadorId: 'mod-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('criar calcula precoReais = maxParticipantes × 1', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 'mod-1' });
    prismaMock.bolao.create.mockResolvedValue({ id: 'b1', maxParticipantes: 20, precoReais: 20 });
    prismaMock.bolaoMembro.create.mockResolvedValue({});
    prismaMock.ranking.create.mockResolvedValue({});
    await service.criar('admin-1', { nome: 'Test', maxParticipantes: 20, moderadorId: 'mod-1' });
    expect(prismaMock.bolao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ precoReais: 20 }) }),
    );
  });

  it('criar usa moderadorId como membro MODERADOR, não adminId', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 'mod-1' });
    prismaMock.bolao.create.mockResolvedValue({ id: 'b1', maxParticipantes: 10, precoReais: 10 });
    prismaMock.bolaoMembro.create.mockResolvedValue({});
    prismaMock.ranking.create.mockResolvedValue({});
    await service.criar('admin-1', { nome: 'Test', maxParticipantes: 10, moderadorId: 'mod-1' });
    expect(prismaMock.bolaoMembro.create).toHaveBeenCalledWith({
      data: { bolaoId: 'b1', usuarioId: 'mod-1', papel: BolaoMembroPapel.MODERADOR },
    });
    expect(prismaMock.ranking.create).toHaveBeenCalledWith({
      data: { bolaoId: 'b1', usuarioId: 'mod-1' },
    });
  });

  it('criar não insere admin como membro nem no ranking', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 'mod-1' });
    prismaMock.bolao.create.mockResolvedValue({ id: 'b1', maxParticipantes: 10, precoReais: 10 });
    prismaMock.bolaoMembro.create.mockResolvedValue({});
    prismaMock.ranking.create.mockResolvedValue({});
    await service.criar('admin-1', { nome: 'Test', maxParticipantes: 10, moderadorId: 'mod-1' });
    expect(prismaMock.bolaoMembro.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.ranking.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.bolaoMembro.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ usuarioId: 'admin-1' }) }),
    );
  });

  it('criar lança NotFoundException se moderadorId não existe', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    await expect(
      service.criar('admin-1', { nome: 'Test', maxParticipantes: 10, moderadorId: 'non-existent' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('entrarViaConvite lança BadRequestException se convite expirado', async () => {
    prismaMock.bolaoConvite.findUnique.mockResolvedValue({
      bolaoId: 'b1',
      expiraEm: new Date(Date.now() - 1000),
    });
    await expect(service.entrarViaConvite('user-1', 'token-expirado')).rejects.toThrow(
      BadRequestException,
    );
  });
});
```

- [ ] **Step 4: Simplificar filtro em notificacao.service.ts**

Em `apps/backend/src/notificacao/notificacao.service.ts`, substituir o bloco `findMany` de membros (linhas ~76-84):

```ts
    const membros = await this.prisma.bolaoMembro.findMany({
      where: {
        bolao: { status: 'ATIVO' },
      },
      select: { usuarioId: true },
    });
```

- [ ] **Step 5: Atualizar factories.ts**

Em `e2e/data/factories.ts`, substituir a função `newBolao`:

```ts
export function newBolao() {
  const id = nanoid(6);
  return { nome: `Bolão ${id}`, maxParticipantes: 10 };
}
```

- [ ] **Step 6: Atualizar tipos do frontend**

Em `apps/frontend/src/types/api.ts`, remover `escopo` das duas interfaces:

Interface `Bolao` — remover a linha:
```ts
  escopo: 'GRUPOS' | 'ELIMINATORIAS' | 'AMBOS';
```

Interface `AdminBolao` não tem `escopo`, sem mudança necessária aí.

O arquivo resultante para `Bolao`:
```ts
export interface Bolao {
  id: string;
  nome: string;
  descricao: string | null;
  status: 'ATIVO' | 'INATIVO';
  maxParticipantes: number;
  precoReais: string;
  _count?: { membros: number };
  membros?: BolaoMembro[];
}
```

- [ ] **Step 7: Atualizar painel admin**

Substituir o conteúdo completo de `apps/frontend/src/app/admin/boloes/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { UserSearchInput } from '@/components/UserSearchInput';
import type { AdminBolao } from '@/types/api';

export default function AdminBoloesPage() {
  const [boloes, setBoloes] = useState<AdminBolao[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({
    nome: '', descricao: '', maxParticipantes: 10,
  });
  const [moderador, setModerador] = useState<{ id: string; nome: string } | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setLoading(true);
    const data = await api.get<AdminBolao[]>('/admin/boloes').catch(() => [] as AdminBolao[]);
    setBoloes(data);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  function set(k: string, v: unknown) { setForm(p => ({ ...p, [k]: v })); }

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    if (!moderador) { setErro('Selecione um moderador.'); return; }
    setErro('');
    setSalvando(true);
    try {
      await api.post('/boloes', { ...form, moderadorId: moderador.id });
      setCriando(false);
      setForm({ nome: '', descricao: '', maxParticipantes: 10 });
      setModerador(null);
      carregar();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar bolão.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(b: AdminBolao) {
    const novo = b.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    await api.patch(`/boloes/${b.id}/status`, { status: novo }).catch(() => {});
    carregar();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Bolões</h1>
        <button
          onClick={() => {
            setCriando(v => !v);
            setErro('');
            setForm({ nome: '', descricao: '', maxParticipantes: 10 });
            setModerador(null);
          }}
          className="bg-yellow-400 text-gray-900 font-bold px-4 py-2 rounded-lg text-sm hover:bg-yellow-300">
          {criando ? 'Cancelar' : '+ Criar bolão'}
        </button>
      </div>

      {criando && (
        <form onSubmit={handleCriar}
          className="bg-trovao-card border border-trovao-border rounded-xl p-4 space-y-3">
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Nome</label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)} required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Descrição (opcional)</label>
            <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Máx. participantes (múltiplo de 10)</label>
            <input type="number" min={10} step={10} value={form.maxParticipantes}
              onChange={e => set('maxParticipantes', Number(e.target.value))} required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Moderador</label>
            <UserSearchInput value={moderador} onChange={setModerador} />
          </div>
          <button type="submit" disabled={salvando}
            className="w-full bg-yellow-400 text-gray-900 font-bold py-2 rounded-lg text-sm hover:bg-yellow-300 disabled:opacity-50">
            {salvando ? 'Criando...' : 'Criar bolão'}
          </button>
        </form>
      )}

      {loading ? <PageSkeleton /> : boloes.length === 0 ? (
        <EmptyState titulo="Nenhum bolão" />
      ) : (
        <div className="space-y-2">
          {boloes.map((b) => (
            <div key={b.id}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-trovao-card border border-trovao-border">
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold truncate">{b.nome}</p>
                <p className="text-trovao-muted text-xs">
                  {b._count.membros} membros · R$ {b.precoReais}
                </p>
              </div>
              <button onClick={() => alternar(b)}
                className={`px-3 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${
                  b.status === 'ATIVO'
                    ? 'bg-trovao-green/10 text-trovao-green border-trovao-green/40'
                    : 'bg-trovao-surface text-trovao-muted border-trovao-border hover:border-trovao-gold'}`}>
                {b.status === 'ATIVO' ? 'Ativo' : 'Inativo'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Rodar specs do backend**

```bash
cd apps/backend && pnpm jest --no-coverage 2>&1
```

Esperado: 54 testes passando em 8 suites.

- [ ] **Step 9: Rodar typecheck do frontend**

```bash
cd apps/frontend && pnpm tsc --noEmit 2>&1
```

Esperado: nenhum erro.

- [ ] **Step 10: Commit**

```bash
git add packages/shared/src/enums.ts \
  apps/backend/src/bolao/dto/create-bolao.dto.ts \
  apps/backend/src/bolao/bolao.service.spec.ts \
  apps/backend/src/notificacao/notificacao.service.ts \
  e2e/data/factories.ts \
  apps/frontend/src/types/api.ts \
  apps/frontend/src/app/admin/boloes/page.tsx
git commit -m "feat: remove BolaoEscopo from all TypeScript consumers"
```

---

## Task 2: Atualizar schema Prisma, consolidar migrations e resetar banco

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Delete: `apps/backend/prisma/migrations/20260523172321_init/`
- Delete: `apps/backend/prisma/migrations/20260525001012_apostas_globais/`
- Delete: `apps/backend/prisma/migrations/20260526040657_publicacao_ranking/`
- Delete: `apps/backend/prisma/migrations/20260527004035_bolao_favorito/`
- Delete: `apps/backend/prisma/migrations/20260528000000_simplify_bolao_status/`
- Create: `apps/backend/prisma/migrations/20260528000001_init/migration.sql`
- Modify: `apps/backend/src/bolao/bolao.service.ts`

- [ ] **Step 1: Atualizar schema.prisma**

Em `apps/backend/prisma/schema.prisma`, remover o enum `BolaoEscopo` e a coluna `escopo` do model `Bolao`. O schema resultante para as partes alteradas:

```prisma
// Remover este bloco inteiro:
// enum BolaoEscopo {
//   GRUPOS
//   ELIMINATORIAS
//   AMBOS
// }

model Bolao {
  id               String      @id @default(uuid())
  nome             String
  descricao        String?
  status           BolaoStatus @default(ATIVO)
  maxParticipantes Int
  precoReais       Decimal     @db.Decimal(10, 2)
  criadoPorId      String
  criadoPor        Usuario     @relation("BolaoCriador", fields: [criadoPorId], references: [id])
  criadoEm        DateTime    @default(now())

  membros       BolaoMembro[]
  convites      BolaoConvite[]
  rankings      Ranking[]
  favoritadoPor Usuario[]      @relation("UsuarioBolaoFavorito")

  @@map("bolao")
}
```

- [ ] **Step 2: Deletar as 5 migrations antigas**

```bash
rm -rf apps/backend/prisma/migrations/20260523172321_init
rm -rf apps/backend/prisma/migrations/20260525001012_apostas_globais
rm -rf apps/backend/prisma/migrations/20260526040657_publicacao_ranking
rm -rf apps/backend/prisma/migrations/20260527004035_bolao_favorito
rm -rf apps/backend/prisma/migrations/20260528000000_simplify_bolao_status
```

- [ ] **Step 3: Criar a migration consolidada**

Criar `apps/backend/prisma/migrations/20260528000001_init/migration.sql` com o conteúdo abaixo — este SQL representa o schema completo e definitivo, sem `BolaoEscopo` e com `BolaoStatus (ATIVO/INATIVO)`:

```sql
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "BolaoStatus" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "JogoFase" AS ENUM ('GRUPOS', 'OITAVAS', 'QUARTAS', 'SEMIS', 'TERCEIRO_LUGAR', 'FINAL');

-- CreateEnum
CREATE TYPE "BolaoMembroPapel" AS ENUM ('MODERADOR', 'PARTICIPANTE');

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT,
    "googleId" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "avatarUrl" TEXT,
    "emailVerificado" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bolaoFavoritoId" TEXT,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bolao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "BolaoStatus" NOT NULL DEFAULT 'ATIVO',
    "maxParticipantes" INTEGER NOT NULL,
    "precoReais" DECIMAL(10,2) NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bolao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bolao_membro" (
    "id" TEXT NOT NULL,
    "bolaoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "papel" "BolaoMembroPapel" NOT NULL DEFAULT 'PARTICIPANTE',
    "entrouEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bolao_membro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bolao_convite" (
    "id" TEXT NOT NULL,
    "bolaoId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3),

    CONSTRAINT "bolao_convite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "selecao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "bandeiraSvg" TEXT NOT NULL,
    "grupo" CHAR(1) NOT NULL,

    CONSTRAINT "selecao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estadio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "pais" TEXT NOT NULL,

    CONSTRAINT "estadio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publicacao" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "publicadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicadoPorId" TEXT NOT NULL,

    CONSTRAINT "publicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jogo" (
    "id" TEXT NOT NULL,
    "selecaoCasaId" TEXT NOT NULL,
    "selecaoVisitanteId" TEXT NOT NULL,
    "estadioId" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "rodada" INTEGER NOT NULL,
    "grupo" CHAR(1),
    "fase" "JogoFase" NOT NULL,
    "placarCasa" INTEGER,
    "placarVisitante" INTEGER,
    "pesoPontuacao" INTEGER NOT NULL DEFAULT 1,
    "publicacaoId" TEXT,

    CONSTRAINT "jogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aposta" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "jogoId" TEXT NOT NULL,
    "placarCasa" INTEGER NOT NULL,
    "placarVisitante" INTEGER NOT NULL,
    "pontuacao" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aposta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking" (
    "id" TEXT NOT NULL,
    "bolaoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "pontuacaoTotal" INTEGER NOT NULL DEFAULT 0,
    "acertosPlacarExato" INTEGER NOT NULL DEFAULT 0,
    "acertosPlacarVencedor" INTEGER NOT NULL DEFAULT 0,
    "acertosPlacarPerdedor" INTEGER NOT NULL DEFAULT 0,
    "acertosEmpate" INTEGER NOT NULL DEFAULT 0,
    "acertosGanhador" INTEGER NOT NULL DEFAULT 0,
    "acertosNada" INTEGER NOT NULL DEFAULT 0,
    "posicao" INTEGER NOT NULL DEFAULT 0,
    "apostasPostadas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ranking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracao_pontuacao" (
    "id" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "pontos" INTEGER NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "atualizadoPorId" TEXT,

    CONSTRAINT "configuracao_pontuacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacao_subscription" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacao_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_snapshot" (
    "id" TEXT NOT NULL,
    "publicacaoId" TEXT NOT NULL,
    "bolaoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "posicao" INTEGER NOT NULL,
    "posicoesGanhas" INTEGER NOT NULL DEFAULT 0,
    "pontuacaoTotal" INTEGER NOT NULL DEFAULT 0,
    "pontuacaoRodada" INTEGER NOT NULL DEFAULT 0,
    "acertosPlacarExato" INTEGER NOT NULL DEFAULT 0,
    "acertosPlacarVencedor" INTEGER NOT NULL DEFAULT 0,
    "acertosPlacarPerdedor" INTEGER NOT NULL DEFAULT 0,
    "acertosEmpate" INTEGER NOT NULL DEFAULT 0,
    "acertosGanhador" INTEGER NOT NULL DEFAULT 0,
    "acertosNada" INTEGER NOT NULL DEFAULT 0,
    "apostasPostadas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ranking_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_googleId_key" ON "usuario"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "bolao_membro_bolaoId_usuarioId_key" ON "bolao_membro"("bolaoId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "bolao_convite_token_key" ON "bolao_convite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "selecao_codigo_key" ON "selecao"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "estadio_nome_key" ON "estadio"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "publicacao_numero_key" ON "publicacao"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "aposta_usuarioId_jogoId_key" ON "aposta"("usuarioId", "jogoId");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_bolaoId_usuarioId_key" ON "ranking"("bolaoId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "configuracao_pontuacao_nivel_key" ON "configuracao_pontuacao"("nivel");

-- CreateIndex
CREATE UNIQUE INDEX "notificacao_subscription_endpoint_key" ON "notificacao_subscription"("endpoint");

-- CreateIndex
CREATE INDEX "ranking_snapshot_bolaoId_usuarioId_idx" ON "ranking_snapshot"("bolaoId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_snapshot_publicacaoId_bolaoId_usuarioId_key" ON "ranking_snapshot"("publicacaoId", "bolaoId", "usuarioId");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_bolaoFavoritoId_fkey" FOREIGN KEY ("bolaoFavoritoId") REFERENCES "bolao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bolao" ADD CONSTRAINT "bolao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bolao_membro" ADD CONSTRAINT "bolao_membro_bolaoId_fkey" FOREIGN KEY ("bolaoId") REFERENCES "bolao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bolao_membro" ADD CONSTRAINT "bolao_membro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bolao_convite" ADD CONSTRAINT "bolao_convite_bolaoId_fkey" FOREIGN KEY ("bolaoId") REFERENCES "bolao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bolao_convite" ADD CONSTRAINT "bolao_convite_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jogo" ADD CONSTRAINT "jogo_selecaoCasaId_fkey" FOREIGN KEY ("selecaoCasaId") REFERENCES "selecao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jogo" ADD CONSTRAINT "jogo_selecaoVisitanteId_fkey" FOREIGN KEY ("selecaoVisitanteId") REFERENCES "selecao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jogo" ADD CONSTRAINT "jogo_estadioId_fkey" FOREIGN KEY ("estadioId") REFERENCES "estadio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jogo" ADD CONSTRAINT "jogo_publicacaoId_fkey" FOREIGN KEY ("publicacaoId") REFERENCES "publicacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aposta" ADD CONSTRAINT "aposta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aposta" ADD CONSTRAINT "aposta_jogoId_fkey" FOREIGN KEY ("jogoId") REFERENCES "jogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking" ADD CONSTRAINT "ranking_bolaoId_fkey" FOREIGN KEY ("bolaoId") REFERENCES "bolao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking" ADD CONSTRAINT "ranking_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracao_pontuacao" ADD CONSTRAINT "configuracao_pontuacao_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacao_subscription" ADD CONSTRAINT "notificacao_subscription_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_publicadoPorId_fkey" FOREIGN KEY ("publicadoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_snapshot" ADD CONSTRAINT "ranking_snapshot_publicacaoId_fkey" FOREIGN KEY ("publicacaoId") REFERENCES "publicacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_snapshot" ADD CONSTRAINT "ranking_snapshot_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 4: Resetar banco com a migration consolidada**

```bash
cd apps/backend && pnpm prisma migrate reset --force 2>&1
```

Esperado: `1 migration found`, `Applying migration 20260528000001_init`, depois `Seed concluído: 16 estádios, 48 seleções, 72 jogos.`

- [ ] **Step 5: Remover `escopo` do select em bolao.service.ts**

Em `apps/backend/src/bolao/bolao.service.ts`, método `buscarPorNome`, atualizar o `select`:

```ts
  async buscarPorNome(nome: string) {
    return this.prisma.bolao.findMany({
      where: { nome: { contains: nome, mode: 'insensitive' }, status: BolaoStatus.ATIVO },
      select: { id: true, nome: true, descricao: true, _count: { select: { membros: true } } },
    });
  }
```

- [ ] **Step 6: Rodar typecheck do backend**

```bash
cd apps/backend && pnpm tsc --noEmit 2>&1 && echo "ok"
```

Esperado: `ok` sem erros.

- [ ] **Step 7: Rodar todos os specs do backend**

```bash
cd apps/backend && pnpm jest --no-coverage 2>&1
```

Esperado: 54 testes passando em 8 suites.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/prisma/schema.prisma \
  apps/backend/prisma/migrations/ \
  apps/backend/src/bolao/bolao.service.ts
git commit -m "feat(backend): remove BolaoEscopo from schema and consolidate migrations into single init"
```

---

## Verificação Final

- [ ] **Typecheck completo**

```bash
cd apps/backend && pnpm tsc --noEmit 2>&1 && echo "backend ok"
cd apps/frontend && pnpm tsc --noEmit 2>&1 && echo "frontend ok"
```

Esperado: `backend ok` e `frontend ok`.

- [ ] **Todos os testes**

```bash
cd apps/backend && pnpm jest --no-coverage 2>&1
```

Esperado: 54 testes, 8 suites, todos passando.
