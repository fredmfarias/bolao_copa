# Criar Bolão restrito a ADMIN com seletor de Moderador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restringir a criação de bolões a usuários ADMIN, exigir seleção de moderador no momento da criação, e mover o formulário para o painel admin.

**Architecture:** O endpoint `POST /boloes` recebe guard de role ADMIN; o `CreateBolaoDto` ganha `moderadorId` obrigatório; o `BolaoService.criar()` passa a adicionar apenas o `moderadorId` como membro MODERADOR, nunca o admin. No frontend, o formulário de criação sai de `/boloes/novo` e entra em `/admin/boloes` como form inline com `UserSearchInput` para autocomplete de usuário.

**Tech Stack:** NestJS + Prisma (backend), Next.js 14 App Router + Tailwind (frontend), Jest (testes backend)

---

## Mapa de arquivos

| Arquivo | Operação |
|---|---|
| `apps/backend/src/bolao/dto/create-bolao.dto.ts` | Modify — adiciona `moderadorId` |
| `apps/backend/src/bolao/bolao.controller.ts` | Modify — adiciona `RolesGuard + @Roles(ADMIN)` no `criar()` |
| `apps/backend/src/bolao/bolao.service.ts` | Modify — usa `dto.moderadorId` no lugar do `adminId` como membro |
| `apps/backend/src/bolao/bolao.service.spec.ts` | Modify — atualiza testes existentes + novos testes |
| `apps/backend/src/admin/admin.service.ts` | Modify — adiciona `buscarUsuarios(q)` |
| `apps/backend/src/admin/admin.controller.ts` | Modify — adiciona `GET /admin/usuarios/buscar` |
| `apps/backend/src/admin/admin.service.spec.ts` | Modify — adiciona testes para `buscarUsuarios` |
| `apps/frontend/src/types/api.ts` | Modify — adiciona `UserSearchResult` |
| `apps/frontend/src/components/UserSearchInput.tsx` | Create — autocomplete de usuário |
| `apps/frontend/src/app/admin/boloes/page.tsx` | Modify — adiciona formulário inline de criação |
| `apps/frontend/src/app/(app)/boloes/page.tsx` | Modify — remove botão e Link de criação |
| `apps/frontend/src/app/(app)/boloes/novo/page.tsx` | Delete |

---

## Task 1: Backend — DTO + Service + Controller guard

**Files:**
- Modify: `apps/backend/src/bolao/dto/create-bolao.dto.ts`
- Modify: `apps/backend/src/bolao/bolao.service.ts`
- Modify: `apps/backend/src/bolao/bolao.controller.ts`
- Modify: `apps/backend/src/bolao/bolao.service.spec.ts`

- [ ] **Step 1: Atualizar os testes existentes de `BolaoService.criar` para incluir `moderadorId` e adicionar novos testes**

Substitua o conteúdo de `apps/backend/src/bolao/bolao.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { BolaoService } from './bolao.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BolaoEscopo, BolaoMembroPapel } from '@bolao/shared';

const prismaMock = {
  bolao: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  bolaoMembro: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), update: jest.fn(), count: jest.fn(), deleteMany: jest.fn() },
  bolaoConvite: { findUnique: jest.fn(), create: jest.fn() },
  ranking: { create: jest.fn(), deleteMany: jest.fn() },
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
      service.criar('admin-1', { nome: 'Test', escopo: BolaoEscopo.AMBOS, maxParticipantes: 15, moderadorId: 'mod-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('criar calcula precoReais = maxParticipantes × 1', async () => {
    prismaMock.bolao.create.mockResolvedValue({ id: 'b1', maxParticipantes: 20, precoReais: 20 });
    prismaMock.bolaoMembro.create.mockResolvedValue({});
    prismaMock.ranking.create.mockResolvedValue({});
    await service.criar('admin-1', { nome: 'Test', escopo: BolaoEscopo.AMBOS, maxParticipantes: 20, moderadorId: 'mod-1' });
    expect(prismaMock.bolao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ precoReais: 20 }) }),
    );
  });

  it('criar usa moderadorId como membro MODERADOR, não adminId', async () => {
    prismaMock.bolao.create.mockResolvedValue({ id: 'b1', maxParticipantes: 10, precoReais: 10 });
    prismaMock.bolaoMembro.create.mockResolvedValue({});
    prismaMock.ranking.create.mockResolvedValue({});
    await service.criar('admin-1', { nome: 'Test', escopo: BolaoEscopo.AMBOS, maxParticipantes: 10, moderadorId: 'mod-1' });
    expect(prismaMock.bolaoMembro.create).toHaveBeenCalledWith({
      data: { bolaoId: 'b1', usuarioId: 'mod-1', papel: BolaoMembroPapel.MODERADOR },
    });
    expect(prismaMock.ranking.create).toHaveBeenCalledWith({
      data: { bolaoId: 'b1', usuarioId: 'mod-1' },
    });
  });

  it('criar não insere admin como membro nem no ranking', async () => {
    prismaMock.bolao.create.mockResolvedValue({ id: 'b1', maxParticipantes: 10, precoReais: 10 });
    prismaMock.bolaoMembro.create.mockResolvedValue({});
    prismaMock.ranking.create.mockResolvedValue({});
    await service.criar('admin-1', { nome: 'Test', escopo: BolaoEscopo.AMBOS, maxParticipantes: 10, moderadorId: 'mod-1' });
    expect(prismaMock.bolaoMembro.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.ranking.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.bolaoMembro.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ usuarioId: 'admin-1' }) }),
    );
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

- [ ] **Step 2: Executar os testes para confirmar que falham (service ainda não foi atualizado)**

```
pnpm --filter @bolao/backend test -- --testPathPattern=bolao.service
```

Esperado: FAIL nos testes `criar usa moderadorId` e `criar não insere admin`

- [ ] **Step 3: Adicionar `moderadorId` ao `CreateBolaoDto`**

Substitua o conteúdo de `apps/backend/src/bolao/dto/create-bolao.dto.ts`:

```ts
import { IsString, IsEnum, IsInt, Min, IsOptional } from 'class-validator';
import { BolaoEscopo } from '@bolao/shared';

