# Padrão de Telas + Bolão Favorito — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar o padrão visual de seleção de bolão, introduzir bolão favorito persistido no banco com confirmação via Dialog, ajustar filtros/ordenação de jogos nas telas de bolão e admin, e reposicionar elementos de navegação.

**Architecture:** Backend: novo campo `bolaoFavoritoId` no model `Usuario` (FK nullable para `Bolao`) + endpoint `PATCH /usuarios/me/favorito` com validação de membership. Frontend: componente `BolaoCard` compartilhado com estrela de favorito e Dialog de confirmação; hrefs dinâmicos no `BottomNav`; filtro client-side de jogos encerrados em `/boloes/[id]` e `/admin/placares`.

**Tech Stack:** NestJS + Prisma (backend), Next.js 14 App Router + Tailwind (frontend), `@base-ui/react/dialog` para modal, `class-validator` para DTOs.

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `apps/backend/prisma/schema.prisma` | Modificar — campo `bolaoFavoritoId` em `Usuario`, relação em `Bolao` |
| `apps/backend/prisma/migrations/*/migration.sql` | Criar (gerado pelo Prisma) |
| `apps/backend/src/usuario/dto/update-favorito.dto.ts` | Criar |
| `apps/backend/src/usuario/usuario.service.ts` | Modificar — `perfil()` + `atualizarFavorito()` |
| `apps/backend/src/usuario/usuario.service.spec.ts` | Criar |
| `apps/backend/src/usuario/usuario.controller.ts` | Modificar — novo endpoint |
| `apps/frontend/src/types/api.ts` | Modificar — `bolaoFavoritoId` em `Usuario` |
| `apps/frontend/src/lib/jogoEstado.ts` | Modificar — exportar `prazoEncerrado` |
| `apps/frontend/src/components/JogoCard.tsx` | Modificar — prop `palpitesHref` |
| `apps/frontend/src/components/AdminTopNav.tsx` | Modificar — `← App` à direita |
| `apps/frontend/src/components/BolaoCard.tsx` | Criar |
| `apps/frontend/src/app/(app)/boloes/page.tsx` | Modificar — usar `BolaoCard` |
| `apps/frontend/src/app/(app)/ranking/page.tsx` | Modificar — redesenho com `BolaoCard` |
| `apps/frontend/src/components/BottomNav.tsx` | Modificar — hrefs dinâmicos |
| `apps/frontend/src/app/(app)/ranking/[bolaoId]/page.tsx` | Modificar — Voltar + pódio rodada |
| `apps/frontend/src/app/(app)/boloes/[id]/page.tsx` | Modificar — filtro + ordem + `palpitesHref` |
| `apps/frontend/src/app/admin/placares/page.tsx` | Modificar — filtro + ordem |

---

## Task 1: Backend — Schema Prisma + Migration

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

- [ ] **Adicionar campo `bolaoFavoritoId` ao model `Usuario`**

Em `apps/backend/prisma/schema.prisma`, no model `Usuario`, adicionar logo após o campo `criadoEm`:

```prisma
bolaoFavoritoId String?
bolaoFavorito   Bolao?  @relation("UsuarioBolaoFavorito", fields: [bolaoFavoritoId], references: [id])
```

O model `Usuario` completo fica:

```prisma
model Usuario {
  id              String    @id @default(uuid())
  nome            String
  email           String    @unique
  senhaHash       String?
  googleId        String?   @unique
  role            Role      @default(USER)
  avatarUrl       String?
  emailVerificado Boolean   @default(false)
  ativo           Boolean   @default(true)
  criadoEm        DateTime  @default(now())
  bolaoFavoritoId String?
  bolaoFavorito   Bolao?    @relation("UsuarioBolaoFavorito", fields: [bolaoFavoritoId], references: [id])

  membros          BolaoMembro[]
  apostas          Aposta[]
  rankings         Ranking[]
  boloesGeridos    Bolao[]                   @relation("BolaoCriador")
  convites         BolaoConvite[]
  subscriptions    NotificacaoSubscription[]
  configuracoes    ConfiguracaoPontuacao[]
  publicacoes      Publicacao[]
  rankingSnapshots RankingSnapshot[]

  @@map("usuario")
}
```

- [ ] **Adicionar relação inversa `favoritadoPor` ao model `Bolao`**

No model `Bolao`, adicionar após a linha `convites BolaoConvite[]`:

```prisma
favoritadoPor    Usuario[]  @relation("UsuarioBolaoFavorito")
```

- [ ] **Gerar e aplicar a migration**

```bash
pnpm db:migrate
```

