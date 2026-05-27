# Spec: Padrão de Telas + Bolão Favorito

**Data:** 2026-05-26  
**Status:** Aprovado

---

## Visão geral

Conjunto de melhorias de UX e consistência visual que unifica o padrão de seleção de bolão entre `/boloes` e `/ranking`, introduz o conceito de **bolão favorito** persistido no banco, ajusta ordenação e filtros de jogos em telas do app e admin, e reposiciona elementos de navegação.

---

## 1. Bolão favorito

### 1.1 Backend — Schema

Adicionar ao model `Usuario` em `schema.prisma`:

```prisma
bolaoFavoritoId String?
bolaoFavorito   Bolao?  @relation("UsuarioBolaoFavorito", fields: [bolaoFavoritoId], references: [id])
```

Adicionar ao model `Bolao`:

```prisma
favoritadoPor   Usuario[] @relation("UsuarioBolaoFavorito")
```

Gerar nova migration Prisma.

### 1.2 Backend — Endpoint

**`PATCH /usuarios/me/favorito`**  
Body: `{ bolaoId: string | null }`

- Se `bolaoId` não é null: verifica que o usuário autenticado tem um `BolaoMembro` para aquele bolão; retorna 403 caso contrário.
- Atualiza `bolaoFavoritoId` do usuário.
- Retorna o usuário atualizado com `bolaoFavoritoId`.

**`GET /usuarios/me`** — incluir `bolaoFavoritoId` no SELECT do `UsuarioService.perfil()`.

### 1.3 Frontend — Tipo

`apps/frontend/src/types/api.ts` — adicionar ao `Usuario`:

```ts
bolaoFavoritoId?: string | null;
```

### 1.4 Frontend — Componente `BolaoCard`

Novo componente compartilhado `apps/frontend/src/components/BolaoCard.tsx`:

- Props: `bolao: Bolao`, `href: string`, `favoritoId?: string | null`, `onFavoritoChange?: () => void`
- Visual: card no padrão `bg-trovao-card border border-trovao-border rounded-xl`, exibe `nome`, `descricao` (se houver) e contagem de membros
- **Sem badge de status** (remove ATIVO/PAGO/ARQUIVADO)
- Estrela à direita: renderizada **somente quando `onFavoritoChange` é fornecido**. `★` dourada (`text-trovao-gold`) se `bolao.id === favoritoId`, `☆` cinza (`text-trovao-muted`) caso contrário
- Clique na estrela → abre Dialog de confirmação (não navega)
- Clique no card (fora da estrela) → navega para `href`

### 1.5 Frontend — Modal de confirmação

Dentro do `BolaoCard`, estado local `confirmOpen: boolean`.

Dialog (usando `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` de `@/components/ui/dialog`):

- Título: `★ Definir bolão favorito`
- Descrição: `"<nome do bolão>" será seu bolão padrão nos menus Bolões e Ranking.`
- Rodapé: botão `Cancelar` (variant `outline`) + botão `Confirmar ★` (classe `bg-trovao-gold text-trovao-base font-bold`)
- Confirmar → `PATCH /usuarios/me/favorito` com `{ bolaoId: bolao.id }` → chama `onFavoritoChange()`
- `onFavoritoChange` nas páginas chamará `refresh()` do `useAuth()` para atualizar o user no contexto

---

## 2. Páginas `/boloes` e `/ranking` — padrão unificado

### 2.1 `/boloes/page.tsx`

- Adicionar `useAuth()` para obter `user` e `refresh`
- Substituir o `BolaoItem` inline pelo novo `BolaoCard` — tanto na lista "Meus Bolões" quanto nos resultados de busca
- Remover badge de status (ATIVO/PAGO/ARQUIVADO)
- Passar `favoritoId={user?.bolaoFavoritoId}` e `onFavoritoChange={refresh}` em todos os cards

### 2.2 `/ranking/page.tsx`

- Redesenhar para o mesmo estilo visual de `/boloes`: cards com `BolaoCard` em vez de links simples
- Bolão Global (`BOLAO_GLOBAL_ID`) listado primeiro: usar `BolaoCard` **sem** `onFavoritoChange` (prop omitida → estrela não renderizada)
- Bolões privados listados abaixo: usar `BolaoCard` com `onFavoritoChange={refresh}` (estrela habilitada)
- Remover badge de status
- Exibir contagem de membros (`_count.membros` já retornado pelo endpoint `/boloes/meus`)

---

## 3. BottomNav — destino padrão com favorito

`apps/frontend/src/components/BottomNav.tsx`:

Hrefs dinâmicos calculados dentro do componente:

```ts
const hrefBoloes  = user?.bolaoFavoritoId ? `/boloes/${user.bolaoFavoritoId}`  : '/boloes';
const hrefRanking = user?.bolaoFavoritoId ? `/ranking/${user.bolaoFavoritoId}` : '/ranking';
```

O check de `active` permanece baseado em `pathname.startsWith('/boloes')` e `pathname.startsWith('/ranking')` — comportamento visual inalterado.

---

## 4. Ranking `/ranking/[bolaoId]` — ajustes

### 4.1 Botão Voltar