export class CreateBolaoDto {
  @IsString()
  nome: string;

  @IsOptional() @IsString()
  descricao?: string;

  @IsEnum(BolaoEscopo)
  escopo: BolaoEscopo;

  @IsInt() @Min(10)
  maxParticipantes: number;

  @IsString()
  moderadorId: string;
}
```

- [ ] **Step 4: Atualizar `BolaoService.criar()` para usar `moderadorId`**

Em `apps/backend/src/bolao/bolao.service.ts`, substitua o método `criar`:

```ts
async criar(adminId: string, dto: CreateBolaoDto) {
  if (dto.maxParticipantes % 10 !== 0) {
    throw new BadRequestException('maxParticipantes deve ser múltiplo de 10.');
  }
  const precoReais = dto.maxParticipantes * 1;
  const { moderadorId, ...bolaoData } = dto;

  const bolao = await this.prisma.bolao.create({
    data: { ...bolaoData, precoReais, criadoPorId: adminId },
  });
  await this.prisma.bolaoMembro.create({
    data: { bolaoId: bolao.id, usuarioId: moderadorId, papel: BolaoMembroPapel.MODERADOR },
  });
  await this.prisma.ranking.create({ data: { bolaoId: bolao.id, usuarioId: moderadorId } });
  return bolao;
}
```

- [ ] **Step 5: Adicionar guard de role ADMIN ao endpoint `POST /boloes`**

Em `apps/backend/src/bolao/bolao.controller.ts`, substitua o método `criar`:

```ts
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@Post()
criar(@CurrentUser() user: { id: string }, @Body() dto: CreateBolaoDto) {
  return this.service.criar(user.id, dto);
}
```

`RolesGuard`, `Roles` e `Role` já estão importados no topo do arquivo.

- [ ] **Step 6: Executar os testes e confirmar que passam**

```
pnpm --filter @bolao/backend test -- --testPathPattern=bolao.service
```

Esperado: PASS em todos os 5 testes

- [ ] **Step 7: Commit**

```
git add apps/backend/src/bolao/dto/create-bolao.dto.ts \
        apps/backend/src/bolao/bolao.service.ts \
        apps/backend/src/bolao/bolao.controller.ts \
        apps/backend/src/bolao/bolao.service.spec.ts
