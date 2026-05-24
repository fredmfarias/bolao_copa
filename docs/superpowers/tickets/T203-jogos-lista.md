# T203 — Lista de jogos agrupada por data com chips de filtro

> **Módulo:** [M2 — Apostas](../modules/M2-apostas.md)
> **Tamanho:** `M`
> **Status:** `pendente`
> **Depende de:** T202 concluído (ApostaDrawer disponível)

---

## O que fazer

Criar `FaseFilterChips.tsx` (chips de filtro horizontal) e reescrever `apps/frontend/src/app/(app)/jogos/page.tsx` para: (1) substituir o `<select>` pelos chips, (2) agrupar jogos por data com headers sticky, (3) carregar apostas em paralelo com jogos, (4) abrir ApostaDrawer ao invés do ApostaForm inline.

---

## Arquivos

| Ação | Caminho |
|---|---|
| Criar | `apps/frontend/src/components/FaseFilterChips.tsx` |
| Criar | `apps/frontend/src/__tests__/FaseFilterChips.test.tsx` |
| Reescrever | `apps/frontend/src/app/(app)/jogos/page.tsx` |

---

## Endpoints utilizados

| Método | Path | Descrição |
|---|---|---|
| `GET` | `/jogos?fase=` | Lista jogos (filtro opcional por fase) |
| `GET` | `/apostas/bolao/:bolaoId` | Apostas do usuário logado no bolão |
| `POST` | `/apostas` | Upsert de aposta (chamado pelo ApostaDrawer) |

---

## Passos

### Passo 1: Escrever teste de FaseFilterChips (vai falhar)

```typescript
// apps/frontend/src/__tests__/FaseFilterChips.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { FaseFilterChips } from '@/components/FaseFilterChips';

const FASES = ['Todos', 'GRUPOS', 'OITAVAS', 'FINAL'];

it('renderiza todos os chips', () => {
  render(<FaseFilterChips fases={FASES} selecionada="Todos" onChange={jest.fn()} />);
  expect(screen.getByText('Todos')).toBeInTheDocument();
  expect(screen.getByText('Grupos')).toBeInTheDocument();
  expect(screen.getByText('Oitavas')).toBeInTheDocument();
  expect(screen.getByText('Final')).toBeInTheDocument();
});

it('chip selecionado tem classe de destaque', () => {
  render(<FaseFilterChips fases={FASES} selecionada="GRUPOS" onChange={jest.fn()} />);
  const chip = screen.getByText('Grupos').closest('button');
  expect(chip?.className).toMatch(/trovao-gold/);
});

it('clique em chip chama onChange com o valor correto', () => {
  const onChange = jest.fn();
  render(<FaseFilterChips fases={FASES} selecionada="Todos" onChange={onChange} />);
  fireEvent.click(screen.getByText('Oitavas'));
  expect(onChange).toHaveBeenCalledWith('OITAVAS');
});
```

### Passo 2: Verificar falha do teste

```bash
pnpm --filter @bolao/frontend test -- FaseFilterChips
```

Saída esperada: `FAIL — Cannot find module`.

### Passo 3: Implementar FaseFilterChips

```typescript
// apps/frontend/src/components/FaseFilterChips.tsx
const FASE_LABELS: Record<string, string> = {
  Todos: 'Todos',
  GRUPOS: 'Grupos',
  OITAVAS: 'Oitavas',
  QUARTAS: 'Quartas',
  SEMIS: 'Semi',
  TERCEIRO_LUGAR: '3º Lugar',
  FINAL: 'Final',
};

interface FaseFilterChipsProps {
  fases: string[];
  selecionada: string;
  onChange: (fase: string) => void;
}

export function FaseFilterChips({ fases, selecionada, onChange }: FaseFilterChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {fases.map(fase => (
        <button
          key={fase}
          onClick={() => onChange(fase)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            selecionada === fase
              ? 'bg-trovao-gold text-trovao-base'
              : 'bg-trovao-surface text-trovao-muted hover:text-white'
          }`}
        >
          {FASE_LABELS[fase] ?? fase}
        </button>
      ))}
    </div>
  );
}
```

### Passo 4: Rodar teste de FaseFilterChips

```bash
pnpm --filter @bolao/frontend test -- FaseFilterChips
```

Saída esperada: `PASS · 3 tests passed`

### Passo 5: Reescrever jogos/page.tsx

```typescript
// apps/frontend/src/app/(app)/jogos/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { JogoCard } from '@/components/JogoCard';
import { ApostaDrawer } from '@/components/ApostaDrawer';
import { FaseFilterChips } from '@/components/FaseFilterChips';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import type { Jogo, Aposta } from '@/types/api';
import { JogoFase, BOLAO_GLOBAL_ID } from '@bolao/shared';

