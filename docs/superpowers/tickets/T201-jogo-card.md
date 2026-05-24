# T201 — JogoCard com 4 estados visuais

> **Módulo:** [M2 — Apostas](../modules/M2-apostas.md)
> **Tamanho:** `M`
> **Status:** `pendente`
> **Depende de:** T105 concluído (hooks base prontos)

---

## O que fazer

Reescrever `JogoCard.tsx` substituindo a lógica binária aberto/fechado por 4 estados visuais explícitos: `aberto` (sem aposta, prazo aberto), `salvo` (aposta registrada, prazo aberto), `incompleto` (prazo encerrado, sem aposta), `fechado` (prazo encerrado, com aposta). Cada estado tem borda de cor distinta e CTA diferente.

---

## Arquivos

| Ação | Caminho |
|---|---|
| Reescrever | `apps/frontend/src/components/JogoCard.tsx` |
| Criar | `apps/frontend/src/__tests__/JogoCard.test.tsx` |

---

## Tipos relevantes (`apps/frontend/src/types/api.ts`)

```typescript
interface Jogo {
  id: string; dataHora: string; rodada: number; grupo: string | null; fase: string;
  placarCasa: number | null; placarVisitante: number | null; pesoPontuacao: number;
  selecaoCasa: Selecao; selecaoVisitante: Selecao;
}
interface Aposta {
  id: string; jogoId: string; bolaoId: string;
  placarCasa: number; placarVisitante: number; pontuacao: number | null; jogo: Jogo;
}
interface Selecao { id: string; nome: string; codigo: string; bandeiraSvg: string; }
```

`MINUTOS_PRAZO_APOSTA = 60` (de `@bolao/shared`) — o prazo de aposta encerra 60 min antes do kickoff.

---

## Passos

### Passo 1: Escrever teste (vai falhar)

```typescript
// apps/frontend/src/__tests__/JogoCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { JogoCard } from '@/components/JogoCard';
import type { Jogo, Aposta } from '@/types/api';

const selecao = (nome: string) => ({
  id: nome, nome, codigo: nome.slice(0, 3).toUpperCase(), bandeiraSvg: '<svg></svg>',
});

const HORA_FUTURA = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
const HORA_PASSADA = new Date(Date.now() - 2 * 3600 * 1000).toISOString();

const jogoBase: Jogo = {
  id: 'j1', rodada: 1, grupo: 'A', fase: 'GRUPOS',
  placarCasa: null, placarVisitante: null, pesoPontuacao: 1,
  selecaoCasa: selecao('Brasil'), selecaoVisitante: selecao('Argentina'),
  dataHora: HORA_FUTURA,
};

const apostaExemplo: Aposta = {
  id: 'a1', jogoId: 'j1', bolaoId: 'b1',
  placarCasa: 2, placarVisitante: 1, pontuacao: null,
  jogo: jogoBase,
};

it('estado aberto — mostra botão Apostar, sem palpite', () => {
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA }} onApostar={jest.fn()} />);
  expect(screen.getByRole('button', { name: /apostar/i })).toBeInTheDocument();
  expect(screen.queryByText(/seu palpite/i)).not.toBeInTheDocument();
});

it('estado salvo — mostra palpite e botão Editar', () => {
  render(
    <JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA }} aposta={apostaExemplo} onApostar={jest.fn()} />
  );
  expect(screen.getByText(/2.*1|1.*2/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
});

it('estado incompleto — mostra prazo encerrado, sem botão', () => {
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_PASSADA }} onApostar={jest.fn()} />);
  expect(screen.getByText(/prazo encerrado/i)).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('estado fechado — mostra palpite, sem botão', () => {
  render(
    <JogoCard jogo={{ ...jogoBase, dataHora: HORA_PASSADA }} aposta={apostaExemplo} onApostar={jest.fn()} />
  );
  expect(screen.getByText(/2.*1|1.*2/)).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('chama onApostar ao clicar no botão', () => {
  const onApostar = jest.fn();
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA }} onApostar={onApostar} />);
  fireEvent.click(screen.getByRole('button', { name: /apostar/i }));
  expect(onApostar).toHaveBeenCalledTimes(1);
});
```

### Passo 2: Verificar falha do teste

```bash
pnpm --filter @bolao/frontend test -- JogoCard
```