Quando o Prisma pedir um nome para a migration, digitar: `bolao_favorito`

Expected: migration aplicada com sucesso, sem erros de conflito. O Prisma gera SQL do tipo:
```sql
ALTER TABLE "usuario" ADD COLUMN "bolaoFavoritoId" TEXT;
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_bolaoFavoritoId_fkey"
  FOREIGN KEY ("bolaoFavoritoId") REFERENCES "bolao"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Regenerar o Prisma Client**

```bash
pnpm --filter @bolao/backend exec prisma generate
```

- [ ] **Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations
git commit -m "feat(backend): adiciona bolaoFavoritoId ao model Usuario"
```

---

## Task 2: Backend — DTO + UsuarioService + Testes

**Files:**
- Create: `apps/backend/src/usuario/dto/update-favorito.dto.ts`
- Modify: `apps/backend/src/usuario/usuario.service.ts`
- Create: `apps/backend/src/usuario/usuario.service.spec.ts`

- [ ] **Criar o DTO `UpdateFavoritoDto`**

Criar `apps/backend/src/usuario/dto/update-favorito.dto.ts`:

```typescript
import { IsUUID, ValidateIf } from 'class-validator';

export class UpdateFavoritoDto {
  @ValidateIf(o => o.bolaoId !== null)
  @IsUUID()
  bolaoId: string | null;
}
```

- [ ] **Escrever os testes para `atualizarFavorito`**

Criar `apps/backend/src/usuario/usuario.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { UsuarioService } from './usuario.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';

const prismaMock = {
  usuario: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  bolaoMembro: {
    findUnique: jest.fn(),
  },
};

describe('UsuarioService', () => {
  let service: UsuarioService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsuarioService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(UsuarioService);
    jest.clearAllMocks();
  });

  describe('atualizarFavorito', () => {
    it('lança ForbiddenException se usuário não é membro do bolão', async () => {
      prismaMock.bolaoMembro.findUnique.mockResolvedValue(null);
      await expect(
        service.atualizarFavorito('user-1', 'bolao-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('persiste bolaoFavoritoId quando usuário é membro', async () => {
      prismaMock.bolaoMembro.findUnique.mockResolvedValue({ id: 'mb-1' });
      prismaMock.usuario.update.mockResolvedValue({
        id: 'user-1',
        bolaoFavoritoId: 'bolao-1',
      });
      await service.atualizarFavorito('user-1', 'bolao-1');
      expect(prismaMock.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { bolaoFavoritoId: 'bolao-1' },
          where: { id: 'user-1' },
        }),
      );
    });

    it('persiste bolaoFavoritoId como null sem checar membership', async () => {
      prismaMock.usuario.update.mockResolvedValue({
        id: 'user-1',
        bolaoFavoritoId: null,
      });
      await service.atualizarFavorito('user-1', null);
      expect(prismaMock.bolaoMembro.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { bolaoFavoritoId: null } }),
      );
    });
  });
});
```

- [ ] **Rodar os testes para confirmar que falham**

```bash
pnpm --filter @bolao/backend test -- --testPathPattern=usuario.service --no-coverage
```

Expected: FAIL — `service.atualizarFavorito is not a function`

- [ ] **Implementar as mudanças no `UsuarioService`**

Substituir o conteúdo de `apps/backend/src/usuario/usuario.service.ts`:

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@Injectable()
export class UsuarioService {
  constructor(private prisma: PrismaService) {}

  async perfil(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nome: true,
        email: true,
        avatarUrl: true,
        role: true,
        criadoEm: true,
        bolaoFavoritoId: true,
      },
    });
    if (!usuario) throw new NotFoundException();
    return usuario;
  }

  async atualizar(usuarioId: string, dto: UpdateUsuarioDto) {
    return this.prisma.usuario.update({
      where: { id: usuarioId },
      data: dto,
      select: { id: true, nome: true, email: true, avatarUrl: true },
    });
  }

  async atualizarFavorito(usuarioId: string, bolaoId: string | null) {
    if (bolaoId !== null) {
      const membro = await this.prisma.bolaoMembro.findUnique({
        where: { bolaoId_usuarioId: { bolaoId, usuarioId } },
      });
      if (!membro) throw new ForbiddenException('Você não é membro deste bolão.');
    }
    return this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { bolaoFavoritoId: bolaoId },
      select: {
        id: true,
        nome: true,
        email: true,
        avatarUrl: true,
        role: true,
        bolaoFavoritoId: true,
      },
    });
  }
}
```

- [ ] **Rodar os testes para confirmar que passam**

```bash
pnpm --filter @bolao/backend test -- --testPathPattern=usuario.service --no-coverage
```

Expected: PASS — 3 testes verdes

- [ ] **Commit**

```bash
git add apps/backend/src/usuario/
git commit -m "feat(backend): service atualizarFavorito + perfil inclui bolaoFavoritoId"
```

---

## Task 3: Backend — Controller (endpoint PATCH /usuarios/me/favorito)

**Files:**
- Modify: `apps/backend/src/usuario/usuario.controller.ts`

- [ ] **Adicionar o endpoint ao controller**

Substituir o conteúdo de `apps/backend/src/usuario/usuario.controller.ts`:

```typescript
import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuarioService } from './usuario.service';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UpdateFavoritoDto } from './dto/update-favorito.dto';

