# M4 — Admin

> **Spec:** [`2026-05-23-frontend-maduro-design.md`](../specs/2026-05-23-frontend-maduro-design.md#camada-4--admin)
> **Depende de:** [M1 — Fundação](./M1-fundacao.md), [`contracts/ranking.md`](../contracts/ranking.md)
> **Produz contratos:** [`contracts/admin.md`](../contracts/admin.md)
> **Status:** `pendente`

---

## Contexto mínimo para esta sessão

Carregar antes de começar:
- [ ] [`context/stack.md`](../context/stack.md)
- [ ] [`context/visual-tokens.md`](../context/visual-tokens.md)
- [ ] [`context/routes.md`](../context/routes.md)
- [ ] [`context/backend-gaps.md`](../context/backend-gaps.md)
- [ ] [`contracts/ranking.md`](../contracts/ranking.md)

---

## Escopo

**Dentro:**
- Criar route group `/(admin)/` com `AdminLayout` + `AdminTopNav`
- Criar `AdminPlacardCard` — entrada de placar por jogo
- Criar `AdminRankingPreview` — ranking draft com botão publicar
- Criar `AdminUsuariosPage` — lista com toggles de status e role
- Implementar os 4 endpoints de backend que este módulo precisa

**Fora:**
- Não criar interface de bolão (M5)
- Não criar gestão de convites (M5)
- Não alterar a experiência do usuário comum

---

## Arquivos afetados

| Ação | Caminho |
|---|---|
| Criar | `apps/frontend/src/app/(admin)/layout.tsx` |
| Criar | `apps/frontend/src/app/(admin)/placares/page.tsx` |
| Criar | `apps/frontend/src/app/(admin)/ranking/page.tsx` |
| Criar | `apps/frontend/src/app/(admin)/usuarios/page.tsx` |
| Criar | `apps/frontend/src/components/AdminTopNav.tsx` |
| Criar | `apps/frontend/src/components/AdminPlacardCard.tsx` |
| Criar | `apps/frontend/src/components/AdminRankingPreview.tsx` |
| Criar | `apps/frontend/src/components/AdminUsuarioRow.tsx` |
| Criar | `apps/backend/src/admin/admin.controller.ts` |
| Criar | `apps/backend/src/admin/admin.service.ts` |
| Criar | `apps/backend/src/admin/admin.module.ts` |
| Modificar | `apps/backend/prisma/schema.prisma` — adicionar `rankingPublicadoEm`, `posicoesGanhas`, `ativo` |

---

## Tickets

- [ ] [T401 — AdminLayout + AdminTopNav com guard de role](../tickets/T401-admin-layout.md)
- [ ] [T402 — Tela de placares (AdminPlacardCard)](../tickets/T402-admin-placares.md)
- [ ] [T403 — Draft + publicação do ranking](../tickets/T403-admin-ranking.md)
- [ ] [T404 — Tela de usuários com toggles](../tickets/T404-admin-usuarios.md)
- [ ] [T405 — Migration Prisma: posicoesGanhas + rankingPublicadoEm + ativo](../tickets/T405-migration.md)

---

## Critério de conclusão

- [ ] Todos os tickets acima marcados como concluídos
- [ ] `pnpm build --filter frontend` e `pnpm build --filter backend` passam sem erros
- [ ] Admin consegue entrar placar → ver ranking draft → publicar → usuários veem variação de posição
- [ ] Usuário comum redirecionado para `/jogos` ao tentar acessar `/(admin)/`
- [ ] Contrato `admin.md` escrito
- [ ] `INDEX.md` atualizado com status `concluído`

---

## Resumo operacional

M4 cria a área administrativa completa: entrada de placares, preview/publicação do ranking e gestão de usuários. Requer 3 campos de schema e 4 novos endpoints no backend. Produz o contrato que M5 (moderador) precisa para saber como o sistema de permissões admin funciona.
