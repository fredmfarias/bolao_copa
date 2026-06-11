# Bloquear usuários inativos: login Google, membros e contagem

**Data:** 2026-06-10
**Branch:** `feat/bloquear-inativos-login-membros`

## Objetivo

Usuários inativos (`Usuario.ativo = false`) não devem conseguir entrar via Google
OAuth, não devem aparecer na lista de membros dos bolões e não devem ser contados
nem rankeados. O login por senha já bloqueia inativos; o ranking ao vivo já os
exclui. Este spec fecha as lacunas restantes.

## Contexto atual

- **Login por senha** (`auth.service.ts:62-64`): já lança
  `UnauthorizedException('Sua conta está desativada.')` para inativos. ✅
- **Login Google** (`auth.controller.ts:84-124`): **não** checa `usuario.ativo`.
  Um inativo com `googleId` recebe tokens normalmente. ❌
- **Membros do bolão** (`bolao.service.ts`):
  - `obter()` (linha 57) inclui todos os membros, sem filtrar por `ativo`. ❌
  - `_count.membros` em `listarMeus` (linha 41), `buscarPorNome` (linha 49) e
    `obter` conta inativos. ❌
- **Ranking** (`ranking.service.ts`):
  - `recalcularRankingBolao` (linha 129) já filtra `usuario: { ativo: true }` e
    remove linhas de inativos (linhas 187-189). ✅
  - Desativar um usuário (`admin.service.ts:78`) **não** dispara recálculo; o
    inativo só sai do ranking ao vivo na próxima pontuação ou publicação.

## Decisões

1. **Contagem de membros exclui inativos** — o número "X membros" deve bater com a
   lista exibida (apenas ativos).
2. **Desativação NÃO dispara recálculo imediato de ranking** — mantém o
   comportamento atual. O ranking exibido vem de snapshots publicados, então o
   impacto visível é mínimo até a próxima publicação.

## Mudanças

### 1. Login Google bloqueia inativos

**Arquivo:** `apps/backend/src/auth/auth.controller.ts` (`googleCallback`)

Após resolver o `usuario` existente (e antes de gerar tokens), checar `ativo`.
Se inativo, redirecionar para `/login?erro=conta-desativada` em vez de gerar
tokens — reaproveitando o padrão de redirect com `?erro=` já usado para
`cadastros-encerrados`.

- A checagem só afeta contas **já existentes** e inativas. Uma conta recém-criada
  pelo callback nasce com `ativo: true` (default do schema), então não é atingida.
- Posicionar a checagem após o bloco de criação/vínculo, imediatamente antes de
  `gerarTokens`.

**Frontend** (`apps/frontend/src/app/(auth)/login/page.tsx`): a página já lê
`searchParams.get('erro')` (`erroQuery`) e renderiza um bloco para
`erroQuery === 'cadastros-encerrados'` (linha 52). Adicionar um bloco análogo
para `erroQuery === 'conta-desativada'` com a mensagem
**"Sua conta está desativada."** — mesma frase do login por senha, para
consistência.

### 2. Membros do bolão só mostram ativos

**Arquivo:** `apps/backend/src/bolao/bolao.service.ts`

- `obter()` (linha 57): filtrar a relação de membros:
  `membros: { where: { usuario: { ativo: true } }, include: { usuario: { select: { id, nome, avatarUrl } } } }`.
  A contagem exibida na tela de detalhe (`boloes/[id]/page.tsx`) deriva de
  `bolao.membros?.length`, ou seja, filtrar o array já corrige a contagem desse
  ecrã — não é preciso `_count` em `obter`.
- Contagem (`_count.membros`) excluindo inativos via filtered relation count do
  Prisma, `_count: { select: { membros: { where: { usuario: { ativo: true } } } } }`,
  nos três pontos que expõem esse número aos cards:
  - `bolao.service.ts` `listarMeus` (linha 41) — feed dos `BolaoCard`.
  - `bolao.service.ts` `buscarPorNome` (linha 49) — busca de bolões.
  - `admin.service.ts` `listarBoloes` (linha 34) — lista admin de bolões.

### 3. Ranking — sem mudança de código

Já filtra `ativo: true` no recálculo e remove linhas de inativos. Documentado
aqui que a desativação não dispara recálculo imediato (decisão acima). Snapshots
históricos já publicados mantêm quem era ativo no momento — comportamento correto
de histórico.

## Abordagem técnica

Filtragem no nível da query (Prisma `where`), seguindo o padrão que o
`ranking.service.ts` já usa. Evita trafegar dados de inativos e mantém
consistência.

**Ponto de atenção:** filtered relation count do Prisma. No Prisma 5 é GA (sem
preview flag), mas confirmar versão/sintaxe ao implementar. Fallback, se
necessário: derivar a contagem do array de membros já filtrado.

## Testes

- **`auth.controller.spec` (novo):** unit test do `googleCallback` — usuário
  existente e inativo é redirecionado para `/login?erro=conta-desativada` e
  `auth.gerarTokens` não é chamado. (O fluxo OAuth real não é testável em e2e.)
- **`bolao.service.spec`:** `obter()` filtra membros por `ativo: true`;
  `listarMeus` e `buscarPorNome` usam `_count` filtrado.
- **`admin.service.spec`:** `listarBoloes` usa `_count` filtrado por `ativo: true`.
- **`ranking.service.spec`:** já cobre a exclusão de inativos (linhas 198 e 243) —
  sem mudança.
- **Frontend `LoginPage.test`:** renderiza a mensagem "Sua conta está desativada."
  quando `?erro=conta-desativada`.

## Fora de escopo

- Recálculo imediato de ranking ao desativar (decidido: não).
- Snapshots históricos já publicados.
- Bloqueio de inativos no `refresh` de token (sessão já ativa) — não solicitado.

## Documentação

Atualizar o `README.md` se alguma regra de negócio descrita mudar de
comportamento observável (ex.: nota sobre visibilidade de membros).
