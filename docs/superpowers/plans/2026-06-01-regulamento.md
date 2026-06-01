# Regulamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a public `/regulamento` page with the bolão rules in an accordion layout, accessible via a link on the login screen.

**Architecture:** Two new files (accordion UI wrapper + regulamento page) and one modified file (login page link). No backend calls — entirely static content rendered client-side. The accordion wraps `@base-ui/react/accordion`, following the same pattern as other `components/ui/*.tsx` files in the project.

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS, `@base-ui/react/accordion`, `navigator.clipboard`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/frontend/src/components/ui/accordion.tsx` | Create | shadcn-style wrapper for `@base-ui/react/accordion` |
| `apps/frontend/src/app/regulamento/page.tsx` | Create | Public regulamento page with 4 accordion sections |
| `apps/frontend/src/app/(auth)/login/page.tsx` | Modify | Add "Regulamento" link in the footer links block |

---

## Task 1: Accordion UI component

**Files:**
- Create: `apps/frontend/src/components/ui/accordion.tsx`
- Test: `apps/frontend/src/__tests__/accordion.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/src/__tests__/accordion.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
} from '@/components/ui/accordion';

describe('Accordion', () => {
  it('renders trigger text', () => {
    render(
      <Accordion>
        <AccordionItem value="a">
          <AccordionTrigger>Título</AccordionTrigger>
          <AccordionPanel>Conteúdo</AccordionPanel>
        </AccordionItem>
      </Accordion>
    );
    expect(screen.getByText('Título')).toBeInTheDocument();
  });

  it('shows panel content when trigger is clicked', async () => {
    render(
      <Accordion>
        <AccordionItem value="a">
          <AccordionTrigger>Título</AccordionTrigger>
          <AccordionPanel>Conteúdo</AccordionPanel>
        </AccordionItem>
      </Accordion>
    );
    await userEvent.click(screen.getByText('Título'));
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/frontend && npx jest src/__tests__/accordion.test.tsx --no-coverage
```

Expected: FAIL — "Cannot find module '@/components/ui/accordion'"

- [ ] **Step 3: Create the accordion component**

Create `apps/frontend/src/components/ui/accordion.tsx`:

```tsx
'use client';

import * as React from 'react';
import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

function Accordion({
  className,
  ...props
}: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn('w-full', className)}
      {...props}
    />
  );
}

function AccordionItem({
  className,
  ...props
}: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn('border-b border-gray-700', className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Header.Props) {
  return (
    <AccordionPrimitive.Header data-slot="accordion-header" className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          'flex flex-1 items-center justify-between py-4 text-left text-sm font-medium text-white transition-all hover:text-yellow-400 [&[data-panel-open]>svg]:rotate-180',
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="size-4 shrink-0 text-gray-400 transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionPanel({
  className,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-panel"
      className={cn('pb-4 text-sm text-gray-300', className)}
      {...props}
    />
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionPanel };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/frontend && npx jest src/__tests__/accordion.test.tsx --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/ui/accordion.tsx apps/frontend/src/__tests__/accordion.test.tsx
git commit -m "feat: accordion UI component wrapping @base-ui/react/accordion"
```

---

## Task 2: Regulamento page

**Files:**
- Create: `apps/frontend/src/app/regulamento/page.tsx`
- Test: `apps/frontend/src/__tests__/regulamento.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/src/__tests__/regulamento.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegulamentoPage from '@/app/regulamento/page';

Object.assign(navigator, {
  clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
});

describe('RegulamentoPage', () => {
  it('renders all four accordion section titles', () => {
    render(<RegulamentoPage />);
    expect(screen.getByText('Disposições Gerais')).toBeInTheDocument();
    expect(screen.getByText('Valor e Pagamento')).toBeInTheDocument();
    expect(screen.getByText('Sistema de Pontuação')).toBeInTheDocument();
    expect(screen.getByText('Premiação')).toBeInTheDocument();
  });

  it('copy button changes label to "Copiado!" and restores after 2s', async () => {
    jest.useFakeTimers();
    render(<RegulamentoPage />);

    const btn = screen.getByRole('button', { name: /copiar/i });
    await userEvent.click(btn);

    expect(screen.getByRole('button', { name: /copiado/i })).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('00020126730014BR.GOV.BCB.PIX')
    );

    act(() => jest.advanceTimersByTime(2000));
    expect(screen.getByRole('button', { name: /copiar/i })).toBeInTheDocument();

    jest.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/frontend && npx jest src/__tests__/regulamento.test.tsx --no-coverage
```

Expected: FAIL — "Cannot find module '@/app/regulamento/page'"

- [ ] **Step 3: Create the regulamento page**

Create `apps/frontend/src/app/regulamento/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
} from '@/components/ui/accordion';

const PIX_COPIA_COLA =
  '00020126730014BR.GOV.BCB.PIX0114+55839882698250233Inscrição Bolão Da Família Trovão520400005303986540550.005802BR5925Fred Augusto de Melo Fari6009SAO PAULO62140510b39ukQVYm66304DA4A';

export default function RegulamentoPage() {
  const [copiado, setCopiado] = useState(false);

  async function copiarPix() {
    await navigator.clipboard.writeText(PIX_COPIA_COLA);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-yellow-400">Regulamento</h1>
          <Link href="/login" className="text-sm text-gray-400 hover:text-white">
            Voltar ao login
          </Link>
        </div>

        <div className="rounded-xl bg-gray-900 px-6">
          <Accordion defaultValue={['disposicoes-gerais']}>

            {/* 1. Disposições Gerais */}
            <AccordionItem value="disposicoes-gerais">
              <AccordionTrigger>Disposições Gerais</AccordionTrigger>
              <AccordionPanel>
                <div className="space-y-3">
                  <p>
                    Este bolão tem intuito exclusivo de diversão e entretenimento entre amigos e
                    familiares, sem fins lucrativos.
                  </p>
                  <p>
                    Ao participar, o usuário aceita este regulamento e isenta os organizadores de
                    qualquer responsabilidade material ou moral.
                  </p>
                  <p>
                    É permitida uma aposta por jogo, podendo ser alterada quantas vezes desejar até{' '}
                    <strong className="text-white">1 hora antes</strong> do início da partida. O
                    sistema encerra as apostas automaticamente; nenhuma alteração é permitida após o
                    corte.
                  </p>
                  <p>
                    Os palpites dos demais participantes ficam visíveis{' '}
                    <strong className="text-white">somente após</strong> o encerramento das apostas
                    daquele jogo.
                  </p>
                  <p>
                    <strong className="text-white">Limite de apostas idênticas:</strong> máximo de{' '}
                    <strong className="text-white">18 apostas com o mesmo placar</strong> na fase de
                    grupos e <strong className="text-white">8</strong> na fase eliminatória por
                    usuário.
                  </p>
                  <p>
                    Participantes sem pagamento confirmado (nos bolões que cobram taxa) serão
                    removidos do bolão.
                  </p>
                </div>
              </AccordionPanel>
            </AccordionItem>

            {/* 2. Valor e Pagamento */}
            <AccordionItem value="valor-pagamento">
              <AccordionTrigger>Valor e Pagamento</AccordionTrigger>
              <AccordionPanel>
                <div className="space-y-5">

                  <div>
                    <p className="font-semibold text-yellow-400">Bolão Global</p>
                    <p className="mt-1">
                      <strong className="text-white">Gratuito.</strong> Sem taxa de inscrição e sem
                      premiação.
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-yellow-400">Bolão Família Trovão</p>
                    <p className="mt-1">
                      <strong className="text-white">Taxa de inscrição:</strong> R$ 50,00
                    </p>
                    <p className="mt-1">
                      <strong className="text-white">Chave PIX (telefone):</strong>{' '}
                      <span className="font-mono">83988269825</span>
                    </p>
                    <div className="mt-3">
                      <p className="mb-1 text-xs text-gray-400">PIX Copia e Cola:</p>
                      <div className="flex items-start gap-2 rounded-lg bg-gray-800 p-3">
                        <p className="flex-1 break-all font-mono text-xs text-gray-300">
                          {PIX_COPIA_COLA}
                        </p>
                        <button
                          onClick={copiarPix}
                          className={`shrink-0 rounded px-2 py-1 text-xs font-medium transition-colors ${
                            copiado
                              ? 'bg-green-700 text-green-100'
                              : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                          }`}
                        >
                          {copiado ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                    <p className="mt-2">
                      Após o pagamento, avisar Fred Farias via WhatsApp:{' '}
                      <strong className="text-white">(83) 98826-9825</strong>
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-yellow-400">Outros Bolões</p>
                    <p className="mt-1">
                      Valor e forma de pagamento combinados previamente com Fred Farias via
                      WhatsApp{' '}
                      <strong className="text-white">(83) 98826-9825</strong>. A precificação e
                      premiação são definidas exclusivamente pelo{' '}
                      <strong className="text-white">moderador do bolão</strong>.
                    </p>
                    <p className="mt-2 rounded-lg bg-gray-800 p-3 text-xs text-gray-400">
                      Fred Farias não tem qualquer responsabilidade legal sobre bolões de terceiros.
                      O intuito é puramente recreativo.
                    </p>
                  </div>

                </div>
              </AccordionPanel>
            </AccordionItem>

            {/* 3. Sistema de Pontuação */}
            <AccordionItem value="pontuacao">
              <AccordionTrigger>Sistema de Pontuação</AccordionTrigger>
              <AccordionPanel>
                <div className="space-y-4">
                  <p className="text-xs text-gray-400">
                    Pontuação universal para todos os bolões. Os pontos{' '}
                    <strong className="text-white">não são cumulativos</strong> — o máximo por jogo
                    é o placar exato × o peso daquele jogo.
                  </p>

                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="pb-2 text-left text-gray-400">Acerto</th>
                        <th className="pb-2 text-right text-gray-400">Pontos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {[
                        ['Placar exato do jogo', '10'],
                        ['Placar exato do vencedor (sem acertar o do perdedor)', '6'],
                        ['Empate correto (sem acertar o placar exato)', '5'],
                        ['Placar exato do perdedor (sem acertar o do vencedor)', '4'],
                        ['Vencedor correto (sem acertar nenhum placar)', '2'],
                      ].map(([label, pts]) => (
                        <tr key={label}>
                          <td className="py-2 text-gray-300">{label}</td>
                          <td className="py-2 text-right font-bold text-yellow-400">{pts} pts</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div>
                    <p className="mb-2 font-semibold text-white">Multiplicadores de Peso</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="pb-2 text-left text-gray-400">Situação</th>
                          <th className="pb-2 text-right text-gray-400">Peso</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {[
                          ['Jogos de seleções ex-campeãs mundiais', 'x2'],
                          ['Jogos do Brasil (qualquer fase)', 'x3'],
                          ['Todos os jogos da 2ª fase (mata-mata)', 'x2'],
                          ['Brasil na 2ª fase', 'x3'],
                        ].map(([label, peso]) => (
                          <tr key={label}>
                            <td className="py-2 text-gray-300">{label}</td>
                            <td className="py-2 text-right font-bold text-yellow-400">{peso}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <p className="mb-2 font-semibold text-white">Limite de Apostas Idênticas</p>
                    <ul className="list-disc space-y-1 pl-4">
                      <li>
                        Fase de grupos: máximo de{' '}
                        <strong className="text-white">18 apostas com o mesmo placar</strong>
                      </li>
                      <li>
                        Fase eliminatória: máximo de{' '}
                        <strong className="text-white">8 apostas com o mesmo placar</strong>
                      </li>
                    </ul>
                  </div>
                </div>
              </AccordionPanel>
            </AccordionItem>

            {/* 4. Premiação */}
            <AccordionItem value="premiacao">
              <AccordionTrigger>Premiação</AccordionTrigger>
              <AccordionPanel>
                <div className="space-y-5">

                  <div>
                    <p className="font-semibold text-yellow-400">Bolão Global</p>
                    <p className="mt-1">
                      <strong className="text-white">Sem premiação.</strong> Participação gratuita,
                      sem distribuição de prêmios.
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-yellow-400">Bolão Família Trovão</p>
                    <p className="mt-1 mb-2">
                      Os 5 participantes com maior pontuação ao fim do bolão recebem:
                    </p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="pb-2 text-left text-gray-400">Posição</th>
                          <th className="pb-2 text-right text-gray-400">% do total arrecadado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {[
                          ['1º lugar', '45%'],
                          ['2º lugar', '25%'],
                          ['3º lugar', '15%'],
                          ['4º lugar', '10%'],
                          ['5º lugar', '5%'],
                        ].map(([pos, pct]) => (
                          <tr key={pos}>
                            <td className="py-2 font-medium text-white">{pos}</td>
                            <td className="py-2 text-right text-yellow-400">{pct}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-3">
                      <p className="mb-1 text-xs font-semibold text-white">
                        Critérios de desempate (em ordem):
                      </p>
                      <ol className="list-decimal space-y-1 pl-4 text-xs">
                        <li>Maior número de placares exatos</li>
                        <li>Maior número de acertos do placar do vencedor</li>
                        <li>E assim sucessivamente, seguindo a ordem da tabela de pontuação</li>
                        <li>
                          Persistindo o empate: a premiação das posições empatadas é somada e
                          dividida igualmente
                        </li>
                      </ol>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-yellow-400">Outros Bolões</p>
                    <p className="mt-1">
                      Premiação definida exclusivamente pelo moderador. Fred Farias não tem
                      responsabilidade sobre a distribuição de prêmios de bolões de terceiros.
                    </p>
                  </div>

                </div>
              </AccordionPanel>
            </AccordionItem>

          </Accordion>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/frontend && npx jest src/__tests__/regulamento.test.tsx --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/app/regulamento/page.tsx apps/frontend/src/__tests__/regulamento.test.tsx
git commit -m "feat: página pública de regulamento com accordion"
```

---

## Task 3: Link na página de login

**Files:**
- Modify: `apps/frontend/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Add the Regulamento link**

In `apps/frontend/src/app/(auth)/login/page.tsx`, locate the links block at the bottom of the form (lines 67–78). Add a `<Link>` to `/regulamento` **before** "Esqueceu a senha?":

```tsx
<div className="text-center space-y-2 text-sm text-gray-400">
  <Link href="/regulamento" className="hover:text-white block">Regulamento</Link>
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/app/(auth)/login/page.tsx
git commit -m "feat: link para regulamento na tela de login"
```
