# Mobile Fixes e Logos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir dois overflows de layout no mobile (AdminTopNav e ModeradorPanel) e integrar as imagens de marca (favicon, logos) com uso do logo na tela de login.

**Architecture:** Mudanças puramente de UI em três componentes e um page. Os assets (favicon, logos) são movidos para os locais que o Next.js App Router reconhece automaticamente. Nenhum dado, API ou estado é alterado.

**Tech Stack:** Next.js 14 (App Router), React 18, Tailwind CSS, Jest + Testing Library

---

## File Map

| Arquivo | Ação |
|---|---|
| `favicon.ico` (raiz do repo) | Mover → `apps/frontend/src/app/favicon.ico` |
| `logo_bolao.png` (raiz do repo) | Mover → `apps/frontend/public/logo_bolao.png` |
| `logo_site.png` (raiz do repo) | Mover → `apps/frontend/public/logo_site.png` |
| `apps/frontend/src/components/AdminTopNav.tsx` | Modificar — sandwich layout |
| `apps/frontend/src/components/ModeradorPanel.tsx` | Modificar — flex-wrap com grupos |
| `apps/frontend/src/app/(auth)/login/page.tsx` | Modificar — Image em vez de h1 texto |
| `apps/frontend/src/__tests__/AdminTopNav.test.tsx` | Criar — testes novos |
| `apps/frontend/src/__tests__/LoginPage.test.tsx` | Modificar — adicionar teste do logo |

---

### Task 1: Mover assets de marca para locais do Next.js

**Files:**
- Move: `favicon.ico` → `apps/frontend/src/app/favicon.ico`
- Move: `logo_bolao.png` → `apps/frontend/public/logo_bolao.png`
- Move: `logo_site.png` → `apps/frontend/public/logo_site.png`

- [ ] **Step 1: Mover os três arquivos**

Execute no diretório raiz do repositório:

```powershell
Move-Item favicon.ico apps\frontend\src\app\favicon.ico
Move-Item logo_bolao.png apps\frontend\public\logo_bolao.png
Move-Item logo_site.png apps\frontend\public\logo_site.png
```

- [ ] **Step 2: Verificar que os arquivos estão nos destinos**

```powershell
Test-Path apps\frontend\src\app\favicon.ico
Test-Path apps\frontend\public\logo_bolao.png
Test-Path apps\frontend\public\logo_site.png
```

Expected: três linhas `True`.

- [ ] **Step 3: Commit**

```bash
# Stage os novos destinos
git add apps/frontend/src/app/favicon.ico apps/frontend/public/logo_bolao.png apps/frontend/public/logo_site.png
# Remove os originais da raiz do índice git (ignora erro se nunca foram rastreados)
git rm --cached favicon.ico logo_bolao.png logo_site.png 2>$null; $true
git commit -m "feat: mover assets de marca para locais do Next.js"
```

---

### Task 2: Corrigir AdminTopNav — sandwich layout no mobile

**Files:**
- Modify: `apps/frontend/src/components/AdminTopNav.tsx`
- Create: `apps/frontend/src/__tests__/AdminTopNav.test.tsx`

O problema: `flex items-center gap-1` com todos os itens em linha — "← App" usa `ml-auto` e fica fora da viewport no mobile.

A solução: "Admin" e "← App" ficam fixos com `shrink-0` nas extremidades. Os links de nav ficam num `div` com `flex-1 overflow-x-auto`, scrollável entre os dois.

- [ ] **Step 1: Escrever o teste (vai falhar por enquanto)**

Criar `apps/frontend/src/__tests__/AdminTopNav.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { AdminTopNav } from '@/components/AdminTopNav';

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin/boloes',
}));

it('renderiza link de volta ao app apontando para /jogos', () => {
  render(<AdminTopNav />);
  const link = screen.getByRole('link', { name: /app/i });
  expect(link).toHaveAttribute('href', '/jogos');
});

it('destaca o link de nav ativo com bg-trovao-gold', () => {
  render(<AdminTopNav />);
  const boloes = screen.getByRole('link', { name: 'Bolões' });
  expect(boloes).toHaveClass('bg-trovao-gold');
});

it('links de nav não ativos não têm bg-trovao-gold', () => {
  render(<AdminTopNav />);
  const placares = screen.getByRole('link', { name: 'Placares' });
  expect(placares).not.toHaveClass('bg-trovao-gold');
});
```

- [ ] **Step 2: Rodar os testes para verificar que passam no componente original**

```bash
cd apps/frontend && npx jest AdminTopNav --no-coverage
```

Expected: 3 testes PASS. O overflow é visual (CSS), então os testes verificam comportamento/conteúdo — eles servem como regressão para garantir que o refactor não quebra nada.

- [ ] **Step 3: Reescrever AdminTopNav.tsx com o sandwich layout**

Substituir o conteúdo de `apps/frontend/src/components/AdminTopNav.tsx`:

```tsx
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
      <div className="max-w-2xl mx-auto flex items-center h-12 gap-2">
        <span className="text-trovao-gold font-bold text-sm shrink-0">Admin</span>
        <div className="flex items-center gap-1 flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                pathname.startsWith(href)
                  ? 'bg-trovao-gold text-trovao-base'
                  : 'text-trovao-muted hover:text-white'
              }`}>
              {label}
            </Link>
          ))}
        </div>
        <Link href="/jogos" className="shrink-0 ml-2 text-trovao-muted text-xs hover:text-white">
          ← App
        </Link>
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Rodar os testes para verificar que passam**

