# Melhorias no Ranking (aba Rodada) e Admin

Data: 2026-05-29
Status: aprovado para implementação

## Contexto e objetivos

Conjunto de melhorias de UX no ranking (com foco na aba Rodada), na visibilidade dos jogos encerrados nas listagens e em dois pontos do admin (publicação de rodada e busca de usuários).

Objetivos:

1. **Ranking — aba Rodada**: usar data de publicação como label do seletor (não "Rodada N"), mostrar posição da rodada como principal e posição no bolão como secundária, e ao expandir o row apresentar os palpites da rodada com pontuação obtida.
2. **Listagens de jogos**: jogos encerrados devem ser legíveis — finalizado com placar é informação consolidada (não merece estar apagado); "aguardando placar" e "sem palpite" são transitórios e podem ser sutis.
3. **Admin/ranking**: botão "Publicar rodada" só deve habilitar quando houver jogo com placar pendente de publicação; antes de publicar, exibir modal de confirmação listando jogos + placares.
4. **Admin/usuários**: busca client-side por nome ou email.

Princípios:
- **Mobile-first**: o público acessa majoritariamente pelo celular; tooltips dependentes de hover são evitados.
- **Padrão de tooltip misto**: explicações que valem para todo mundo o tempo todo são texto direto (sem interação); informação pontual por linha usa popover Radix tap-to-toggle.
- **Sem regressões no padrão visual** (cores `trovao-*`, bordas `rounded-xl`, hierarquia em dourado).

## Decisões transversais

- **Tooltip mobile-first**: padrão misto. Texto direto inline para avisos gerais (ex: explicação da data da publicação). Popover Radix tap-to-toggle (componente `ui/popover.tsx` a adicionar via `shadcn add popover`) para informação por linha quando texto inline polui.
- **Modal**: reusa `components/ui/dialog.tsx` (shadcn) já existente.
- **Reordenação por rodada**: client-side. O snapshot publicado não tem contadores por rodada, então o critério de desempate na rodada é simplificado.

## Seção 1 — Ranking, aba Rodada: reordenação e posições

### Reordenação client-side

A página `ranking/[bolaoId]` já ordena por `pontuacaoRodada desc`. Após o sort, atribui `posicaoRodada` ordinal (1-based):

```ts
const ordenadoRodada = [...ranking]
  .sort((a, b) => b.pontuacaoRodada - a.pontuacaoRodada)
  .map((s, idx) => ({ ...s, posicaoRodada: idx + 1 }));
```

**Desempate dentro da rodada**: snapshot atual só tem contadores acumulados (não por rodada). Critério: `pontuacaoRodada desc` → `pontuacaoTotal desc` → `usuario.nome asc`. Determinístico, sem mudança de backend.

### Display da posição

`RankingRow` recebe novo prop opcional `posicaoRodada?: number`.

- Aba Geral: prop ausente, comportamento atual (`{entry.posicao}º`).
- Aba Rodada: prop presente, render inline `1ª (P 7ª)` — `1ª` em branco/destacado, `(P 7ª)` em cinza, fonte menor. `7ª` vem de `entry.posicao` (snapshot = posição no bolão).

### Variação de posição (`posicoesGanhas`)

Aba Rodada continua zerando `posicoesGanhas` (comportamento atual). Variação entre rodadas mede mudança no bolão; não faz sentido na rodada isolada.

### Pódio

`RankingPodium` na aba Rodada já recebe array remapeado. Não muda — não exibe `(P Nª)` no pódio (poluição visual). A informação "posição no bolão" aparece nos rows.

## Seção 2 — Select da rodada usa data de publicação

### Label do option

Trocar `Rodada {numero}` por data formatada compacta do `publicacao.publicadoEm` no timezone local: `26/05/2026`.

Formatador novo em `lib/dataFormat.ts` (módulo novo — `lib/jogoEstado.ts` é específico de estado de jogo; misturar formatadores genéricos lá ficaria confuso):

```ts
export function formatDataPublicacao(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
```

### Linha auxiliar

Logo abaixo do select, alinhada à direita, texto `text-[10px] leading-tight text-trovao-muted`:

```
Data da publicação · pode diferir da data dos jogos
```

Só renderiza na aba Rodada. Sem ícone, sem interação.

## Seção 3 — Expansão do row na aba Rodada (palpites + pontuação)

### Novo endpoint backend

```
GET /boloes/:bolaoId/ranking/publicacoes/:numero/usuarios/:usuarioId/apostas
```

