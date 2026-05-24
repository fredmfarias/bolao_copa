# T202 — ApostaDrawer com stepper

> **Módulo:** [M2 — Apostas](../modules/M2-apostas.md)
> **Tamanho:** `M`
> **Status:** `pendente`
> **Depende de:** T201 concluído (JogoCard pronto), T101 (shadcn configurado)

---

## O que fazer

Substituir `ApostaForm.tsx` (formulário inline) por `ApostaDrawer.tsx` (Sheet mobile do shadcn/ui). O drawer exibe steppers de incremento/decremento para cada placar. Auto-save ao fechar o drawer garante que nenhum palpite seja perdido.

---

## Arquivos

| Ação | Caminho |
|---|---|
| Criar | `apps/frontend/src/components/ApostaDrawer.tsx` |
| Criar | `apps/frontend/src/__tests__/ApostaDrawer.test.tsx` |
| Deletar | `apps/frontend/src/components/ApostaForm.tsx` |
| Instalar | Sheet via `pnpm dlx shadcn@latest add sheet` |

---

## Passos

### Passo 1: Instalar Sheet

Executar a partir de `apps/frontend`:

```bash
cd apps/frontend && pnpm dlx shadcn@latest add sheet --yes
```

Saída esperada: `✓ Done! Installed 1 component`. Cria `apps/frontend/src/components/ui/sheet.tsx`.

### Passo 2: Escrever teste (vai falhar)

```typescript
// apps/frontend/src/__tests__/ApostaDrawer.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApostaDrawer } from '@/components/ApostaDrawer';
import type { Jogo, Aposta } from '@/types/api';

jest.mock('@/lib/api', () => ({
  api: { post: jest.fn().mockResolvedValue({}) },
}));

import { api } from '@/lib/api';
const mockPost = api.post as jest.Mock;

const selecao = (nome: string) => ({
  id: nome, nome, codigo: nome.slice(0, 3).toUpperCase(), bandeiraSvg: '<svg></svg>',
});

const jogo: Jogo = {
  id: 'j1', rodada: 1, grupo: 'A', fase: 'GRUPOS',
  placarCasa: null, placarVisitante: null, pesoPontuacao: 1,
  dataHora: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
  selecaoCasa: selecao('Brasil'), selecaoVisitante: selecao('Argentina'),
};

const props = {
  jogo,
  bolaoId: 'b1',
  aberto: true,
  onFechar: jest.fn(),
  onSalvo: jest.fn(),
};

beforeEach(() => {
  mockPost.mockClear();
  props.onFechar.mockClear();
  props.onSalvo.mockClear();
});

it('exibe nomes dos times quando aberto', () => {
  render(<ApostaDrawer {...props} />);
  expect(screen.getByText('BRA')).toBeInTheDocument();
  expect(screen.getByText('ARG')).toBeInTheDocument();
});

it('botão + incrementa placar da casa', () => {
  render(<ApostaDrawer {...props} />);
  const botoesMais = screen.getAllByRole('button', { name: '+' });
  fireEvent.click(botoesMais[0]);
  expect(screen.getByTestId('placar-casa')).toHaveTextContent('1');
});

it('botão − decrementa placar, mínimo 0', () => {
  render(<ApostaDrawer {...props} />);
  const botoesMenos = screen.getAllByRole('button', { name: '−' });
  fireEvent.click(botoesMenos[0]);
  expect(screen.getByTestId('placar-casa')).toHaveTextContent('0');
});

it('Confirmar chama api.post com payload correto', async () => {
  render(<ApostaDrawer {...props} />);
  fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);
  fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);
  fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
  await waitFor(() => {
    expect(mockPost).toHaveBeenCalledWith('/apostas', {
      jogoId: 'j1', bolaoId: 'b1', placarCasa: 2, placarVisitante: 0,
    });
  });
});

it('chama onSalvo e onFechar após confirmar', async () => {
  render(<ApostaDrawer {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
  await waitFor(() => {
    expect(props.onSalvo).toHaveBeenCalledTimes(1);
    expect(props.onFechar).toHaveBeenCalledTimes(1);
  });
});
```

### Passo 3: Verificar falha do teste

```bash
pnpm --filter @bolao/frontend test -- ApostaDrawer
```

Saída esperada: `FAIL — Cannot find module` ou `5 failed`.

### Passo 4: Implementar ApostaDrawer

