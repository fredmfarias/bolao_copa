# M5 — Bolão / Convite

> **Spec:** [`2026-05-23-frontend-maduro-design.md`](../specs/2026-05-23-frontend-maduro-design.md#camada-5--bolão--convite)
> **Depende de:** [M1 — Fundação](./M1-fundacao.md), [`contracts/admin.md`](../contracts/admin.md)
> **Produz contratos:** [`contracts/convite.md`](../contracts/convite.md)
> **Status:** `pendente`

---

## Contexto mínimo para esta sessão

Carregar antes de começar:
- [ ] [`context/stack.md`](../context/stack.md)
- [ ] [`context/visual-tokens.md`](../context/visual-tokens.md)
- [ ] [`context/routes.md`](../context/routes.md)
- [ ] [`context/backend-gaps.md`](../context/backend-gaps.md)
- [ ] [`contracts/admin.md`](../contracts/admin.md)

---

## Escopo

**Dentro:**
- Painel do moderador em `BolaoDetalhePage` (ações: convidar, aprovar/recusar, eleger, remover)
- `ConvitePanel` — gera link de convite com código, botão copiar, QR code
- Landing pública `/convite/[codigo]` com 5 estados de máquina
- Redirect pós-auth com `?redirect=` para completar o fluxo de convite
- Endpoint público `GET /convites/:codigo` no backend

**Fora:**
- Não alterar a área admin de usuários (M4)
- Não criar gestão de bolões para usuário comum além do que já existe

---

## Arquivos afetados

| Ação | Caminho |
|---|---|
| Modificar | `apps/frontend/src/app/(app)/boloes/[id]/page.tsx` |
| Criar | `apps/frontend/src/components/ConvitePanel.tsx` |
| Criar | `apps/frontend/src/components/ModeradorPanel.tsx` |
| Criar | `apps/frontend/src/app/convite/[codigo]/page.tsx` |
| Criar | `apps/backend/src/bolao/dto/convite-publico.dto.ts` |
| Modificar | `apps/backend/src/bolao/bolao.controller.ts` |
| Modificar | `apps/backend/src/bolao/bolao.service.ts` |

---

## Tickets

- [ ] [T501 — ConvitePanel: gerar link + copiar + QR](../tickets/T501-convite-panel.md)
- [ ] [T502 — ModeradorPanel: aprovar/recusar/eleger/remover membros](../tickets/T502-moderador-panel.md)
- [ ] [T503 — Endpoint GET /convites/:codigo (público)](../tickets/T503-endpoint-convite.md)
- [ ] [T504 — Landing /convite/[codigo] com 5 estados](../tickets/T504-landing-convite.md)
- [ ] [T505 — Redirect pós-auth com ?redirect=](../tickets/T505-redirect-auth.md)

---

## 5 estados da landing `/convite/[codigo]`

| Estado | Condição | UI |
|---|---|---|
| `loading` | Buscando convite | Skeleton |
| `invalid` | Token não encontrado / expirado | Mensagem de erro + link para home |
| `unauthenticated` | Convite válido, usuário não logado | Info do bolão + botão "Entrar para aceitar" → `/login?redirect=...` |
| `ready` | Convite válido, usuário logado | Info do bolão + botão "Aceitar convite" |
| `success` | Entrou no bolão | Confirmação + botão "Ver bolão" |

---

## Critério de conclusão

- [ ] Todos os tickets acima marcados como concluídos
- [ ] `pnpm build --filter frontend` e `pnpm build --filter backend` passam sem erros
- [ ] Fluxo completo: moderador gera link → usuário não logado abre → faz login → volta → aceita → entra no bolão
- [ ] Contrato `convite.md` escrito
- [ ] `INDEX.md` atualizado com status `concluído`

---

## Resumo operacional

M5 fecha o ciclo social do produto: o moderador convida, o convidado vê uma landing cuidada e entra com um clique. Depende de um único novo endpoint no backend (lookup público de convite). Produz o último contrato da arquitetura documental.