Lógica:
1. Resolve `publicacaoId` a partir de `(numero)` em `Publicacao`.
2. `jogo.findMany` onde `publicacaoId = X`, ordenado por `dataHora asc`, selecionando dados necessários.
3. `leftJoin` em `aposta` filtrando por `usuarioId`.

Resposta (`RodadaPalpiteItem[]`):

```ts
interface RodadaPalpiteItem {
  jogo: {
    id: string;
    dataHora: string;
    pesoPontuacao: number;
    placarCasa: number;        // sempre presente — jogo só entra na publicacao com placar
    placarVisitante: number;
    selecaoCasa: { nome: string; codigo: string; bandeiraSvg: string };
    selecaoVisitante: { nome: string; codigo: string; bandeiraSvg: string };
  };
  palpite: { placarCasa: number; placarVisitante: number } | null;
  pontuacao: number;            // 0 se sem palpite
}
```

Bolão `bolaoId` é só pra checagem de autorização (usuário deve ser membro). Visibilidade segue o padrão das apostas já visíveis dentro do bolão.

### UI: lista enxuta no expand

Substitui completamente o conteúdo do expand quando aba=Rodada (acima sobrepõe contadores + gráfico de evolução, que continuam aparecendo na aba Geral).

Subtítulo `Palpites da rodada` em cinza pequeno.

Cada item: duas linhas compactas, divisor sutil entre items (`divide-y divide-trovao-border/30`).

Linha 1 (`flex items-center justify-between`):
- Bandeirinha 16px + código + placar real bold + código + bandeirinha.
- Peso `×N` à direita só se `pesoPontuacao !== 1`.

Linha 2 (`flex items-center justify-between text-xs`):
- Esquerda: `Palpite: X×Y` (cinza); ou `Sem palpite` (cinza-claro).
- Direita: `+N pts` (dourado se >0, cinza se =0); omitida se sem palpite.

### Estados

- Loading: `<p>Carregando palpites...</p>` (mesmo padrão do gráfico).
- Vazio: `<p>Esta rodada não tem jogos.</p>` (defensivo; não deve acontecer).
- Erro de rede: lista vazia silenciosa (padrão atual do `RankingRow`).

### Cache no client

`RankingRow` mantém cache local da resposta — primeira expansão dispara fetch, subsequentes não. Mesmo padrão que `evolucao` já usa.

### Aba Geral

Sem mudança no comportamento do expand.

## Seção 4 — Visual dos jogos encerrados (JogoCard)

### Estados refinados

`EstadoAposta` passa de 4 para 5 estados:

| Estado         | Quando                                        | Visual                                                                  |
|----------------|-----------------------------------------------|-------------------------------------------------------------------------|
| `aberto`       | prazo aberto, sem aposta                      | (atual) borda neutra, hover gold                                        |
| `salvo`        | prazo aberto, com aposta                      | (atual) borda verde                                                     |
| `aguardando`   | prazo encerrado, sem placar                   | opacity-85, badge `Aguardando placar`                                   |
| `finalizado`   | prazo encerrado, com placar, com aposta       | opacity 100%; borda verde-clara se `pontuacao > 0`, neutra se = 0       |
| `sem-palpite`  | prazo encerrado, sem aposta                   | opacity-85, badge `Sem palpite`                                         |

```ts
// lib/jogoEstado.ts
export type EstadoAposta =
  | 'aberto' | 'salvo' | 'aguardando' | 'finalizado' | 'sem-palpite';

export function getEstadoAposta(jogo: Jogo, aposta?: Aposta): EstadoAposta {
  const prazo = prazoEncerrado(jogo);
  const temPlacar = jogo.placarCasa !== null && jogo.placarVisitante !== null;
  if (!prazo && !aposta) return 'aberto';
  if (!prazo && aposta)  return 'salvo';
  if (!aposta)           return 'sem-palpite';
  if (temPlacar)         return 'finalizado';
  return 'aguardando';
}
```

`jogoNoFiltro('Encerrados', ...)` mapeia os três estados pós-prazo (`aguardando | finalizado | sem-palpite`).

### Mudanças no `JogoCard`

`ESTADO_BORDER` redefinido:

```ts
const ESTADO_BORDER: Record<EstadoAposta, string> = {
  aberto:        'border-trovao-border hover:border-trovao-green/40',
  salvo:         'border-trovao-green',
  aguardando:    'border-trovao-border opacity-85',
  finalizado:    'border-trovao-border',
  'sem-palpite': 'border-trovao-border opacity-85',
};
```