const FASES = ['Todos', ...Object.values(JogoFase)];

function agruparPorData(jogos: Jogo[]): Map<string, Jogo[]> {
  const grupos = new Map<string, Jogo[]>();
  for (const jogo of jogos) {
    const chave = new Date(jogo.dataHora).toLocaleDateString('pt-BR', {
      weekday: 'short', day: '2-digit', month: '2-digit',
    });
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(jogo);
  }
  return grupos;
}

export default function JogosPage() {
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [apostas, setApostas] = useState<Map<string, Aposta>>(new Map());
  const [fase, setFase] = useState('Todos');
  const [jogoSelecionado, setJogoSelecionado] = useState<Jogo | null>(null);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    const params = fase !== 'Todos' ? `?fase=${fase}` : '';
    const [jogosData, apostasData] = await Promise.all([
      api.get<Jogo[]>(`/jogos${params}`).catch(() => [] as Jogo[]),
      api.get<Aposta[]>(`/apostas/bolao/${BOLAO_GLOBAL_ID}`).catch(() => [] as Aposta[]),
    ]);
    setJogos(jogosData);
    setApostas(new Map(apostasData.map(a => [a.jogoId, a])));
    setLoading(false);
  }

  async function recarregarApostas() {
    const apostasData = await api.get<Aposta[]>(`/apostas/bolao/${BOLAO_GLOBAL_ID}`)
      .catch(() => [] as Aposta[]);
    setApostas(new Map(apostasData.map(a => [a.jogoId, a])));
  }

  useEffect(() => { carregar(); }, [fase]);

  const grupos = agruparPorData(jogos);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Jogos</h1>

      <FaseFilterChips fases={FASES} selecionada={fase} onChange={setFase} />

      {loading ? (
        <PageSkeleton />
      ) : jogos.length === 0 ? (
        <EmptyState
          titulo="Nenhum jogo"
          descricao="Não há jogos para esta fase."
        />
      ) : (
        <div className="space-y-6">
          {Array.from(grupos.entries()).map(([data, jogosGrupo]) => (
            <div key={data}>
              <h2 className="text-trovao-muted text-[10px] font-semibold uppercase tracking-wider mb-2 px-1">
                {data}
              </h2>
              <div className="space-y-3">
                {jogosGrupo.map(jogo => (
                  <JogoCard
                    key={jogo.id}
                    jogo={jogo}
                    aposta={apostas.get(jogo.id)}
                    onApostar={() => setJogoSelecionado(jogo)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {jogoSelecionado && (
        <ApostaDrawer
          key={jogoSelecionado.id}
          jogo={jogoSelecionado}
          aposta={apostas.get(jogoSelecionado.id)}
          bolaoId={BOLAO_GLOBAL_ID}
          aberto={true}
          onFechar={() => setJogoSelecionado(null)}
          onSalvo={recarregarApostas}
        />
      )}
    </div>
  );
}
```

### Passo 6: Validar tipos

```bash
pnpm --filter @bolao/frontend exec tsc --noEmit
```

Saída esperada: sem erros. Se aparecer erro sobre `ApostaForm` já importado em outro lugar, verificar se o `git rm` do T202 foi executado.

### Passo 7: Rodar todos os testes do M2

```bash
pnpm --filter @bolao/frontend test
```

Saída esperada: `PASS · todos os testes do M1 e M2 passam`

### Passo 8: Commit

```bash
git add apps/frontend/src/components/FaseFilterChips.tsx \
  apps/frontend/src/__tests__/FaseFilterChips.test.tsx \
  apps/frontend/src/app/\(app\)/jogos/page.tsx
git commit -m "feat(frontend): jogos — chips de filtro, agrupamento por data, ApostaDrawer integrado"
```

---

## Pós-conclusão: escrever contratos

Após este ticket, escrever os contratos produzidos por M2:

1. `docs/superpowers/contracts/jogo-card.md` — props e estados do JogoCard
2. `docs/superpowers/contracts/aposta-drawer.md` — props e comportamento do ApostaDrawer

Estes contratos são necessários para M3 (ranking/palpites) renderizar cards de outros usuários.

---

## Validação final

```bash
pnpm --filter @bolao/frontend test           # → todos os testes passam
pnpm --filter @bolao/frontend exec tsc --noEmit  # → sem erros de tipo
```
