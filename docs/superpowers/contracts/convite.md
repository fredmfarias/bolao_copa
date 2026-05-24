# Contrato — Convite

> **Produzido em:** M5 — Bolão/Convite
> **Necessário para:** — (módulo terminal)

---

## Localização

| Componente/Arquivo | Responsabilidade |
|---|---|
| `apps/frontend/src/components/ConvitePanel.tsx` | Gerar link de convite (só para moderadores) |
| `apps/frontend/src/components/ModeradorPanel.tsx` | Gerenciar membros (remover / promover) |
| `apps/frontend/src/app/convite/[codigo]/page.tsx` | Landing page pública do convite |
| `apps/frontend/src/app/(auth)/login/page.tsx` | Suporte a `?redirect=` pós-auth |
| `apps/backend/src/bolao/bolao.controller.ts` | `ConvitePublicoController` (sem JWT) |
| `apps/backend/src/bolao/bolao.service.ts` | `lookupConvite(token)` |

---

## Interfaces públicas dos componentes

```typescript
interface ConvitePanelProps {
  bolaoId: string;
}

interface ModeradorPanelProps {
  bolaoId: string;
  membros: BolaoMembro[];
  onAtualizado: () => void;
}
```

---

## Rotas backend

| Método | Rota | Auth | Ação |
|---|---|---|---|
| `GET` | `/convites/:token` | público | Lookup do convite (nome bolão, criador, validade) |
| `POST` | `/boloes/:bolaoId/convite` | JWT + moderador | Gerar novo token de convite |
| `POST` | `/boloes/entrar/:token` | JWT | Entrar no bolão via token |

`ConvitePublicoController` está registrado **antes** de `BolaoController` no módulo para evitar que o guard JWT do `BolaoController` intercepte a rota pública.

---

## Resposta de `GET /convites/:token`

```typescript
{
  valido: boolean;
  bolaoId: string | null;
  bolaoNome: string | null;
  descricao: string | null;
  criadorNome: string | null;
  expiraEm: string | null; // ISO 8601 ou null
}
```

---

## Estados da landing page `/convite/[codigo]`

| Estado | Condição | Ação disponível |
|---|---|---|
| `carregando` | Await inicial | `<PageSkeleton />` |
| `invalido` | `valido === false` | Botão "Ir para Jogos" |
| `nao-autenticado` | `valido === true` + não logado | Botão "Fazer login" → `/login?redirect=/convite/:codigo` |
| `pronto` | `valido === true` + logado | Botão "Entrar no Bolão" |
| `entrando` | POST em andamento | Botão desabilitado |
| `sucesso` | POST concluído | Mensagem + redirect automático para `/boloes/:bolaoId` |

---

## Redirect pós-auth

Login page lê `useSearchParams().get('redirect')` e redireciona após login bem-sucedido. Padrão: `/jogos`.

---

## Integração em boloes/[id]/page.tsx

`ConvitePanel` e `ModeradorPanel` são exibidos apenas quando:
```typescript
const isModerador = bolao.membros?.find(m => m.usuarioId === user?.id)?.papel === 'MODERADOR';
```
Não-moderadores veem a lista simples de membros.

---

## Dependências internas

- `BolaoMembro` de `@/types/api`
- `PageSkeleton` de `@/components/PageSkeleton`
- `useAuth()` de `@/components/AuthProvider`
- `BolaoMembroPapel`, `BOLAO_GLOBAL_ID` de `@bolao/shared` (backend)