- `finalizado` com `aposta?.pontuacao > 0` → borda passa a `border-trovao-green/40`.
- Badges `Aguardando placar` / `Sem palpite` renderizadas no canto direito do header (onde hoje vai a hora), evitando criar linha extra.
- Footer ganha placar real ligeiramente maior (`font-mono text-sm` em vez de `text-xs`) — info consolidada do card finalizado.

### Filtros e testes

- `FiltroJogosChips` segue usando `Encerrados` (agrupando os 3 estados internos).
- Testes atualizados: `__tests__/JogoCard.test.tsx`, `__tests__/FiltroJogosChips.test.tsx`.

### Escopo

`JogoCard` é o único consumidor de `EstadoAposta`. A verificação se `admin/placares` reutiliza padrão visual de "apagado" fica como passo do plano; se houver, alinhar tratamento.

## Seção 5 — Admin/ranking: guard e modal de confirmação

### Backend: rota nova

```
GET /admin/publicacoes/pendente
```

Em `admin.service.ts`:

```ts
listarPublicacaoPendente() {
  return this.prisma.jogo.findMany({
    where: { placarCasa: { not: null }, publicacaoId: null },
    orderBy: { dataHora: 'asc' },
    select: {
      id: true, dataHora: true, rodada: true, fase: true,
      pesoPontuacao: true, placarCasa: true, placarVisitante: true,
      selecaoCasa:      { select: { nome: true, codigo: true, bandeiraSvg: true } },
      selecaoVisitante: { select: { nome: true, codigo: true, bandeiraSvg: true } },
    },
  });
}
```

Em `admin.controller.ts`:

```ts
@Get('publicacoes/pendente')
listarPendentes() { return this.service.listarPublicacaoPendente(); }
```

Refatorar `PublicacaoService.publicar` para chamar `AdminService.listarPublicacaoPendente()` (ou extrair função compartilhada num módulo de domínio comum) e usar a lista resultante na atribuição `updateMany`. Mesmo comportamento, critério single source of truth.

### Front: `AdminRankingPreview`

Carrega draft + pendentes em paralelo:

```ts
useEffect(() => {
  Promise.all([
    api.get<RankingEntry[]>(`/admin/ranking/${bolaoId}/draft`),
    api.get<JogoPendente[]>(`/admin/publicacoes/pendente`),
  ]).then(([r, p]) => { setRanking(r); setPendentes(p); })
    .finally(() => setLoading(false));
}, [bolaoId]);
```

Botão e auxiliar:

```tsx
<div className="flex flex-col items-end gap-0.5">
  <button
    disabled={publicando || (pendentes?.length ?? 0) === 0}
    onClick={() => setConfirmando(true)}>
    {publicando ? 'Publicando...' : 'Publicar rodada (global)'}
  </button>
  <p className="text-trovao-muted text-[10px]">
    {pendentes?.length === 0
      ? 'Nenhum jogo com placar pendente de publicação'
      : `${pendentes?.length} jogo${pendentes?.length === 1 ? '' : 's'} prontos para publicar`}
  </p>
</div>
```

Quando `publicado === true`, esconde tudo (comportamento atual mantido).

### Modal de confirmação

Componente novo `components/AdminPublicarDialog.tsx` usando `ui/dialog.tsx`.

Conteúdo:
- Título: `Confirmar publicação · N jogos`.
- Lista scrollable (`max-h-[60vh] overflow-y-auto`).
- Cada linha: `flex justify-between items-center px-3 py-2`, divider sutil. Conteúdo: `[bandeira] CASA  X × Y  VIS [bandeira]` à esquerda; `×N · {fase}` à direita (peso sempre exibido — confirmação tem que ser clara).
- Botões: `Cancelar` neutro, `Publicar` dourado primário.
- Esc e click-outside fecham.
- Em loading do POST: ambos os botões disabled; "Publicar" vira "Publicando...".

Pós-publicação:
- Modal fecha.
- `AdminRankingPreview` recarrega draft + pendentes (pendentes voltam vazios).
- Estado `publicado` ativa o badge "Publicado".

## Seção 6 — Admin/usuários: busca client-side

### UI

Input fixo no topo da lista (não sticky — sticky em mobile briga com teclado virtual):

