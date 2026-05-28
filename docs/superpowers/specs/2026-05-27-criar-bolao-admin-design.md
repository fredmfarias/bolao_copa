# Design: Criação de Bolão restrita a ADMIN com seletor de Moderador

**Data:** 2026-05-27  
**Status:** Aprovado

## Contexto

Hoje qualquer usuário autenticado pode criar bolões via `POST /boloes`. A nova regra restringe essa ação a usuários ADMIN. O admin deve obrigatoriamente selecionar outro usuário como moderador do bolão criado e não deve ser adicionado como membro.

## Escopo

- Backend: restrição de role no endpoint de criação, campo `moderadorId` no DTO, novo endpoint de busca de usuários
- Frontend: remoção do fluxo de criação da área de usuário comum, novo formulário no painel admin com autocomplete de usuário

## Backend

### Guard no `POST /boloes`

`BolaoController.criar()` recebe `@UseGuards(RolesGuard)` + `@Roles(Role.ADMIN)`. Qualquer chamada de usuário com role diferente de `ADMIN` resulta em `403 Forbidden`.

### `CreateBolaoDto`

Adiciona campo obrigatório:

```ts
@IsString()
moderadorId: string;
```

### `BolaoService.criar()`

Assinatura permanece `criar(adminId: string, dto: CreateBolaoDto)`.

Comportamento alterado:
- `criadoPorId` continua sendo `adminId`
- `BolaoMembro` criado com `usuarioId: dto.moderadorId` e `papel: MODERADOR`
- `Ranking` criado com `usuarioId: dto.moderadorId`
- Admin **não** é inserido como membro nem no ranking

### Novo endpoint de busca de usuários

```
GET /admin/usuarios/buscar?q=<termo>
```

Adicionado ao `AdminController` (já protegido por `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN)`).

Busca usuários cujo `nome` ou `email` contenha `q` (case-insensitive). Retorna no máximo 10 resultados com campos: `id`, `nome`, `email`, `avatarUrl`.

## Frontend

### Remoções

- **`/boloes/novo`**: arquivo `apps/frontend/src/app/(app)/boloes/novo/page.tsx` é deletado
- **Botão `+ Criar bolão`** em `apps/frontend/src/app/(app)/boloes/page.tsx`: removido para todos os usuários

### `/admin/boloes` — formulário inline

Botão `+ Criar bolão` adicionado ao cabeçalho da página. Ao clicar, expande um formulário inline (entre o cabeçalho e a lista de bolões existente). Campos:

| Campo | Tipo | Validação |
|---|---|---|
| Nome | text | obrigatório |
| Descrição | textarea | opcional |
| Escopo | select (GRUPOS / ELIMINATORIAS / AMBOS) | obrigatório |
| Máx. participantes | number (step=10, min=10) | obrigatório, múltiplo de 10 |
| Moderador | `UserSearchInput` | obrigatório |

Ao submeter com sucesso: colapsa o formulário e recarrega a lista de bolões. Em caso de erro: exibe mensagem inline.

### Componente `UserSearchInput`

**Arquivo:** `apps/frontend/src/components/UserSearchInput.tsx`

Props:
```ts
interface Props {
  value: { id: string; nome: string } | null;
  onChange: (user: { id: string; nome: string } | null) => void;
}
```

Comportamento:
- Input de texto controlado pelo estado interno `query`
- Debounce de 300ms após digitação dispara `GET /admin/usuarios/buscar?q=<query>`
- Dropdown lista resultados com nome + email
- Ao selecionar: chama `onChange` com `{ id, nome }`, fecha dropdown, exibe nome no input
- Ao limpar o input: chama `onChange(null)`
- Nenhuma chamada disparada se `query.length < 2`

### `types/api.ts`

Adiciona:
```ts
export interface UserSearchResult {
  id: string;
  nome: string;
  email: string;
  avatarUrl: string | null;
}
```

## Fluxo de dados

```
Admin clica "+ Criar bolão"
  → formulário expande
  → Admin digita nome do moderador (debounce 300ms)
  → GET /admin/usuarios/buscar?q=<termo>
  → Dropdown com sugestões
  → Admin seleciona usuário
  → Admin preenche restante do formulário
  → POST /boloes { nome, descricao, escopo, maxParticipantes, moderadorId }
  → Backend valida role ADMIN (403 se não for)
  → BolaoService.criar(): cria bolão, adiciona moderadorId como MODERADOR, não adiciona admin
  → Frontend colapsa form, recarrega lista
```

## Tratamento de erros

- `403`: não deve ocorrer no fluxo normal (admin já está na área protegida), mas se ocorrer exibe mensagem genérica
- `400` (maxParticipantes não múltiplo de 10): exibe mensagem de validação
- `404` (moderadorId não existe): backend retorna erro, frontend exibe mensagem

## O que não muda

- Fluxo de `elegerModerador` (moderador pode ser trocado depois)
- Demais endpoints do `BolaoController`
- Acesso à página `/boloes` para usuários comuns (apenas o botão de criação é removido)