git commit -m "feat(backend): restrict POST /boloes to ADMIN and require moderadorId"
```

---

## Task 2: Backend — Busca de usuários para autocomplete

**Files:**
- Modify: `apps/backend/src/admin/admin.service.ts`
- Modify: `apps/backend/src/admin/admin.controller.ts`
- Modify: `apps/backend/src/admin/admin.service.spec.ts`

- [ ] **Step 1: Escrever o teste para `AdminService.buscarUsuarios`**

No arquivo `apps/backend/src/admin/admin.service.spec.ts`, adicione o bloco abaixo antes do fechamento do `describe('AdminService')`:

```ts
describe('buscarUsuarios', () => {
  it('retorna usuários cujo nome ou email contém o termo (máx 10)', async () => {
    prismaMock.usuario.findMany.mockResolvedValue([
      { id: 'u1', nome: 'Alice', email: 'alice@x.com', avatarUrl: null },
    ]);
    const r = await service.buscarUsuarios('ali');
    expect(prismaMock.usuario.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { nome: { contains: 'ali', mode: 'insensitive' } },
          { email: { contains: 'ali', mode: 'insensitive' } },
        ],
      },
      select: { id: true, nome: true, email: true, avatarUrl: true },
      take: 10,
    });
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe('Alice');
  });
});
```

- [ ] **Step 2: Executar o teste para confirmar que falha**

```
pnpm --filter @bolao/backend test -- --testPathPattern=admin.service
```

Esperado: FAIL com `service.buscarUsuarios is not a function`

- [ ] **Step 3: Implementar `AdminService.buscarUsuarios`**

Em `apps/backend/src/admin/admin.service.ts`, adicione o método ao final da classe (antes do `}`):

```ts
async buscarUsuarios(q: string) {
  return this.prisma.usuario.findMany({
    where: {
      OR: [
        { nome: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, nome: true, email: true, avatarUrl: true },
    take: 10,
  });
}
```

- [ ] **Step 4: Adicionar `GET /admin/usuarios/buscar` ao `AdminController`**

Em `apps/backend/src/admin/admin.controller.ts`, adicione `Query` à linha de imports do `@nestjs/common`:

```ts
import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
```

Depois adicione o endpoint logo após `listarUsuarios()`:

```ts
@Get('usuarios/buscar')
buscarUsuarios(@Query('q') q: string) {
  return this.service.buscarUsuarios(q ?? '');
}
```

**Atenção:** este endpoint deve vir ANTES de `@Patch('usuarios/:id')` para o roteador não interpretar `buscar` como um `:id`.

- [ ] **Step 5: Executar os testes e confirmar que passam**

```
pnpm --filter @bolao/backend test -- --testPathPattern=admin.service
```

Esperado: PASS em todos os testes do AdminService

- [ ] **Step 6: Commit**

```
git add apps/backend/src/admin/admin.service.ts \
        apps/backend/src/admin/admin.controller.ts \
        apps/backend/src/admin/admin.service.spec.ts
git commit -m "feat(backend): add GET /admin/usuarios/buscar endpoint for user autocomplete"
```

---

## Task 3: Frontend — Tipo `UserSearchResult` + componente `UserSearchInput`

**Files:**
- Modify: `apps/frontend/src/types/api.ts`
- Create: `apps/frontend/src/components/UserSearchInput.tsx`

- [ ] **Step 1: Adicionar `UserSearchResult` a `types/api.ts`**

No final de `apps/frontend/src/types/api.ts`, adicione:

```ts
export interface UserSearchResult {
  id: string;
  nome: string;
  email: string;
  avatarUrl: string | null;
}
```

- [ ] **Step 2: Criar `UserSearchInput.tsx`**

Crie `apps/frontend/src/components/UserSearchInput.tsx` com o conteúdo:

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import type { UserSearchResult } from '@/types/api';

interface Props {
  value: { id: string; nome: string } | null;
  onChange: (user: { id: string; nome: string } | null) => void;
}

export function UserSearchInput({ value, onChange }: Props) {
  const [query, setQuery] = useState(value?.nome ?? '');
  const [sugestoes, setSugestoes] = useState<UserSearchResult[]>([]);
  const [aberto, setAberto] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.length < 2 || value) {
      setSugestoes([]);
      setAberto(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      const data = await api
        .get<UserSearchResult[]>(`/admin/usuarios/buscar?q=${encodeURIComponent(query)}`)
        .catch(() => []);
      setSugestoes(data);
      setAberto(data.length > 0);
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, value]);

  function selecionar(u: UserSearchResult) {
    onChange({ id: u.id, nome: u.nome });
    setQuery(u.nome);
    setSugestoes([]);
    setAberto(false);
  }

  function limpar() {
    onChange(null);
    setQuery('');
    setSugestoes([]);
    setAberto(false);
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); if (value) onChange(null); }}
          placeholder="Buscar por nome ou e-mail..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
        />
        {value && (
          <button type="button" onClick={limpar}
            className="text-gray-400 hover:text-white px-2 text-lg leading-none">
            ✕
          </button>
        )}
      </div>
      {aberto && sugestoes.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          {sugestoes.map(u => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => selecionar(u)}
                className="w-full text-left px-3 py-2 hover:bg-gray-700 text-sm">
                <span className="text-white">{u.nome}</span>
                <span className="text-gray-400 ml-2 text-xs">{u.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar typecheck**

```
pnpm --filter @bolao/frontend tsc --noEmit
```

Esperado: sem erros de tipo

- [ ] **Step 4: Commit**

```
git add apps/frontend/src/types/api.ts \
        apps/frontend/src/components/UserSearchInput.tsx
git commit -m "feat(frontend): add UserSearchInput autocomplete component"
```

---

## Task 4: Frontend — Formulário de criação no painel admin

**Files:**
- Modify: `apps/frontend/src/app/admin/boloes/page.tsx`

- [ ] **Step 1: Substituir `apps/frontend/src/app/admin/boloes/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { UserSearchInput } from '@/components/UserSearchInput';
import { BolaoEscopo } from '@bolao/shared';
import type { AdminBolao } from '@/types/api';

export default function AdminBoloesPage() {
  const [boloes, setBoloes] = useState<AdminBolao[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({
    nome: '', descricao: '', escopo: BolaoEscopo.AMBOS, maxParticipantes: 10,
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
      setForm({ nome: '', descricao: '', escopo: BolaoEscopo.AMBOS, maxParticipantes: 10 });
      setModerador(null);
      carregar();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar bolão.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(b: AdminBolao) {
    const novo = b.status === 'PAGO' ? 'ATIVO' : 'PAGO';
    await api.patch(`/boloes/${b.id}/status`, { status: novo }).catch(() => {});
    carregar();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Bolões</h1>
        <button
          onClick={() => { setCriando(v => !v); setErro(''); }}
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
            <label className="block text-xs text-gray-400 mb-1">Escopo</label>
            <select value={form.escopo} onChange={e => set('escopo', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
              {Object.values(BolaoEscopo).map(v => <option key={v} value={v}>{v}</option>)}
            </select>
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
                  b.status === 'PAGO'
                    ? 'bg-trovao-green/10 text-trovao-green border-trovao-green/40'
                    : 'bg-trovao-surface text-trovao-muted border-trovao-border hover:border-trovao-gold'}`}>
                {b.status === 'PAGO' ? 'Habilitado' : 'Habilitar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

```
pnpm --filter @bolao/frontend tsc --noEmit
```

Esperado: sem erros de tipo

- [ ] **Step 3: Commit**

```
git add apps/frontend/src/app/admin/boloes/page.tsx
git commit -m "feat(frontend): add create bolão form with moderator autocomplete in admin panel"
```

---

## Task 5: Frontend — Remover fluxo de criação da área de usuário comum

**Files:**
- Modify: `apps/frontend/src/app/(app)/boloes/page.tsx`
- Delete: `apps/frontend/src/app/(app)/boloes/novo/page.tsx`

- [ ] **Step 1: Remover o botão `+ Criar bolão` e o import de `Link` de `/boloes/page.tsx`**

Em `apps/frontend/src/app/(app)/boloes/page.tsx`:

1. Remova a linha de import do `Link`:
   ```ts
   import Link from 'next/link';
   ```

2. Substitua o bloco `<div className="flex items-center justify-between">` pelo bloco sem o botão:
   ```tsx
   <div className="flex items-center justify-between">
     <h1 className="text-xl font-bold">Meus Bolões</h1>
   </div>
   ```

- [ ] **Step 2: Deletar `/boloes/novo/page.tsx`**

```
git rm "apps/frontend/src/app/(app)/boloes/novo/page.tsx"
```

- [ ] **Step 3: Verificar typecheck**

```
pnpm --filter @bolao/frontend tsc --noEmit
```

Esperado: sem erros de tipo

- [ ] **Step 4: Commit**

```
git add apps/frontend/src/app/(app)/boloes/page.tsx
git commit -m "feat(frontend): remove create bolão flow from regular user area"
```

---

## Checklist de cobertura do spec

| Requisito | Task |
|---|---|
| `POST /boloes` restrito a ADMIN (403 para não-admins) | Task 1 |
| `moderadorId` obrigatório no DTO | Task 1 |
| `criar()` usa `moderadorId` como membro MODERADOR | Task 1 |
| Admin não é inserido como membro | Task 1 |
| `GET /admin/usuarios/buscar?q=` retorna até 10 resultados | Task 2 |
| Tipo `UserSearchResult` no frontend | Task 3 |
| Componente `UserSearchInput` com debounce 300ms, min 2 chars | Task 3 |
| Formulário de criação em `/admin/boloes` | Task 4 |
| Colapsa form e recarrega lista ao criar | Task 4 |
| Mensagem de erro inline | Task 4 |
| Botão `+ Criar bolão` removido de `/boloes` | Task 5 |
| Rota `/boloes/novo` deletada | Task 5 |
