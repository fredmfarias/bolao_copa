# Link do Regulamento em Convite/Perfil + "Voltar" contextual

**Data:** 2026-06-02
**Branch:** `feat/link-regulamento-convite-perfil`

## Objetivo

Tornar o regulamento acessível a partir das telas de Convite e Perfil (hoje só
o Login linka pra ele) e fazer o botão "Voltar" da página de Regulamento
retornar para a tela de origem, em vez de sempre ir para o login.

## Contexto atual

- `apps/frontend/src/app/(auth)/login/page.tsx` — já tem um link `Regulamento`
  (aponta para `/regulamento`, sem origem).
- `apps/frontend/src/app/regulamento/page.tsx` — link de volta **hardcoded**
  `Voltar ao login` → `/login`.
- `apps/frontend/src/app/convite/[codigo]/page.tsx` — **sem** link de regulamento.
- `apps/frontend/src/app/(app)/perfil/page.tsx` — **sem** link de regulamento.

## Abordagem

A origem é passada por **query param `?from=<rota>`**. Cada tela que linka para o
regulamento informa a própria rota; o "Voltar" navega para esse valor. É
explícito, robusto (não depende de histórico do navegador) e já é o padrão do
projeto (o login usa `?redirect=`).

Quando não há `from` (acesso direto ao `/regulamento`), o fallback é `/login`.

Alternativas descartadas: `router.back()` / `document.referrer` (frágil em acesso
direto ou reload) e `sessionStorage` (estado implícito, mais difícil de testar).

## Mudanças

### 1. Página Regulamento (`regulamento/page.tsx`)

- Ler `from` via `useSearchParams()`, com fallback `'/login'`.
- O link de volta passa a ser **"Voltar"** (rótulo genérico) apontando para `from`.
- Como passa a usar `useSearchParams`, o conteúdo vai para um componente interno
  embrulhado em `<Suspense>` (mesmo padrão de `login/page.tsx`).

**Comportamento do "Voltar":**

| Origem                         | `from`                  | Destino do Voltar       |
| ------------------------------ | ----------------------- | ----------------------- |
| Convite `/convite/ABC123`      | `/convite/ABC123`       | `/convite/ABC123`       |
| Perfil                         | `/perfil`               | `/perfil`               |
| Login                          | `/login`                | `/login`                |
| Acesso direto (sem `from`)     | —                       | `/login` (fallback)     |

### 2. Tela de Convite (`convite/[codigo]/page.tsx`)

- Link "Regulamento" → `/regulamento?from=/convite/${codigo}`.
- Exibido nos estados onde o usuário decide participar: **`nao-autenticado`** e
  **`pronto`**, no rodapé do card, em estilo discreto consistente com os demais
  links/botões do card.

### 3. Tela de Perfil (`(app)/perfil/page.tsx`)

- Link "Regulamento" → `/regulamento?from=/perfil`, como link simples
  (ex.: próximo ao botão "Sair").

### 4. Tela de Login (`(auth)/login/page.tsx`)

- O link já existe; passa a incluir a origem: `/regulamento?from=/login`.

## Testes

- `ConvitePage.test.tsx` — link "Regulamento" presente (estados `nao-autenticado`
  e `pronto`) com `href` contendo `from=/convite/<codigo>`.
- `PerfilPage.test.tsx` — link "Regulamento" presente com `from=/perfil`.
- `LoginPage.test.tsx` — link "Regulamento" presente com `from=/login`.
- Regulamento — "Voltar" usa o valor de `from`; cai em `/login` quando ausente.

## Fora de escopo

- Alterar o conteúdo do regulamento.
- Abrir o regulamento em nova aba.
- Mudanças em estilos globais.
