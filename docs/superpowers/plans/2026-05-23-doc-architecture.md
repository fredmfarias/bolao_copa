# Arquitetura Documental — Frontend Maduro

**Goal:** Criar uma estrutura de documentos modular que permita implementar o frontend em camadas com mínimo de tokens por sessão.

**Architecture:** Cada sessão de implementação carrega apenas o contexto relevante para aquela camada. Contratos são a cola entre camadas — produzidos pelo módulo anterior, consumidos pelo próximo.

**Tech Stack:** Next.js 14, TypeScript, Tailwind, shadcn/ui, pnpm monorepo.

---

## 1. Árvore de arquivos proposta

```
docs/superpowers/
├── INDEX.md                          ← hub de navegação e status dos módulos
├── specs/
│   └── 2026-05-23-frontend-maduro-design.md   ← fonte da verdade (NÃO editar)
├── context/                          ← contexto estável · carregar 1× por sessão
│   ├── stack.md
│   ├── visual-tokens.md
│   ├── routes.md
│   └── backend-gaps.md
├── contracts/                        ← interfaces entre módulos · carregar por demanda
│   ├── jogo-card.md
│   ├── aposta-drawer.md
│   ├── ranking.md
│   ├── admin.md
│   └── convite.md
├── modules/                          ← planos de implementação · um por camada
│   ├── M1-fundacao.md
│   ├── M2-apostas.md
│   ├── M3-ranking.md
│   ├── M4-admin.md
│   └── M5-bolao-convite.md
└── templates/                        ← templates em branco · copiar para criar novos docs
    ├── module-plan.md
    ├── contract.md
    └── ticket.md
```

---

## 2. Responsabilidade de cada arquivo

### `INDEX.md`
Tabela de status de todos os módulos + links diretos. Único arquivo que deve ser lido em toda sessão antes de qualquer outra coisa. Nunca contém conteúdo técnico.

---

### `context/stack.md`
Versões exatas de libs, comandos de dev/build/test, estrutura de pastas do monorepo, convenções de import. Não muda entre módulos.

### `context/visual-tokens.md`
Paleta de cores com valores hex, extensão do `tailwind.config.ts`, classes utilitárias padrão (card, CTA, badge, chip). Não muda entre módulos.

### `context/routes.md`
Árvore de rotas do Next.js App Router, qual layout cada rota usa, guards de auth/admin, convenção de nomeclatura de pastas. Não muda entre módulos.

### `context/backend-gaps.md`
Lista de endpoints ainda não existentes no backend — método, path, request body esperado, response esperado, em qual camada é necessário. Atualizado quando um endpoint é implementado.

---

### `contracts/jogo-card.md`
Props do `JogoCard`, os 4 estados visuais (aberto / salvo / incompleto / fechado), eventos emitidos. Produzido ao planejar M2, consumido por M3 (palpites).

### `contracts/aposta-drawer.md`
Props do `ApostaDrawer` (Sheet), comportamento do auto-save, callbacks `onSave`/`onClose`, estados internos do stepper. Produzido ao planejar M2, consumido por M3.

### `contracts/ranking.md`
Shape do `RankingEntry` estendido (com `posicoesGanhas`), props de `RankingPodium` e `RankingRow`, o que o endpoint `GET /boloes/:id/ranking` precisa retornar. Produzido ao planejar M3, consumido por M4 (preview admin).

### `contracts/admin.md`
Hook `useAdmin()`, guard de rota `/(admin)/`, estrutura do `AdminTopNav`, convenção de chamadas `PATCH /admin/*`. Produzido ao planejar M4, consumido por M5 (moderador é sub-admin).

### `contracts/convite.md`
Máquina de estados da landing `/convite/[codigo]` (5 estados), tipos TypeScript dos 4 endpoints de convite, fluxo de redirect pós-auth com `?redirect=`. Produzido ao planejar M5, sem consumidor downstream.

---

### `modules/M1-fundacao.md`
Tickets para: instalar shadcn/ui, atualizar `tailwind.config.ts` + `globals.css`, criar hooks (`useAutoSave`, `useAdmin`, `useModerador`), criar `BottomNav`, `SelecaoAvatar`, `ScoreDisplay`, `PageSkeleton`, `EmptyState`.
Depende de: nada. Produz contratos: nenhum (apenas fundação interna).

### `modules/M2-apostas.md`
Tickets para: reescrever `JogoCard`, criar `ApostaDrawer` com steppers, agrupar lista de jogos por data, chips de filtro horizontal.
Depende de: [M1](./M1-fundacao.md). Produz: [`contracts/jogo-card.md`](../contracts/jogo-card.md), [`contracts/aposta-drawer.md`](../contracts/aposta-drawer.md).

### `modules/M3-ranking.md`
Tickets para: criar `RankingPodium`, `RankingRow` com Accordion, `ApostasDialog`, tela `/palpites/[jogoId]`, estado "aguardando publicação".
Depende de: [M1](./M1-fundacao.md), [`contracts/aposta-drawer.md`](../contracts/aposta-drawer.md). Produz: [`contracts/ranking.md`](../contracts/ranking.md).

### `modules/M4-admin.md`
Tickets para: criar route group `/(admin)/` com layout, `AdminTopNav`, `AdminPlacardCard`, `AdminRankingPreview` com botão publicar, `AdminUsuariosPage` com toggles.
Depende de: [M1](./M1-fundacao.md), [`contracts/ranking.md`](../contracts/ranking.md). Produz: [`contracts/admin.md`](../contracts/admin.md).

### `modules/M5-bolao-convite.md`
Tickets para: painel do moderador em `BolaoDetalhePage`, `ConvitePanel`, landing pública `/convite/[codigo]`, redirect pós-auth com `?redirect=`.
Depende de: [M1](./M1-fundacao.md), [`contracts/admin.md`](../contracts/admin.md). Produz: [`contracts/convite.md`](../contracts/convite.md).

---

### `templates/module-plan.md`
Template em branco para planos de módulo. Copiar e preencher ao iniciar cada camada.

### `templates/contract.md`
Template em branco para contratos. Copiar e preencher ao concluir cada módulo.

### `templates/ticket.md`
Template em branco para tickets técnicos. Copiar e preencher dentro dos módulos.

---

## 3. Ordem recomendada de criação

```
① templates/          ← criar os 3 templates primeiro (referência para o resto)
② INDEX.md            ← hub vazio mas estruturado
③ context/stack.md
④ context/visual-tokens.md
⑤ context/routes.md
⑥ context/backend-gaps.md
   ── iniciar implementação M1 ──
⑦ modules/M1-fundacao.md     ← plano detalhado com tickets
   ── executar M1 ──
   ── iniciar M2 ──
⑧ contracts/jogo-card.md     ← escrito antes de planejar M2
⑨ contracts/aposta-drawer.md
⑩ modules/M2-apostas.md
   ── executar M2 ──
   ── e assim por diante ──
```

**Regra:** O contrato é escrito DEPOIS que o módulo produtor é implementado e ANTES que o módulo consumidor seja planejado. Isso garante que o contrato reflete código real, não intenção.

---

## Resumo operacional

Esta arquitetura separa o projeto em 4 camadas de documentos (contexto → contratos → módulos → tickets) com responsabilidade única por arquivo. Uma sessão típica de implementação carrega: `INDEX.md` + 1–2 arquivos de `context/` + o contrato relevante + o módulo ativo. Total estimado por sessão: ~3–4 arquivos em vez de carregar a spec inteira (421 linhas).