```typescript
// apps/frontend/src/components/ApostaDrawer.tsx
'use client';

import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import type { Jogo, Aposta } from '@/types/api';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';

interface ApostaDrawerProps {
  jogo: Jogo;
  aposta?: Aposta;
  bolaoId: string;
  aberto: boolean;
  onFechar: () => void;
  onSalvo: () => void;
}

export function ApostaDrawer({ jogo, aposta, bolaoId, aberto, onFechar, onSalvo }: ApostaDrawerProps) {
  const [casa, setCasa] = useState(aposta?.placarCasa ?? 0);
  const [visitante, setVisitante] = useState(aposta?.placarVisitante ?? 0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const isDirtyRef = useRef(false);

  async function salvar(placarCasa: number, placarVisitante: number): Promise<boolean> {
    setSalvando(true);
    setErro('');
    try {
      await api.post('/apostas', { jogoId: jogo.id, bolaoId, placarCasa, placarVisitante });
      isDirtyRef.current = false;
      onSalvo();
      return true;
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao salvar.');
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function handleConfirmar() {
    const ok = await salvar(casa, visitante);
    if (ok) onFechar();
  }

  async function handleFechar() {
    if (isDirtyRef.current) {
      await salvar(casa, visitante);
    }
    onFechar();
  }

  function incCasa()     { setCasa(v => v + 1);          isDirtyRef.current = true; }
  function decCasa()     { setCasa(v => Math.max(0, v - 1)); isDirtyRef.current = true; }
  function incVisitante(){ setVisitante(v => v + 1);     isDirtyRef.current = true; }
  function decVisitante(){ setVisitante(v => Math.max(0, v - 1)); isDirtyRef.current = true; }

  return (
    <Sheet open={aberto} onOpenChange={open => { if (!open) handleFechar(); }}>
      <SheetContent side="bottom" className="bg-trovao-card border-t border-trovao-border rounded-t-2xl pb-8">
        <SheetHeader className="text-center pb-2">
          <SheetTitle className="text-white text-base">Seu Palpite</SheetTitle>
          <p className="text-trovao-muted text-xs">
            {jogo.fase}{jogo.grupo ? ` · Grupo ${jogo.grupo}` : ''} · Rodada {jogo.rodada}
          </p>
        </SheetHeader>

        <div className="flex items-center justify-center gap-6 py-6">
          {/* Time casa */}
          <div className="flex flex-col items-center gap-2 w-16">
            <SelecaoAvatar nome={jogo.selecaoCasa.nome} bandeiraSvg={jogo.selecaoCasa.bandeiraSvg} size="lg" />
            <p className="text-xs font-semibold text-white">{jogo.selecaoCasa.codigo}</p>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <button onClick={incCasa} aria-label="+"
                className="w-10 h-10 bg-trovao-surface rounded-xl text-trovao-gold text-xl font-bold hover:bg-trovao-border transition-colors">
                +
              </button>
              <span data-testid="placar-casa" className="text-white text-2xl font-bold w-10 text-center tabular-nums">
                {casa}
              </span>
              <button onClick={decCasa} aria-label="−"
                className="w-10 h-10 bg-trovao-surface rounded-xl text-trovao-muted text-xl hover:bg-trovao-border transition-colors">
                −
              </button>
            </div>

            <span className="text-trovao-muted text-2xl font-bold">×</span>

            <div className="flex flex-col items-center gap-1">
              <button onClick={incVisitante} aria-label="+"
                className="w-10 h-10 bg-trovao-surface rounded-xl text-trovao-gold text-xl font-bold hover:bg-trovao-border transition-colors">
                +
              </button>
              <span data-testid="placar-visitante" className="text-white text-2xl font-bold w-10 text-center tabular-nums">
                {visitante}
              </span>
              <button onClick={decVisitante} aria-label="−"
                className="w-10 h-10 bg-trovao-surface rounded-xl text-trovao-muted text-xl hover:bg-trovao-border transition-colors">
                −
              </button>
            </div>
          </div>

          {/* Time visitante */}
          <div className="flex flex-col items-center gap-2 w-16">
            <SelecaoAvatar nome={jogo.selecaoVisitante.nome} bandeiraSvg={jogo.selecaoVisitante.bandeiraSvg} size="lg" />
            <p className="text-xs font-semibold text-white">{jogo.selecaoVisitante.codigo}</p>
          </div>
        </div>

        {erro && <p className="text-trovao-red text-sm text-center mb-3">{erro}</p>}

        <button
          onClick={handleConfirmar}
          disabled={salvando}
          className="w-full py-3 bg-trovao-gold text-trovao-base font-bold rounded-xl text-sm hover:bg-trovao-gold/90 disabled:opacity-50 transition-colors"
        >
          {salvando ? 'Salvando...' : 'Confirmar Palpite'}
        </button>
      </SheetContent>
    </Sheet>
  );
}
```

### Passo 5: Rodar teste

```bash
pnpm --filter @bolao/frontend test -- ApostaDrawer
```

Saída esperada: `PASS · 5 tests passed`

### Passo 6: Deletar ApostaForm

```bash
git rm apps/frontend/src/components/ApostaForm.tsx
```

### Passo 7: Validar tipos

```bash
pnpm --filter @bolao/frontend exec tsc --noEmit
```

Se aparecer erro sobre `ApostaForm` sendo importado em `jogos/page.tsx`: aguardar T203 que atualiza a página. Para validar tipos de `ApostaDrawer.tsx` isoladamente, o erro pode ser ignorado temporariamente — ele será resolvido em T203.

### Passo 8: Commit

```bash
git add apps/frontend/src/components/ApostaDrawer.tsx \
  apps/frontend/src/components/ui/sheet.tsx \
  apps/frontend/src/__tests__/ApostaDrawer.test.tsx
git commit -m "feat(frontend): ApostaDrawer — Sheet mobile com steppers e auto-save"
```

---

## Validação final

```bash
pnpm --filter @bolao/frontend test -- ApostaDrawer   # → 5 passed
```
