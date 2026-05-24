# M{N} — {Nome da Camada}

> **Spec:** [`2026-05-23-frontend-maduro-design.md`](../specs/2026-05-23-frontend-maduro-design.md#camada-n--nome)
> **Depende de:** [M{N-1}](./M{N-1}-nome.md)
> **Produz contratos:** [`contracts/{nome}.md`](../contracts/{nome}.md)
> **Status:** `pendente | em progresso | concluído`

---

## Contexto mínimo para esta sessão

Carregar antes de começar:
- [ ] [`context/stack.md`](../context/stack.md)
- [ ] [`context/visual-tokens.md`](../context/visual-tokens.md)
- [ ] [`contracts/{dependência}.md`](../contracts/{dependência}.md) ← se aplicável

---

## Escopo

**Dentro:** O que esta camada entrega.

**Fora:** O que esta camada NÃO faz (evita escopo creep).

---

## Arquivos afetados

| Ação | Caminho |
|---|---|
| Criar | `apps/frontend/src/components/Foo.tsx` |
| Modificar | `apps/frontend/src/app/(app)/layout.tsx` |
| Deletar | `apps/frontend/src/components/OldBar.tsx` |

---

## Tickets

- [ ] [T{N}01 — {título}](../tickets/T{N}01-{slug}.md)
- [ ] [T{N}02 — {título}](../tickets/T{N}02-{slug}.md)
- [ ] [T{N}03 — {título}](../tickets/T{N}03-{slug}.md)

---

## Critério de conclusão

- [ ] Todos os tickets acima marcados como concluídos
- [ ] `pnpm build` passa sem erros de tipo
- [ ] Contratos produzidos por esta camada estão escritos
- [ ] `INDEX.md` atualizado com status `concluído`

---

## Resumo operacional

*Uma ou duas frases: o que esta camada entrega e o que desbloqueia.*