Alterar `href` de `← Voltar` de `/boloes/${bolaoId}` para `/ranking`.

### 4.2 Pódio na aba Rodada

Renderizar `<RankingPodium>` também quando `aba === 'rodada'`, passando os entries com `pontuacaoTotal` substituído por `pontuacaoRodada` (mesmo mapeamento já aplicado nas `RankingRow` da aba rodada):

```tsx
{aba === 'rodada' && (
  <RankingPodium
    ranking={ordenado.map(e => ({ ...e, pontuacaoTotal: e.pontuacaoRodada }))}
    myId={user?.id}
  />
)}
```

---

## 5. `JogoCard` — link Palpites no header

`apps/frontend/src/components/JogoCard.tsx`:

Nova prop opcional: `palpitesHref?: string`

Quando fornecida, renderizar no canto superior direito do header (ao lado do badge de peso e horário):

```tsx
{palpitesHref && (
  <Link href={palpitesHref} className="text-trovao-gold text-[10px] font-bold hover:underline shrink-0">
    Palpites →
  </Link>
)}
```

O link deve usar `import Link from 'next/link'`.

---

## 6. `/boloes/[id]/page.tsx` — jogos encerrados + ordem

**Filtro:** exibir apenas jogos com prazo encerrado (`prazoEncerrado(jogo) === true`).

**Ordenação:**
1. Sem placar (`placarCasa === null`) — crescente por `dataHora` (mais antigos primeiro, pendentes de placar)
2. Com placar (`placarCasa !== null`) — decrescente por `dataHora` (mais recentes primeiro)

```ts
const jogosEncerrados = jogos
  .filter(prazoEncerrado)
  .sort((a, b) => {
    const aTemPlacar = a.placarCasa !== null;
    const bTemPlacar = b.placarCasa !== null;
    if (aTemPlacar !== bTemPlacar) return aTemPlacar ? 1 : -1;
    const diff = new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime();
    return aTemPlacar ? -diff : diff;
  });
```

**Link Palpites:** passar `palpitesHref={`/boloes/${id}/palpites/${jogo.id}`}` para `JogoCard`. Remover o bloco `{prazoEncerrado(jogo) && <Link ...>Ver palpites</Link>}` abaixo do card — agora está dentro do card.

---

## 7. `/admin/placares/page.tsx` — jogos encerrados + ordem

Mesma lógica de filtro e ordenação do item 6, aplicada client-side após o fetch de `/jogos`.

A função `prazoEncerrado` deve ser importada de `@/lib/jogoEstado` (ou extraída como utilitário — ela já existe inline em `/boloes/[id]/page.tsx` e deve ser centralizada em `jogoEstado.ts`).

---

## 8. `AdminTopNav` — link "← App" à direita

`apps/frontend/src/components/AdminTopNav.tsx`:

Mover o `<Link href="/jogos">← App</Link>` para depois dos itens de navegação, com `ml-auto` para empurrá-lo à direita:

```tsx
<div className="max-w-2xl mx-auto flex items-center gap-1 h-12">
  <span className="text-trovao-gold font-bold text-sm mr-4">Admin</span>
  {NAV.map(...)}
  <Link href="/jogos" className="ml-auto text-trovao-muted text-xs hover:text-white">
    ← App
  </Link>
</div>
```

---

## Arquivos afetados

| Arquivo | Tipo de mudança |
|---|---|
| `apps/backend/prisma/schema.prisma` | Adicionar campo `bolaoFavoritoId` em `Usuario` e relação em `Bolao` |
| `apps/backend/prisma/migrations/...` | Nova migration |
| `apps/backend/src/usuario/usuario.service.ts` | `perfil()` inclui `bolaoFavoritoId`; novo método `atualizarFavorito()` |
| `apps/backend/src/usuario/usuario.controller.ts` | Novo endpoint `PATCH /usuarios/me/favorito` |
| `apps/backend/src/usuario/dto/update-favorito.dto.ts` | Novo DTO |
| `apps/frontend/src/types/api.ts` | `bolaoFavoritoId` em `Usuario` |
| `apps/frontend/src/components/BolaoCard.tsx` | Novo componente |
| `apps/frontend/src/app/(app)/boloes/page.tsx` | Usar `BolaoCard` |
| `apps/frontend/src/app/(app)/ranking/page.tsx` | Redesenho com `BolaoCard` |
| `apps/frontend/src/components/BottomNav.tsx` | Hrefs dinâmicos com favorito |
| `apps/frontend/src/app/(app)/ranking/[bolaoId]/page.tsx` | Voltar → `/ranking`; pódio na aba Rodada |
| `apps/frontend/src/components/JogoCard.tsx` | Prop `palpitesHref` |
| `apps/frontend/src/app/(app)/boloes/[id]/page.tsx` | Filtro+ordenação; usar `palpitesHref` |
| `apps/frontend/src/lib/jogoEstado.ts` | Exportar `prazoEncerrado` como função utilitária |
| `apps/frontend/src/app/admin/placares/page.tsx` | Filtro+ordenação |
| `apps/frontend/src/components/AdminTopNav.tsx` | `← App` para a direita |