Saída esperada: `FAIL — Cannot find module` ou `5 failed`.

### Passo 3: Implementar JogoCard

```typescript
// apps/frontend/src/components/JogoCard.tsx
import type { Jogo, Aposta } from '@/types/api';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';
import { ScoreDisplay } from '@/components/ScoreDisplay';
import { MINUTOS_PRAZO_APOSTA } from '@bolao/shared';

type JogoCardEstado = 'aberto' | 'salvo' | 'incompleto' | 'fechado';

const ESTADO_BORDER: Record<JogoCardEstado, string> = {
  aberto:    'border-trovao-border hover:border-trovao-green/40',
  salvo:     'border-trovao-green',
  incompleto:'border-trovao-gold',
  fechado:   'border-trovao-border opacity-60',
};

function getEstado(jogo: Jogo, aposta?: Aposta): JogoCardEstado {
  const prazo = new Date(jogo.dataHora).getTime() - MINUTOS_PRAZO_APOSTA * 60 * 1000;
  const estaFechado = Date.now() >= prazo;
  if (!estaFechado && !aposta) return 'aberto';
  if (!estaFechado && aposta)  return 'salvo';
  if (estaFechado && aposta)   return 'fechado';
  return 'incompleto';
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

interface JogoCardProps {
  jogo: Jogo;
  aposta?: Aposta;
  onApostar?: () => void;
}

export function JogoCard({ jogo, aposta, onApostar }: JogoCardProps) {
  const estado = getEstado(jogo, aposta);

  return (
    <div className={`bg-trovao-card border rounded-xl p-4 space-y-3 transition-colors ${ESTADO_BORDER[estado]}`}>
      {/* Header */}
      <div className="flex justify-between items-center text-xs text-trovao-muted">
        <span>{jogo.fase}{jogo.grupo ? ` · Grupo ${jogo.grupo}` : ''} · R{jogo.rodada}</span>
        <span>{formatHora(jogo.dataHora)}</span>
      </div>

      {/* Times */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col items-center gap-1 flex-1">
          <SelecaoAvatar nome={jogo.selecaoCasa.nome} bandeiraSvg={jogo.selecaoCasa.bandeiraSvg} size="md" />
          <p className="text-xs font-semibold text-white">{jogo.selecaoCasa.codigo}</p>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <ScoreDisplay placarCasa={jogo.placarCasa} placarVisitante={jogo.placarVisitante} />
          {estado === 'aberto' && (
            <span className="text-trovao-muted text-[10px]">Aposte agora</span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 flex-1">
          <SelecaoAvatar nome={jogo.selecaoVisitante.nome} bandeiraSvg={jogo.selecaoVisitante.bandeiraSvg} size="md" />
          <p className="text-xs font-semibold text-white">{jogo.selecaoVisitante.codigo}</p>
        </div>
      </div>

      {/* Footer por estado */}
      {(estado === 'salvo' || estado === 'fechado') && aposta && (
        <div className="border-t border-trovao-border pt-2 flex items-center justify-between text-xs">
          <span className="text-trovao-muted">Seu palpite:</span>
          <span className="text-white font-mono font-semibold">
            {aposta.placarCasa} × {aposta.placarVisitante}
          </span>
          {aposta.pontuacao !== null && (
            <span className="text-trovao-gold font-bold">+{aposta.pontuacao} pts</span>
          )}
        </div>
      )}

      {estado === 'incompleto' && (
        <p className="text-trovao-muted text-xs text-center border-t border-trovao-border pt-2">
          Prazo encerrado — sem aposta
        </p>
      )}

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

### Passo 4: Rodar teste

```bash
pnpm --filter @bolao/frontend test -- JogoCard
```

Saída esperada: `PASS · 5 tests passed`

### Passo 5: Validar tipos

```bash
pnpm --filter @bolao/frontend exec tsc --noEmit
```

Saída esperada: sem erros.

### Passo 6: Commit

```bash
git add apps/frontend/src/components/JogoCard.tsx apps/frontend/src/__tests__/JogoCard.test.tsx
git commit -m "feat(frontend): JogoCard com 4 estados visuais — aberto/salvo/incompleto/fechado"
```

---

## Validação final

```bash
pnpm --filter @bolao/frontend test -- JogoCard   # → 5 passed
pnpm --filter @bolao/frontend exec tsc --noEmit  # → sem erros
```