```bash
cd apps/frontend && npx jest AdminTopNav --no-coverage
```

Expected: 3 testes PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/AdminTopNav.tsx apps/frontend/src/__tests__/AdminTopNav.test.tsx
git commit -m "fix: AdminTopNav sandwich layout — link App sempre visível no mobile"
```

---

### Task 3: Corrigir ModeradorPanel — flex-wrap para mobile

**Files:**
- Modify: `apps/frontend/src/components/ModeradorPanel.tsx`

O problema: a linha de cada membro usa `flex items-center gap-3` com 5 elementos em sequência — no mobile, os botões extravasam o card.

A solução: agrupar avatar+nome num `div` esquerdo (`flex-1 min-w-0`) e todos os controles (badges + botões) num `div` direito (`shrink-0`). O container externo usa `flex-wrap`: quando a viewport é estreita, o grupo direito quebra para a segunda linha.

- [ ] **Step 1: Rodar os testes existentes para estabelecer baseline**

```bash
cd apps/frontend && npx jest ModeradorPanel --no-coverage
```

Expected: 4 testes PASS. Se algum falhar antes da mudança, pare e investigue.

- [ ] **Step 2: Substituir o bloco do map de membros em ModeradorPanel.tsx**

No arquivo `apps/frontend/src/components/ModeradorPanel.tsx`, substituir o `div` que começa em `{membros.slice(0, visiveis).map(m => (` até o fechamento do `</div>` do map (linha 47–90 aproximadamente) pelo código abaixo.

A estrutura do componente inteiro após a mudança:

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
        <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 bg-trovao-card border border-trovao-border rounded-xl">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {m.usuario.avatarUrl ? (
              <img src={m.usuario.avatarUrl} alt={m.usuario.nome} className="w-8 h-8 rounded-full flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-trovao-surface flex items-center justify-center text-xs font-bold text-trovao-muted flex-shrink-0">
                {m.usuario.nome.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-white text-sm truncate">{m.usuario.nome}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
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

- [ ] **Step 3: Rodar os testes para confirmar que continuam passando**

```bash
cd apps/frontend && npx jest ModeradorPanel --no-coverage
```

Expected: 4 testes PASS (comportamento preservado — só o layout mudou).

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/ModeradorPanel.tsx
git commit -m "fix: ModeradorPanel flex-wrap — botão Remover não extravasa no mobile"
```

---

### Task 4: Login page — substituir texto pelo logo

**Files:**
- Modify: `apps/frontend/src/app/(auth)/login/page.tsx`
- Modify: `apps/frontend/src/__tests__/LoginPage.test.tsx`

O `nextJest` (usado no `jest.config.ts`) mocka `next/image` automaticamente como um `<img>` padrão, preservando o atributo `alt`. Não é necessária nenhuma configuração adicional de mock.

- [ ] **Step 1: Adicionar teste do logo em LoginPage.test.tsx**

Abrir `apps/frontend/src/__tests__/LoginPage.test.tsx` e adicionar este teste ao final do arquivo (após o último `it(...)`):

```tsx
it('exibe o logo do Bolão Trovão', () => {
  render(<LoginPage />);
  const logo = screen.getByAltText('Bolão Trovão');
  expect(logo).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar o teste para verificar que falha**

```bash
cd apps/frontend && npx jest LoginPage --no-coverage
```

Expected: o novo teste FAIL com "Unable to find an element with alt text: Bolão Trovão". Os demais devem PASS.

- [ ] **Step 3: Atualizar login/page.tsx**

No arquivo `apps/frontend/src/app/(auth)/login/page.tsx`:

1. Adicionar import do `Image` do Next.js no topo (após os imports existentes):
```tsx
import Image from 'next/image';
```

2. Substituir a linha do `<h1>`:
```tsx
// Antes:
<h1 className="text-2xl font-bold text-center text-yellow-400">⚡ Bolão Trovão</h1>

// Depois:
<div className="flex justify-center">
  <Image
    src="/logo_bolao.png"
    alt="Bolão Trovão"
    width={176}
    height={176}
    className="h-auto w-44"
    priority
  />
</div>
```

- [ ] **Step 4: Rodar todos os testes da login page**

```bash
cd apps/frontend && npx jest LoginPage --no-coverage
```

Expected: 6 testes PASS (5 anteriores + o novo do logo).

- [ ] **Step 5: Commit**

```bash
git add "apps/frontend/src/app/(auth)/login/page.tsx" apps/frontend/src/__tests__/LoginPage.test.tsx
git commit -m "feat: substituir título de texto pelo logo na tela de login"
```

---

## Verificação final

- [ ] Rodar a suite completa do frontend:

```bash
cd apps/frontend && npx jest --no-coverage
```

Expected: todos os testes PASS.

- [ ] Checar visualmente no dev server (`npm run dev` em `apps/frontend`):
  - Mobile (~375px): AdminTopNav — "← App" visível sem arrastar
  - Mobile (~375px): Bolão detalhe como moderador — botões de membro não extravasam
  - Login page — logo aparece centrado acima do formulário
  - Browser tab — favicon do Bolão Trovão aparece
