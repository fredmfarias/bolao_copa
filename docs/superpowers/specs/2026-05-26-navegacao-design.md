# Design: Ajustes de Navegação

**Data:** 2026-05-26  
**Status:** Aprovado

## Contexto

O app possui três problemas de navegação:

1. A tela de palpites (`/boloes/[id]/palpites/[jogoId]`) não tem como voltar para a tela anterior.
2. O item "Ranking" no `BottomNav` aponta para `/ranking`, rota inexistente (o ranking real fica em `/ranking/[bolaoId]`), causando 404.
3. Usuários com `role === 'ADMIN'` não têm como navegar para a área admin nem voltar dela para a área comum.

## Mudança A — Botão voltar em Palpites

**Arquivo afetado:** `apps/frontend/src/app/(app)/boloes/[id]/palpites/[jogoId]/page.tsx`

Adicionar um `Link` com texto `← Voltar` no topo do conteúdo da página, antes do cabeçalho do jogo. O link aponta para `/boloes/${bolaoId}`, onde `bolaoId` já está disponível via `useParams`.

Segue o padrão existente em `RankingPage` (linha 52 do mesmo arquivo de ranking), com estilo `text-trovao-muted text-sm hover:text-white`.

## Mudança B — Nova página `/ranking` (listagem de bolões)

**Arquivo novo:** `apps/frontend/src/app/(app)/ranking/page.tsx`

Nova página index para a rota `/ranking`. Comportamento:

1. Busca `GET /boloes/meus` para obter os bolões do usuário.
2. Exibe o bolão global como primeiro item fixo com label "Global" (usando `BOLAO_GLOBAL_ID` importado de `@bolao/shared`).
3. Em seguida exibe os bolões privados do usuário.
4. Cada item é um `Link` para `/ranking/[b.id]`.
5. Usa `PageSkeleton` durante carregamento e `EmptyState` se não houver bolões.

O `BottomNav` já aponta para `/ranking` — nenhuma mudança necessária nele para este item. A detecção de aba ativa (`pathname.startsWith('/ranking')`) também cobre `/ranking/[bolaoId]`, destacando o item corretamente ao navegar para rankings específicos.

## Mudança C — Navegação bidirecional admin ↔ usuário

### Saída do admin → usuário

**Arquivo afetado:** `apps/frontend/src/components/AdminTopNav.tsx`

Adicionar um `Link` com texto `← App` à esquerda do label "Admin" na barra de navegação. O link leva para `/jogos`. Estilo discreto: `text-trovao-muted text-xs hover:text-white`.

### Entrada usuário → admin

**Arquivo afetado:** `apps/frontend/src/components/BottomNav.tsx`

O `BottomNav` passa a usar `useAuth()` para acessar o role do usuário. Quando `user?.role === 'ADMIN'`, um 5º item "Admin" é renderizado após "Perfil". 

- Ícone: `ShieldCheck` (lucide-react)
- Label: `Admin`
- Href: `/admin/boloes`
- Detecção de ativo: `pathname.startsWith('/admin')`

O item é invisível para usuários comuns — nenhuma mudança visual para eles.

## Arquivos modificados / criados

| Ação     | Arquivo |
|----------|---------|
| Modificar | `apps/frontend/src/app/(app)/boloes/[id]/palpites/[jogoId]/page.tsx` |
| Criar     | `apps/frontend/src/app/(app)/ranking/page.tsx` |
| Modificar | `apps/frontend/src/components/AdminTopNav.tsx` |
| Modificar | `apps/frontend/src/components/BottomNav.tsx` |

## Fora de escopo

- Reordenar ou redesenhar o `BottomNav` para não-admins.
- Criar uma rota `/admin` raiz (redirecionar para `/admin/boloes` se necessário fica para outra tarefa).
- Alterar a tela de ranking individual (`/ranking/[bolaoId]`).
