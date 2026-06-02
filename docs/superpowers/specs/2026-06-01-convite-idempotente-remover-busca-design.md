# Convite idempotente + remover busca da tela /boloes

**Data:** 2026-06-01
**Branch:** `feat/convite-idempotente-remover-busca`

## Contexto

Dois ajustes relacionados ao fluxo de entrada em bolões:

1. **Bug:** um usuário não consegue entrar por convite quando já participa de um
   bolão que coincide com o do convite — caso típico, o bolão global, do qual
   todo usuário registrado já faz parte. O sistema lança "Você já é membro deste
   bolão.".
2. **Limpeza:** remover a busca de bolão por nome da tela `/boloes`, mantendo a
   página focada em "Meus Bolões".

## Problema 1 — Conflito "já participa" ao entrar por convite

### Causa raiz

`BolaoService.adicionarMembro` (`apps/backend/src/bolao/bolao.service.ts:136-153`)
lança `ConflictException('Você já é membro deste bolão.')` sempre que o usuário
já é membro do bolão. Como todo usuário registrado entra automaticamente no
`BOLAO_GLOBAL_ID` no cadastro, qualquer tentativa de readicioná-lo a um bolão que
já participa quebra.

Isso atinge dois fluxos:

- `entrarViaConvite` (`bolao.service.ts:68-76`) chamado a partir do endpoint
  `POST /boloes/entrar/:token` e da página de convite — quando o token aponta
  para um bolão que o usuário já integra (ex.: bolão global), retorna erro.
- `registrar` (`apps/backend/src/auth/auth.service.ts:37-46`) adiciona o usuário
  ao `BOLAO_GLOBAL_ID` e, em seguida, chama `entrarViaConvite` com o mesmo token;
  se o convite for do bolão global, a segunda chamada conflita.

### Solução

Tornar a entrada via convite **idempotente**: se o usuário já for membro do bolão
do convite, retornar a associação existente como sucesso, em vez de lançar erro.

Implementação em `BolaoService.entrarViaConvite`:

1. Validar janela de inscrição e o convite (inalterado).
2. Antes de chamar `adicionarMembro`, verificar se já existe `BolaoMembro` para
   `(convite.bolaoId, user.id)`.
3. Se existir, retornar essa associação (curto-circuito, sem erro, sem recontagem
   de lotação e sem recriar ranking).
4. Caso contrário, seguir para `adicionarMembro` como hoje.

`adicionarMembro` permanece estrito (continua lançando em duplicidade), preservando
a semântica de `aprovarMembro`. A verificação de "Bolão lotado." continua valendo
apenas para entradas reais (membro novo).

### Comportamentos resultantes

| Cenário | Antes | Depois |
| --- | --- | --- |
| Convite para bolão global, usuário já no global | Erro "já é membro" | No-op, sucesso |
| Convite para bolão específico, usuário só no global | Entra | Entra (inalterado) |
| Reclicar link de convite já aceito | Erro "já é membro" | Idempotente, redireciona |
| `registrar` com convite do bolão global | Conflito no double-add | Segunda chamada vira no-op |

### Frontend

A página de convite (`apps/frontend/src/app/convite/[codigo]/page.tsx`) já trata o
retorno de `POST /boloes/entrar/:token` como sucesso e redireciona para o bolão.
Com a entrada idempotente, o estado de erro deixa de aparecer nesse caso — sem
mudança de código necessária na página.

## Problema 2 — Remover busca de bolão da tela /boloes

Remover de `apps/frontend/src/app/(app)/boloes/page.tsx`:

- Estados `busca` e `resultados`.
- Função `handleBusca`.
- O bloco JSX "Buscar bolão" (`<form>` + grade de resultados).

A página fica apenas com o título "Meus Bolões", o alerta "sem bolão privado" e a
grade dos bolões do usuário.

**Backend permanece intacto.** `BolaoService.buscarPorNome` e o endpoint
`GET /boloes/buscar` continuam existindo porque são usados pelos diálogos de admin
(`apps/frontend/src/components/AdminCriarUsuarioDialog.tsx`,
`apps/frontend/src/components/AdminAdicionarBolaoDialog.tsx`).

## Testes

- **Backend** (`apps/backend/src/bolao/bolao.service.spec.ts`): novo teste —
  `entrarViaConvite` retorna a associação existente (sem lançar) quando o usuário
  já é membro do bolão do convite.
- **Frontend:** se houver asserção sobre o formulário de busca na página de
  bolões, removê-la/ajustá-la.

## Fora de escopo

- Alterações em `adicionarMembro`, `aprovarMembro` ou `solicitarEntrada`.
- Remoção ou alteração do endpoint `/boloes/buscar` no backend.
