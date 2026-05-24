# Spec: Confirmação de E-mail — Correção de Rota e UX de Redirecionamento

**Data:** 2026-05-24  
**Status:** Aprovado

---

## Contexto

Quando um usuário se cadastra, o backend envia um e-mail com um link de confirmação. O link gerado apontava para `/auth/confirmar-email`, mas a página no Next.js App Router está em `app/(auth)/confirmar-email/page.tsx` — route groups com parênteses não adicionam segmento à URL, então a rota real é `/confirmar-email`. Isso causa um 404 ao clicar no link.

Além disso, a UX atual exibe uma mensagem inline com um link manual para o login. O comportamento desejado é redirecionar automaticamente para a tela de login com uma mensagem de sucesso visível.

---

## Escopo

Três alterações pontuais em dois apps:

1. **Backend** — corrigir o URL gerado no e-mail de confirmação
2. **Frontend (confirmar-email)** — trocar mensagem inline por redirecionamento automático
3. **Frontend (login)** — exibir banner de sucesso quando vier de uma confirmação

---

## Alteração 1 — Backend: URL do e-mail

**Arquivo:** `apps/backend/src/auth/auth.service.ts`

Mudar o segmento do path de `/auth/confirmar-email` para `/confirmar-email`:

```typescript
// antes
const url = `${this.config.get('APP_URL')}/auth/confirmar-email?token=${token}`;

// depois
const url = `${this.config.get('APP_URL')}/confirmar-email?token=${token}`;
```

Nenhuma outra mudança no backend.

---

## Alteração 2 — Frontend: Página de confirmação

**Arquivo:** `apps/frontend/src/app/(auth)/confirmar-email/page.tsx`

Comportamento atual: exibe mensagem inline + link manual para login.

Comportamento novo:
- **Sucesso:** após a API retornar `{ message }`, redirecionar via `router.push('/login?emailConfirmado=true')`
- **Erro:** manter exibição inline da mensagem de erro (token inválido, expirado ou ausente) — não redirecionar em caso de falha

Mudanças necessárias:
- Adicionar `useRouter` da `next/navigation`
- Remover estado `ok` e o `<Link>` condicional
- Substituir `setMsg(d.message); setOk(true)` por `router.push('/login?emailConfirmado=true')`

---

## Alteração 3 — Frontend: Página de login

**Arquivo:** `apps/frontend/src/app/(auth)/login/page.tsx`

Ler o search param `emailConfirmado`. Se presente e truthy, exibir um banner verde acima do formulário:

```
E-mail verificado com sucesso! Faça login para continuar.
```

O banner usa a mesma paleta do projeto (`text-green-400`, `bg-gray-900`). Não é um toast — é um elemento estático dentro do card de login, similar ao tratamento de erro atual (`text-red-400`).

---

## Fluxo completo pós-implementação

```
1. Usuário se cadastra
2. Backend envia e-mail com link: APP_URL + /confirmar-email?token=JWT
3. Usuário clica no link
4. Next.js serve /confirmar-email (sem 404)
5. Página chama GET /auth/confirmar-email?token=JWT (backend)
6. Backend verifica JWT, seta emailVerificado: true
7. Frontend recebe sucesso → router.push('/login?emailConfirmado=true')
8. Página de login exibe banner verde de sucesso
9. Usuário faz login normalmente
```

---

## Casos de erro (sem mudança)

- Token ausente: mensagem "Token não encontrado." na própria página
- Token inválido ou expirado: mensagem do backend na própria página (não redireciona)

---

## Fora do escopo

- Reenvio de e-mail de confirmação
- Expiração e renovação do token
- Mudanças no template HTML do e-mail