@UseGuards(JwtAuthGuard)
@Controller('usuarios')
export class UsuarioController {
  constructor(private service: UsuarioService) {}

  @Get('me')
  perfil(@CurrentUser() user: { id: string }) {
    return this.service.perfil(user.id);
  }

  @Patch('me')
  atualizar(@CurrentUser() user: { id: string }, @Body() dto: UpdateUsuarioDto) {
    return this.service.atualizar(user.id, dto);
  }

  @Patch('me/favorito')
  atualizarFavorito(@CurrentUser() user: { id: string }, @Body() dto: UpdateFavoritoDto) {
    return this.service.atualizarFavorito(user.id, dto.bolaoId);
  }
}
```

- [ ] **Verificar que o backend compila sem erros**

```bash
pnpm --filter @bolao/backend build
```

Expected: sem erros de TypeScript

- [ ] **Commit**

```bash
git add apps/backend/src/usuario/usuario.controller.ts apps/backend/src/usuario/dto/update-favorito.dto.ts
git commit -m "feat(backend): endpoint PATCH /usuarios/me/favorito"
```

---

## Task 4: Frontend — Tipos + `prazoEncerrado` em `jogoEstado`

**Files:**
- Modify: `apps/frontend/src/types/api.ts`
- Modify: `apps/frontend/src/lib/jogoEstado.ts`

- [ ] **Adicionar `bolaoFavoritoId` ao tipo `Usuario`**

Em `apps/frontend/src/types/api.ts`, adicionar `bolaoFavoritoId` na interface `Usuario`:

```typescript
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  avatarUrl: string | null;
  role: 'ADMIN' | 'USER';
  ativo?: boolean;
  criadoEm: string;
  bolaoFavoritoId?: string | null;
}
```

- [ ] **Exportar `prazoEncerrado` em `jogoEstado.ts`**

Substituir o conteúdo de `apps/frontend/src/lib/jogoEstado.ts`:

```typescript
import type { Jogo, Aposta } from '@/types/api';
import { MINUTOS_PRAZO_APOSTA } from '@bolao/shared';

export type EstadoAposta = 'aberto' | 'salvo' | 'incompleto' | 'fechado';
export type FiltroJogo = 'Todos' | 'Pendentes' | 'Apostados' | 'Encerrados';

export function prazoEncerrado(jogo: Jogo): boolean {
  const prazo = new Date(jogo.dataHora).getTime() - MINUTOS_PRAZO_APOSTA * 60 * 1000;
  return Date.now() >= prazo;
}

export function getEstadoAposta(jogo: Jogo, aposta?: Aposta): EstadoAposta {
  const estaFechado = prazoEncerrado(jogo);
  if (!estaFechado && !aposta) return 'aberto';
  if (!estaFechado && aposta) return 'salvo';
  if (estaFechado && aposta) return 'fechado';
  return 'incompleto';
}

export function jogoNoFiltro(estado: EstadoAposta, filtro: FiltroJogo): boolean {
  switch (filtro) {
    case 'Todos':
      return true;
    case 'Pendentes':
      return estado === 'aberto';
    case 'Apostados':
      return estado === 'salvo';
    case 'Encerrados':
      return estado === 'fechado' || estado === 'incompleto';
  }
}

