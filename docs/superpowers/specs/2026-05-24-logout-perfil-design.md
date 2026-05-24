# Design: Logout via Perfil

**Data:** 2026-05-24
**Status:** Aprovado

## Objetivo

Permitir que o usuário encerre sua sessão clicando em "Sair" na página de perfil, sendo deslogado e redirecionado imediatamente para a tela de login.

## Contexto

A infraestrutura de autenticação já está completa:

- `AuthProvider` expõe `logout()` — chama `POST /auth/logout` (limpa o cookie `refresh_token` no backend), remove o `accessToken` do `sessionStorage` e seta `user = null`
- `AppLayout` já redireciona para `/login` automaticamente quando `user` é null
- A página `/perfil` já importa `useAuth()`, mas não usa `logout`

O único trabalho é expor o ponto de entrada (botão) na UI.

## Escopo

**Um único arquivo alterado:** `apps/frontend/src/app/(app)/perfil/page.tsx`

Nenhuma alteração no backend, no `AuthProvider`, no `AppLayout` ou em outros componentes.

## Design detalhado

### Mudanças em `perfil/page.tsx`

1. **Desestruturar `logout`** do `useAuth()` (ao lado de `user` e `refresh`)
2. **Importar `useRouter`** do `next/navigation` (já usado no `AppLayout`, padrão da app)
3. **Adicionar `handleLogout`** — função assíncrona que chama `logout()` e depois `router.push('/login')`
4. **Adicionar botão "Sair"** ao final da página, abaixo do formulário, com estilo de ação destrutiva

### Fluxo de execução

```
Usuário clica "Sair"
  → handleLogout()
    → POST /auth/logout          (backend limpa cookie refresh_token)
    → clearAccessToken()         (frontend limpa sessionStorage)
    → setUser(null)              (AuthProvider)
    → router.push('/login')      (navegação imediata)
  → Tela de login exibida
```

### Estilo do botão

Segue Tailwind, padrão da app, com cor destrutiva para diferenciar do botão "Salvar":

```
border border-red-500 text-red-400 hover:bg-red-500/10 px-6 py-2 rounded-lg font-medium
```

Posicionado abaixo do `<form>`, separado visualmente por espaçamento (`mt-6` ou dentro do `space-y-6` existente).

### Comportamento de loading

O botão exibe "Saindo..." enquanto a chamada ao backend está em andamento, e fica desabilitado (`disabled`) para evitar cliques duplos.

## O que não muda

- Sem modal de confirmação (logout imediato, conforme decisão do usuário)
- Sem alterações no `BottomNav`
- Sem alterações no backend
- Sem novos componentes ou arquivos