```tsx
<div className="relative">
  <input
    type="search"
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    placeholder="Buscar por nome ou email"
    className="w-full bg-trovao-card border border-trovao-border rounded-xl
               pl-9 pr-9 py-2 text-sm text-white placeholder:text-trovao-muted
               focus:outline-none focus:border-trovao-gold"
  />
  <LupaIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-trovao-muted" />
  {query && (
    <button onClick={() => setQuery('')}
      className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6"
      aria-label="Limpar busca">×</button>
  )}
</div>

{query && (
  <p className="text-trovao-muted text-xs">
    {filtrados.length} de {usuarios.length} usuários
  </p>
)}
```

### Filtro

```ts
function normalizar(s: string) {
  return s.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');  // remove diacríticos
}
const q = normalizar(query.trim());
const filtrados = useMemo(() => (q
  ? usuarios.filter(u => normalizar(u.nome).includes(q) || normalizar(u.email).includes(q))
  : usuarios), [usuarios, q]);
```

Case-insensitive, sem acento, substring.

### Empty state

```tsx
{query && filtrados.length === 0 && (
  <div className="text-center py-8 space-y-2">
    <p className="text-trovao-muted text-sm">Nenhum usuário corresponde à busca.</p>
    <button onClick={() => setQuery('')} className="text-trovao-gold text-xs font-semibold">
      Limpar
    </button>
  </div>
)}
```

### Ícone da lupa

Inline SVG, sem nova dependência. Tamanho 16×16, `text-trovao-muted`.

### Sem persistência

Busca começa vazia a cada visita. Sem `?q=` na URL, sem localStorage.

### Endpoint

`GET /admin/usuarios` (já existente). Não usar `/admin/usuarios/buscar` — esse é para outro fluxo (busca global em outros contextos).

## Resumo de arquivos afetados

### Backend

- `apps/backend/src/admin/admin.controller.ts` — adicionar `GET /admin/publicacoes/pendente`.
- `apps/backend/src/admin/admin.service.ts` — adicionar `listarPublicacaoPendente()`.
- `apps/backend/src/publicacao/publicacao.service.ts` — refatorar `publicar` pra usar critério único.
- `apps/backend/src/ranking/ranking.controller.ts` (ou módulo correspondente) — adicionar `GET /boloes/:bolaoId/ranking/publicacoes/:numero/usuarios/:usuarioId/apostas`.
- `apps/backend/src/ranking/ranking.service.ts` — implementação.
- Testes unitários novos cobrindo as duas funções.

### Frontend

- `apps/frontend/src/lib/jogoEstado.ts` — refinar `EstadoAposta` (4 → 5 estados).
- `apps/frontend/src/lib/dataFormat.ts` — novo, `formatDataPublicacao`.
- `apps/frontend/src/components/RankingRow.tsx` — receber `posicaoRodada?` e renderizar `1ª (P 7ª)`; trocar conteúdo do expand quando aba=Rodada para nova lista de palpites; cache local da resposta.
- `apps/frontend/src/components/RankingPalpitesRodada.tsx` — novo componente para a lista de palpites no expand.
- `apps/frontend/src/components/JogoCard.tsx` — aplicar novos estados visuais e badges.
- `apps/frontend/src/components/AdminRankingPreview.tsx` — carregar pendentes, guard, integrar modal.
- `apps/frontend/src/components/AdminPublicarDialog.tsx` — novo, modal de confirmação.
- `apps/frontend/src/components/AdminUsuariosBusca.tsx` — opcional (input pode ficar inline na página).
- `apps/frontend/src/app/admin/usuarios/page.tsx` — adicionar input + filtro.
- `apps/frontend/src/app/(app)/ranking/[bolaoId]/page.tsx` — calcular `posicaoRodada` client-side; passar prop pro `RankingRow`; trocar label do select para data; adicionar linha auxiliar.
- `apps/frontend/src/types/api.ts` — tipos `JogoPendente`, `RodadaPalpiteItem`.
- `apps/frontend/src/components/ui/popover.tsx` — adicionar via `shadcn add popover`.
- Atualizar testes correspondentes: `RankingRow`, `JogoCard`, `FiltroJogosChips`.

### Documentação

- `README.md` — atualizar seção "Como funciona a pontuação e publicação" mencionando guard de pendentes + confirmação. Atualizar nota sobre ranking por rodada mencionando reordenação client-side e label por data. (Convenção do projeto: README sempre acompanha mudanças de regras de negócio.)

## Fora de escopo

- Mudança no critério de cálculo de pontos ou no fluxo de publicação backend.
- Reescrita do `RankingPodium` (mantido como está).
- Persistência da busca de usuários em URL/localStorage.
- Adicionar peso da pontuação a outros contextos.