export function ordenarPorFiltro(jogos: Jogo[], filtro: FiltroJogo): Jogo[] {
  const ordenado = [...jogos].sort(
    (a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime(),
  );
  return filtro === 'Encerrados' ? ordenado.reverse() : ordenado;
}

export function formatDataAposta(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
```

- [ ] **Commit**

```bash
git add apps/frontend/src/types/api.ts apps/frontend/src/lib/jogoEstado.ts
git commit -m "feat(frontend): bolaoFavoritoId no tipo Usuario + exportar prazoEncerrado"
```

---

## Task 5: Frontend — `JogoCard` (prop `palpitesHref`)

**Files:**
- Modify: `apps/frontend/src/components/JogoCard.tsx`

- [ ] **Adicionar `import Link` e prop `palpitesHref`**

Substituir o conteúdo de `apps/frontend/src/components/JogoCard.tsx`:

```typescript
import Link from 'next/link';
import type { Jogo, Aposta } from '@/types/api';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';
import { ScoreDisplay } from '@/components/ScoreDisplay';
import { getEstadoAposta, formatDataAposta, type EstadoAposta } from '@/lib/jogoEstado';

const ESTADO_BORDER: Record<EstadoAposta, string> = {
  aberto:    'border-trovao-border hover:border-trovao-green/40',
  salvo:     'border-trovao-green',
  incompleto:'border-trovao-border opacity-60',
  fechado:   'border-trovao-border opacity-60',
};

const PESO_BADGE: Record<number, string> = {
  1: 'bg-trovao-surface text-trovao-muted',
  2: 'bg-trovao-green text-trovao-base',
  3: 'bg-trovao-gold text-trovao-base',
  4: 'bg-trovao-red text-white',
};

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

interface JogoCardProps {
  jogo: Jogo;
  aposta?: Aposta;
  onApostar?: () => void;
  palpitesHref?: string;
}

export function JogoCard({ jogo, aposta, onApostar, palpitesHref }: JogoCardProps) {
  const estado = getEstadoAposta(jogo, aposta);
  const temResultado = jogo.placarCasa !== null && jogo.placarVisitante !== null;

  return (
    <div className={`bg-trovao-card border rounded-xl p-4 space-y-2 transition-colors ${ESTADO_BORDER[estado]}`}>
      {/* Header: título + peso + hora + palpites */}
      <div className="flex justify-between items-center gap-2">
        <p className="flex-1 text-xs font-semibold uppercase tracking-wide text-white/90 leading-tight">
          {jogo.selecaoCasa.nome} × {jogo.selecaoVisitante.nome}
        </p>
        <div className="flex items-center gap-2 text-xs text-trovao-muted shrink-0">
          {palpitesHref && (
            <Link
              href={palpitesHref}
              className="text-trovao-gold text-[10px] font-bold hover:underline shrink-0"
            >
              Palpites →
            </Link>
          )}
          <span
            title={`Esse jogo tem peso ×${jogo.pesoPontuacao}`}
            className={`cursor-help rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              PESO_BADGE[jogo.pesoPontuacao] ?? PESO_BADGE[4]
            }`}
          >
            ×{jogo.pesoPontuacao}
          </span>
          <span>{formatHora(jogo.dataHora)}</span>
        </div>
      </div>

      {/* Pílula fase/grupo/rodada */}
      <div className="flex justify-center">
        <span className="rounded-full bg-trovao-surface px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-trovao-muted">
          {jogo.fase}{jogo.grupo ? ` · Grupo ${jogo.grupo}` : ''} · R{jogo.rodada}
        </span>
      </div>

      {/* Times + palpite central */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col items-center gap-1 flex-1">
          <div className="rounded-md bg-trovao-surface p-1 ring-1 ring-trovao-border">
            <SelecaoAvatar nome={jogo.selecaoCasa.nome} bandeiraSvg={jogo.selecaoCasa.bandeiraSvg} size="lg" shape="rect" />
          </div>
          <p className="text-xs font-semibold text-white">{jogo.selecaoCasa.codigo}</p>
        </div>

        <div className="flex flex-col items-center gap-0.5 rounded-xl bg-trovao-surface px-3 py-2">
          <ScoreDisplay
            placarCasa={aposta?.placarCasa ?? null}
            placarVisitante={aposta?.placarVisitante ?? null}
          />
          <span className="text-trovao-muted text-[10px] uppercase tracking-wider">Palpite</span>
          {aposta && (
            <span className="text-trovao-muted text-[10px]">{formatDataAposta(aposta.atualizadoEm)}</span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 flex-1">
          <div className="rounded-md bg-trovao-surface p-1 ring-1 ring-trovao-border">
            <SelecaoAvatar nome={jogo.selecaoVisitante.nome} bandeiraSvg={jogo.selecaoVisitante.bandeiraSvg} size="lg" shape="rect" />
          </div>
          <p className="text-xs font-semibold text-white">{jogo.selecaoVisitante.codigo}</p>
        </div>
      </div>

      {/* Rodapé: placar real do jogo e/ou pontuação */}
      {(temResultado || aposta?.pontuacao != null) && (
        <div className="border-t border-trovao-border pt-2 flex items-center justify-between text-xs">
          <span className="text-trovao-muted">Placar:</span>
          <span className="text-white font-mono font-semibold">
            {temResultado ? `${jogo.placarCasa} × ${jogo.placarVisitante}` : '—'}
          </span>
          {aposta?.pontuacao != null && (
            <span className="text-trovao-gold font-bold">+{aposta.pontuacao} pts</span>
          )}
        </div>
      )}

      {/* Botão de aposta */}
      {(estado === 'aberto' || estado === 'salvo') && onApostar && (
        <button
          onClick={onApostar}
          className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${
            estado === 'salvo'
              ? 'bg-trovao-surface text-trovao-green border border-trovao-green hover:bg-trovao-green/10'
              : 'bg-trovao-gold text-trovao-base hover:bg-trovao-gold/90'
          }`}
        >
          {estado === 'salvo' ? 'Editar palpite' : 'Apostar'}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add apps/frontend/src/components/JogoCard.tsx
git commit -m "feat(frontend): JogoCard aceita prop palpitesHref no header"
```

---

## Task 6: Frontend — `AdminTopNav` (link "← App" à direita)

**Files:**
- Modify: `apps/frontend/src/components/AdminTopNav.tsx`

- [ ] **Mover o link "← App" para depois dos itens de nav**

Substituir o conteúdo de `apps/frontend/src/components/AdminTopNav.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/admin/boloes',   label: 'Bolões' },
  { href: '/admin/placares', label: 'Placares' },
  { href: '/admin/ranking',  label: 'Ranking' },
  { href: '/admin/usuarios', label: 'Usuários' },
] as const;

export function AdminTopNav() {
  const pathname = usePathname();
  return (
    <nav className="bg-trovao-card border-b border-trovao-border px-4">
      <div className="max-w-2xl mx-auto flex items-center gap-1 h-12">
        <span className="text-trovao-gold font-bold text-sm mr-4">Admin</span>
        {NAV.map(({ href, label }) => (
          <Link key={href} href={href}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              pathname.startsWith(href)
                ? 'bg-trovao-gold text-trovao-base'
                : 'text-trovao-muted hover:text-white'
            }`}>
            {label}
          </Link>
        ))}
        <Link href="/jogos" className="ml-auto text-trovao-muted text-xs hover:text-white">
          ← App
        </Link>
      </div>
    </nav>
  );
}
```

- [ ] **Commit**

```bash
git add apps/frontend/src/components/AdminTopNav.tsx
git commit -m "feat(frontend): move link App para direita no AdminTopNav"
```

---

## Task 7: Frontend — Componente `BolaoCard`

**Files:**
- Create: `apps/frontend/src/components/BolaoCard.tsx`

- [ ] **Criar o componente `BolaoCard`**

Criar `apps/frontend/src/components/BolaoCard.tsx`:

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Bolao } from '@/types/api';

interface BolaoCardProps {
  bolao: Bolao;
  href: string;
  favoritoId?: string | null;
  onFavoritoChange?: () => void;
}

export function BolaoCard({ bolao, href, favoritoId, onFavoritoChange }: BolaoCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const isFavorito = bolao.id === favoritoId;

  async function confirmarFavorito() {
    setSalvando(true);
    try {
      await api.patch('/usuarios/me/favorito', { bolaoId: bolao.id });
      setConfirmOpen(false);
      onFavoritoChange?.();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div className="relative bg-trovao-card border border-trovao-border rounded-xl hover:border-trovao-gold/50 transition-colors">
        <Link href={href} className={`block p-4 ${onFavoritoChange ? 'pr-12' : ''}`}>
          <p className="font-semibold text-white">{bolao.nome}</p>
          {bolao.descricao && (
            <p className="text-sm text-trovao-muted mt-0.5 truncate">{bolao.descricao}</p>
          )}
          <p className="text-xs text-trovao-muted mt-2">
            {bolao._count?.membros ?? 0} / {bolao.maxParticipantes ?? '?'} participantes
          </p>
        </Link>
        {onFavoritoChange && (
          <button
            onClick={() => setConfirmOpen(true)}
            aria-label={isFavorito ? 'Bolão favorito' : 'Definir como favorito'}
            className="absolute top-4 right-4 text-xl leading-none transition-colors"
          >
            <span className={isFavorito ? 'text-trovao-gold' : 'text-trovao-muted hover:text-trovao-gold'}>
              {isFavorito ? '★' : '☆'}
            </span>
          </button>
        )}
      </div>

      {onFavoritoChange && (
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>★ Definir bolão favorito</DialogTitle>
              <DialogDescription>
                "{bolao.nome}" será seu bolão padrão nos menus Bolões e Ranking.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancelar
              </DialogClose>
              <Button
                onClick={confirmarFavorito}
                disabled={salvando}
                className="bg-trovao-gold text-trovao-base font-bold hover:bg-trovao-gold/90"
              >
                {salvando ? 'Salvando...' : 'Confirmar ★'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
```

- [ ] **Commit**

```bash
git add apps/frontend/src/components/BolaoCard.tsx
git commit -m "feat(frontend): componente BolaoCard com estrela favorito e Dialog"
```

---

## Task 8: Frontend — `/boloes/page.tsx` (usar `BolaoCard`)

**Files:**
- Modify: `apps/frontend/src/app/(app)/boloes/page.tsx`

- [ ] **Substituir `BolaoItem` por `BolaoCard` e adicionar `useAuth`**

Substituir o conteúdo de `apps/frontend/src/app/(app)/boloes/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { BolaoCard } from '@/components/BolaoCard';
import type { Bolao } from '@/types/api';

export default function BolaoesPage() {
  const { user, refresh } = useAuth();
  const [meus, setMeus] = useState<Bolao[]>([]);
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Bolao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Bolao[]>('/boloes/meus')
      .then(setMeus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleBusca(e: React.FormEvent) {
    e.preventDefault();
    if (!busca.trim()) return;
    const data = await api.get<Bolao[]>(`/boloes/buscar?nome=${encodeURIComponent(busca)}`).catch(() => []);
    setResultados(data);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Meus Bolões</h1>
        <Link href="/boloes/novo"
          className="bg-yellow-400 text-gray-900 font-bold px-4 py-2 rounded-lg text-sm hover:bg-yellow-300">
          + Criar bolão
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500 text-center">Carregando...</p>
      ) : meus.length === 0 ? (
        <p className="text-gray-500 text-center">Você ainda não participa de nenhum bolão privado.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {meus.map(b => (
            <BolaoCard
              key={b.id}
              bolao={b}
              href={`/boloes/${b.id}`}
              favoritoId={user?.bolaoFavoritoId}
              onFavoritoChange={refresh}
            />
          ))}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Buscar bolão</h2>
        <form onSubmit={handleBusca} className="flex gap-2">
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome do bolão"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400" />
          <button type="submit"
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm">Buscar</button>
        </form>
        {resultados.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {resultados.map(b => (
              <BolaoCard
                key={b.id}
                bolao={b}
                href={`/boloes/${b.id}`}
                favoritoId={user?.bolaoFavoritoId}
                onFavoritoChange={refresh}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add apps/frontend/src/app/\(app\)/boloes/page.tsx
git commit -m "feat(frontend): /boloes usa BolaoCard com estrela de favorito"
```

---

## Task 9: Frontend — `/ranking/page.tsx` (redesenho com `BolaoCard`)

**Files:**
- Modify: `apps/frontend/src/app/(app)/ranking/page.tsx`

- [ ] **Redesenhar a página de índice de ranking**

Substituir o conteúdo de `apps/frontend/src/app/(app)/ranking/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { BolaoCard } from '@/components/BolaoCard';
import { PageSkeleton } from '@/components/PageSkeleton';
import { BOLAO_GLOBAL_ID } from '@bolao/shared';
import type { Bolao } from '@/types/api';

export default function RankingIndexPage() {
  const { user, refresh } = useAuth();
  const [boloes, setBoloes] = useState<Bolao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Bolao[]>('/boloes/meus')
      .then(setBoloes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  const global = boloes.find(b => b.id === BOLAO_GLOBAL_ID);
  const privados = boloes.filter(b => b.id !== BOLAO_GLOBAL_ID);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Ranking</h1>
      <div className="space-y-3">
        {global && (
          <BolaoCard
            bolao={{ ...global, nome: 'Global' }}
            href={`/ranking/${BOLAO_GLOBAL_ID}`}
          />
        )}
        {privados.length === 0 ? (
          <p className="text-trovao-muted text-sm px-1">Você não participa de nenhum bolão privado.</p>
        ) : (
          privados.map(b => (
            <BolaoCard
              key={b.id}
              bolao={b}
              href={`/ranking/${b.id}`}
              favoritoId={user?.bolaoFavoritoId}
              onFavoritoChange={refresh}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add apps/frontend/src/app/\(app\)/ranking/page.tsx
git commit -m "feat(frontend): /ranking usa BolaoCard com estrela de favorito"
```

---

## Task 10: Frontend — `BottomNav` (hrefs dinâmicos)

**Files:**
- Modify: `apps/frontend/src/components/BottomNav.tsx`

- [ ] **Calcular hrefs com base no bolão favorito**

Substituir o conteúdo de `apps/frontend/src/components/BottomNav.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Trophy, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const hrefBoloes  = user?.bolaoFavoritoId ? `/boloes/${user.bolaoFavoritoId}`  : '/boloes';
  const hrefRanking = user?.bolaoFavoritoId ? `/ranking/${user.bolaoFavoritoId}` : '/ranking';

  const NAV_ITEMS = [
    { href: '/jogos',    baseHref: '/jogos',    icon: Home,   label: 'Jogos'   },
    { href: hrefBoloes,  baseHref: '/boloes',   icon: Users,  label: 'Bolões'  },
    { href: hrefRanking, baseHref: '/ranking',  icon: Trophy, label: 'Ranking' },
    { href: '/perfil',   baseHref: '/perfil',   icon: User,   label: 'Perfil'  },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-trovao-card border-t border-trovao-border z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {NAV_ITEMS.map(({ href, baseHref, icon: Icon, label }) => {
          const active = pathname.startsWith(baseHref);
          return (
            <Link
              key={baseHref}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                active ? 'text-trovao-gold' : 'text-trovao-muted hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
        {user?.role === 'ADMIN' && (
          <Link
            href="/admin/boloes"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
              pathname.startsWith('/admin') ? 'text-trovao-gold' : 'text-trovao-muted hover:text-white'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[10px] font-medium">Admin</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
```

- [ ] **Commit**

```bash
git add apps/frontend/src/components/BottomNav.tsx
git commit -m "feat(frontend): BottomNav navega direto ao bolão favorito"
```

---

## Task 11: Frontend — `/ranking/[bolaoId]` (Voltar → `/ranking` + pódio da rodada)

**Files:**
- Modify: `apps/frontend/src/app/(app)/ranking/[bolaoId]/page.tsx`

- [ ] **Corrigir "← Voltar" e adicionar pódio na aba Rodada**

Substituir o conteúdo de `apps/frontend/src/app/(app)/ranking/[bolaoId]/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { RankingPodium } from '@/components/RankingPodium';
import { RankingRow } from '@/components/RankingRow';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import type { RankingEntry, PublicacaoResumo } from '@/types/api';

type Aba = 'geral' | 'rodada';

export default function RankingPage() {
  const { bolaoId } = useParams<{ bolaoId: string }>();
  const { user } = useAuth();
  const [aba, setAba] = useState<Aba>('geral');
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [publicacoes, setPublicacoes] = useState<PublicacaoResumo[]>([]);
  const [publicacaoSel, setPublicacaoSel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<RankingEntry[]>(`/boloes/${bolaoId}/ranking`).catch(() => [] as RankingEntry[]),
      api.get<PublicacaoResumo[]>(`/boloes/${bolaoId}/ranking/publicacoes`).catch(() => [] as PublicacaoResumo[]),
    ]).then(([r, pubs]) => {
      setRanking(r);
      setPublicacoes(pubs);
      setPublicacaoSel(pubs[0]?.numero ?? null);
      setLoading(false);
    });
  }, [bolaoId]);

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
        <Link href="/ranking" className="text-trovao-muted text-sm hover:text-white">← Voltar</Link>
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
            <RankingPodium ranking={ordenado} myId={user?.id} />
          )}

          {aba === 'rodada' && (
            <RankingPodium
              ranking={ordenado.map(e => ({ ...e, pontuacaoTotal: e.pontuacaoRodada }))}
              myId={user?.id}
            />
          )}

          <div className="space-y-2 mt-4">
            {ordenado.map((entry) => (
              <RankingRow
                key={entry.id}
                entry={aba === 'rodada'
                  ? { ...entry, pontuacaoTotal: entry.pontuacaoRodada, posicoesGanhas: 0 }
                  : entry}
                myId={user?.id}
                bolaoId={bolaoId}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add apps/frontend/src/app/\(app\)/ranking/\[bolaoId\]/page.tsx
git commit -m "feat(frontend): ranking Voltar vai para /ranking + pódio na aba Rodada"
```

---

## Task 12: Frontend — `/boloes/[id]/page.tsx` (filtro + ordenação + `palpitesHref`)

**Files:**
- Modify: `apps/frontend/src/app/(app)/boloes/[id]/page.tsx`

- [ ] **Aplicar filtro, ordenação e prop `palpitesHref`**

Substituir o conteúdo de `apps/frontend/src/app/(app)/boloes/[id]/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { JogoCard } from '@/components/JogoCard';
import { ModeradorPanel } from '@/components/ModeradorPanel';
import { ConvitePanel } from '@/components/ConvitePanel';
import { prazoEncerrado } from '@/lib/jogoEstado';
import type { Bolao, Jogo, Aposta } from '@/types/api';

function ordenarJogosEncerrados(jogos: Jogo[]): Jogo[] {
  return [...jogos]
    .filter(prazoEncerrado)
    .sort((a, b) => {
      const aTemPlacar = a.placarCasa !== null;
      const bTemPlacar = b.placarCasa !== null;
      if (aTemPlacar !== bTemPlacar) return aTemPlacar ? 1 : -1;
      const diff = new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime();
      return aTemPlacar ? -diff : diff;
    });
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
  const jogosEncerrados = ordenarJogosEncerrados(jogos);

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
        {jogosEncerrados.length === 0 ? (
          <p className="text-trovao-muted text-sm">Nenhum jogo encerrado ainda.</p>
        ) : (
          <div className="space-y-3">
            {jogosEncerrados.map(jogo => (
              <JogoCard
                key={jogo.id}
                jogo={jogo}
                aposta={apostas.get(jogo.id)}
                palpitesHref={`/boloes/${id}/palpites/${jogo.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add apps/frontend/src/app/\(app\)/boloes/\[id\]/page.tsx
git commit -m "feat(frontend): /boloes/[id] filtra jogos encerrados com ordem e link Palpites"
```

---

## Task 13: Frontend — `/admin/placares/page.tsx` (filtro + ordenação)

**Files:**
- Modify: `apps/frontend/src/app/admin/placares/page.tsx`

- [ ] **Aplicar filtro e ordenação client-side**

Substituir o conteúdo de `apps/frontend/src/app/admin/placares/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { prazoEncerrado } from '@/lib/jogoEstado';
import { AdminPlacardCard } from '@/components/AdminPlacardCard';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import type { Jogo } from '@/types/api';

function ordenarJogosAdmin(jogos: Jogo[]): Jogo[] {
  return [...jogos]
    .filter(prazoEncerrado)
    .sort((a, b) => {
      const aTemPlacar = a.placarCasa !== null;
      const bTemPlacar = b.placarCasa !== null;
      if (aTemPlacar !== bTemPlacar) return aTemPlacar ? 1 : -1;
      const diff = new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime();
      return aTemPlacar ? -diff : diff;
    });
}

export default function AdminPlacaresPage() {
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    const data = await api.get<Jogo[]>('/jogos').catch(() => [] as Jogo[]);
    setJogos(data);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  const jogosOrdenados = ordenarJogosAdmin(jogos);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Placares</h1>
      {loading ? <PageSkeleton /> : jogosOrdenados.length === 0 ? (
        <EmptyState titulo="Nenhum jogo encerrado" />
      ) : (
        <div className="space-y-3">
          {jogosOrdenados.map(jogo => (
            <AdminPlacardCard key={jogo.id} jogo={jogo} onSalvo={carregar} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Commit final**

```bash
git add apps/frontend/src/app/admin/placares/page.tsx
git commit -m "feat(frontend): admin/placares filtra encerrados com ordem por placar"
```

---

## Self-review checklist

- [x] **Spec § 1.1** Schema + migration → Task 1
- [x] **Spec § 1.2** `PATCH /usuarios/me/favorito` + `GET /usuarios/me` inclui `bolaoFavoritoId` → Tasks 2, 3
- [x] **Spec § 1.3** `bolaoFavoritoId` no tipo `Usuario` → Task 4
- [x] **Spec § 1.4** `BolaoCard` com `href`, `favoritoId`, `onFavoritoChange` → Task 7
- [x] **Spec § 1.5** Dialog de confirmação dentro de `BolaoCard` → Task 7
- [x] **Spec § 2.1** `/boloes/page.tsx` com `BolaoCard` em meus + busca → Task 8
- [x] **Spec § 2.2** `/ranking/page.tsx` redesenho, global sem estrela → Task 9
- [x] **Spec § 3** `BottomNav` hrefs dinâmicos, `active` por `baseHref` → Task 10
- [x] **Spec § 4.1** `← Voltar` → `/ranking` → Task 11
- [x] **Spec § 4.2** Pódio na aba Rodada com `pontuacaoRodada` → Task 11
- [x] **Spec § 5** `JogoCard` prop `palpitesHref` no header → Task 5
- [x] **Spec § 6** `/boloes/[id]` filtro encerrados + ordenação + `palpitesHref` → Task 12
- [x] **Spec § 7** `/admin/placares` filtro encerrados + ordenação, `prazoEncerrado` centralizado → Tasks 4, 13
- [x] **Spec § 8** `AdminTopNav` `← App` com `ml-auto` à direita → Task 6
