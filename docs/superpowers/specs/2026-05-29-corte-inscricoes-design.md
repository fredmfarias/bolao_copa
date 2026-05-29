# Corte de inscrições antes da Copa

Data: 2026-05-29
Status: aprovado para implementação

## Contexto e objetivos

Cadastro de novos usuários e ingresso em bolões devem ser encerrados 2h antes do primeiro jogo da Copa. Após o corte:

- Tela de login: link "Criar conta" aparece desabilitado com mensagem "Cadastros encerrados".
- `/registrar` acessada diretamente: exibe só a mensagem (sem form).
- Backend recusa `POST /auth/registrar`, criação implícita no callback do Google e ingresso em bolões (`entrar/:token`, `aprovar`).
- **Admin (role ADMIN)** ignora o corte e ganha duas entradas novas:
  - Formulário "Novo usuário" em `/admin/usuarios` (cria conta, opcionalmente adiciona a um bolão extra).
  - Botão "Adicionar a bolão" por linha de usuário existente (autocomplete de bolão).

Princípios:
- **Defesa em profundidade**: frontend esconde/desabilita, backend valida e devolve 403.
- **Fonte única de verdade**: um service centraliza "as inscrições estão abertas?". Ambos os pontos consomem o mesmo.
- **Sem migrations**: a janela é derivada de `Jogo.dataHora` que já existe.

## Decisões transversais

- **Constante compartilhada**: `HORAS_CORTE_INSCRICAO = 2` em `packages/shared/src/enums.ts`. Importada por backend e (eventualmente) frontend.
- **Banco sem jogo cadastrado**: `abertas = true`. Não há calendário; corte não é computável.
- **Cache**: `getStatus()` mantém resultado em memória por 60s. Aceita drift de até 1 min entre instâncias do backend — irrelevante para um corte de 2h.
- **ADMIN bypassa sempre**, em qualquer endpoint que consulta o service.

## Seção 1 — Backend: `InscricaoWindowService`

### Estrutura

Novo módulo em `apps/backend/src/inscricao-window/`:

```
inscricao-window/
├── inscricao-window.module.ts
├── inscricao-window.service.ts
└── inscricao-window.service.spec.ts
```

`InscricaoWindowModule` exporta o service e importa `PrismaModule`. Adicionado aos imports de `AuthModule` e `BolaoModule`. `AdminModule` não precisa importar — admin bypassa, não chama `assertAberta`.

### API do service

```ts
type InscricaoStatus = {
  abertas: boolean;
  dataPrimeiroJogo: Date | null;
  dataCorte: Date | null;
};

class InscricaoWindowService {
  async getStatus(): Promise<InscricaoStatus>;
  async assertAberta(user?: { role?: string }): Promise<void>;
}
```

**`getStatus`** (com cache TTL 60s):

```ts
const primeiro = await this.prisma.jogo.findFirst({
  orderBy: { dataHora: 'asc' },
  select: { dataHora: true },
});

if (!primeiro) return { abertas: true, dataPrimeiroJogo: null, dataCorte: null };

const dataCorte = new Date(primeiro.dataHora.getTime() - HORAS_CORTE_INSCRICAO * 60 * 60 * 1000);
return {
  abertas: Date.now() < dataCorte.getTime(),
  dataPrimeiroJogo: primeiro.dataHora,
  dataCorte,
};
```

**`assertAberta`**: se `user?.role === Role.ADMIN`, retorna. Senão, busca `getStatus` e lança `ForbiddenException('Inscrições encerradas.')` quando `!abertas`.

### Cache

Membro privado `cache: { value: InscricaoStatus; expiresAt: number } | null = null`. Cada chamada de `getStatus` verifica `cache?.expiresAt > Date.now()`; senão recomputa e seta `expiresAt = Date.now() + 60_000`. Sem invalidação manual.

## Seção 2 — Backend: endpoints novos e existentes

### `GET /auth/inscricoes/status` (público, novo)

Adicionado em `AuthController`. Sem `@UseGuards`.

```ts
@Get('inscricoes/status')
async statusInscricoes() {
  const status = await this.inscricaoWindow.getStatus();
  return {
    abertas: status.abertas,
    dataCorte: status.dataCorte?.toISOString() ?? null,
  };
}
```

Resposta usada por `/login` e `/registrar` no frontend.

### `POST /auth/registrar` (alterado)

`AuthService.registrar` chama `await this.inscricaoWindow.assertAberta()` antes do `findUnique` de e-mail duplicado. 403 é o primeiro check; mensagem deixa claro pro usuário que não é caso de e-mail repetido.

### `GET /auth/google/callback` (alterado)

No `AuthController.googleCallback`, após o `findFirst` por googleId/email:

```ts
if (!usuario) {
  const status = await this.inscricaoWindow.getStatus();
  if (!status.abertas) {
    return res.redirect(`${process.env.APP_URL}/login?erro=cadastros-encerrados`);
  }
  usuario = await this.prisma.usuario.create({ ... });
  // resto idem
}
```

Usuário Google pré-existente continua logando normalmente.

### `POST /boloes/entrar/:token` (alterado)

`BolaoService.entrarViaConvite` recebe `user` como parâmetro (hoje recebe só `usuarioId`) — o controller passa o objeto completo do `@CurrentUser`. Antes de validar convite, chama `assertAberta(user)`. Convites pré-emitidos continuam válidos para ADMIN; pra não-admin retornam 403.

### `POST /boloes/:bolaoId/aprovar/:usuarioId` (alterado)

`BolaoService.aprovarMembro` recebe o `user` que executa a aprovação e chama `assertAberta(user)`. Moderador comum bloqueado pós-corte; ADMIN passa.

`BolaoModeradorGuard` **não muda** — quem é moderador e quem não é continua igual; a janela é check separado.

### `POST /admin/usuarios` (novo)

```
POST /admin/usuarios
@UseGuards(JwtAuthGuard, RolesGuard) @Roles(ADMIN)
```

**DTO** (`apps/backend/src/admin/dto/create-usuario-admin.dto.ts`):

```ts
class CreateUsuarioAdminDto {
  @IsString() @MinLength(2) @MaxLength(60) nome: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) senhaTemp: string;
  @IsOptional() @IsUUID() bolaoId?: string;
}
```

**Service** (`AdminService.criarUsuario`):

1. Verifica e-mail único (lança `ConflictException` se duplicado).
2. Hash da senha temp com bcrypt (12 rounds, igual ao registrar).
3. `prisma.usuario.create({ data: { nome, email, senhaHash, emailVerificado: true } })`.
4. Adiciona ao bolão global (membro + ranking).
5. Se `bolaoId` informado e `bolaoId !== BOLAO_GLOBAL_ID`: chama `bolaoService.adicionarMembro(bolaoId, novoId)` (valida lotação, cria ranking).
6. Log info `{ adminId, usuarioCriadoId, bolaoId }`.
7. Retorna `{ id, nome, email }`.

Não envia e-mail de confirmação — admin compartilha senha temp diretamente.

### `POST /admin/boloes/:bolaoId/membros` (novo)

```
POST /admin/boloes/:bolaoId/membros
@UseGuards(JwtAuthGuard, RolesGuard) @Roles(ADMIN)
Body: { usuarioId: string }
```

`AdminService.adicionarUsuarioBolao(bolaoId, usuarioId)`:

1. Verifica usuário existe e está ativo.
2. Verifica não é já membro daquele bolão (lança `ConflictException`).
3. Chama `bolaoService.adicionarMembro(bolaoId, usuarioId)` (que checa lotação e cria ranking).
4. Log info `{ adminId, usuarioId, bolaoId }`.
5. Retorna `{ message: 'Usuário adicionado ao bolão.' }`.

Não chama `assertAberta` — admin bypassa.

### Visibilidade do `BolaoService.adicionarMembro`

Hoje é `private`. Promovido a `public` (continua sem ser chamado externamente via HTTP — só por `AdminService`). Sem mudança de comportamento.

## Seção 3 — Frontend

### Hook compartilhado `useInscricaoStatus`

`apps/frontend/src/hooks/useInscricaoStatus.ts`:

```ts
export function useInscricaoStatus(): { abertas: boolean; loading: boolean };
```

Faz `fetch('/auth/inscricoes/status')` no mount. Cacheia em `sessionStorage` com chave `inscricao-status` por 60s (`{ value, expiresAt }`). Retorna `abertas: true` enquanto carrega para evitar flash de "encerrado" indevido.

### `/login` (alterado)

`apps/frontend/src/app/(auth)/login/page.tsx`:

- Consome `useInscricaoStatus()`.
- Banner vermelho quando `searchParams.get('erro') === 'cadastros-encerrados'`:
  > "Cadastros encerrados a 2h do início da Copa. Procure o administrador para se cadastrar."
- Link "Criar conta": quando `abertas`, mantém `<Link href="/registrar">`. Quando `!abertas`, vira `<span class="block text-gray-600 cursor-not-allowed">Cadastros encerrados</span>`.

### `/registrar` (alterado)

`apps/frontend/src/app/(auth)/registrar/page.tsx`:

- Consome `useInscricaoStatus()`.
- Quando `!abertas`: renderiza apenas a mensagem **"Cadastros encerrados a 2h do início da Copa. Procure o administrador para se cadastrar."** + link "Voltar ao login".
- Quando `abertas`: renderiza form atual sem mudanças. Se o POST falhar com 403 (corner case de corte durante o submit), erro vai pro `setErro`.

### `/admin/usuarios` (alterado)

`apps/frontend/src/app/(admin)/admin/usuarios/page.tsx`:

**Botão "Novo usuário" no topo da página**: abre `Dialog` (reusa `components/ui/dialog.tsx`) com formulário:

- Campos: nome, email, senha temporária, "Adicionar também ao bolão?" (autocomplete usando `GET /boloes/buscar?nome=...`, opcional).
- Submit: `POST /admin/usuarios` → fecha modal, toast de sucesso, recarrega lista.
- Erros: e-mail duplicado renderiza inline.

**Botão "Adicionar a bolão" por linha de usuário** (ícone discreto): abre `Dialog` com autocomplete de bolão. Submit: `POST /admin/boloes/:bolaoId/membros` com `{ usuarioId }` → toast, fecha modal.

### Sem mudança em `/auth/google` button

O botão "Entrar com Google" no `/login` continua igual. Bloqueio acontece no callback (redireciona com erro).

## Seção 4 — Edge cases

| Cenário | Comportamento |
|---|---|
| Banco sem jogo cadastrado | `abertas: true, dataCorte: null` |
| Primeiro jogo reagendado | Cache expira em ≤60s, próxima consulta reflete |
| Admin promovido pós-corte | Passa a bypassar (esperado) |
| Convite pré-emitido usado por não-admin pós-corte | 403 "Inscrições encerradas" |
| Submit em andamento quando corte expira | Backend devolve 403; frontend mostra no banner de erro do form |
| Múltiplas instâncias do backend | Cada uma tem seu cache de 60s; drift máximo de 1 min é aceitável |
| Race entre `getStatus` e mudança de calendário | Aceito sem lock distribuído |

## Seção 5 — Testes

### Backend

| Arquivo | Casos novos |
|---|---|
| `inscricao-window/inscricao-window.service.spec.ts` (novo) | Jogo futuro com T > corte → `abertas=true`; T ≤ corte → `abertas=false`; banco vazio → `abertas=true`; cache não consulta DB dentro do TTL; `assertAberta(undefined)` lança quando fechado; `assertAberta({ role: ADMIN })` não lança mesmo fechado |
| `auth/auth.service.spec.ts` (estender) | `registrar` lança 403 quando janela fechada (mock do service) |
| `auth/auth.controller.spec.ts` (novo) | Google callback com user novo + janela fechada → redirect `/login?erro=cadastros-encerrados`, sem `prisma.usuario.create`. User existente passa normal |
| `bolao/bolao.service.spec.ts` (estender) | `entrarViaConvite` e `aprovarMembro` lançam 403 para não-admin pós-corte; passam para ADMIN |
| `admin/admin.service.spec.ts` (estender) | `criarUsuario` cria `emailVerificado=true` e adiciona ao global; com `bolaoId` adiciona ao bolão extra; e-mail duplicado lança 409. `adicionarUsuarioBolao` cria membro e ranking; usuário inativo lança erro; já-membro lança 409 |

### Frontend

| Arquivo | Casos novos |
|---|---|
| `app/(auth)/login/page.test.tsx` (criar se não existir) | Link "Criar conta" desabilitado quando `abertas=false`; banner renderiza quando `?erro=cadastros-encerrados` |
| `app/(auth)/registrar/page.test.tsx` (criar se não existir) | Renderiza só mensagem quando `abertas=false`; renderiza form quando `abertas=true` |
| `app/(admin)/admin/usuarios/page.test.tsx` (estender) | Modal "Novo usuário" submete `POST /admin/usuarios`; modal "Adicionar a bolão" submete `POST /admin/boloes/:bolaoId/membros` |
| `hooks/useInscricaoStatus.test.ts` (novo) | Lê do `sessionStorage` quando válido; faz fetch quando expirou; retorna `abertas=true` durante loading |

### E2E

`e2e/tests/api/inscricao-window.spec.ts` (novo):

- Seed com 1 jogo em T+3h → `POST /auth/registrar` 201.
- Seed com 1 jogo em T+1h → `POST /auth/registrar` 403.
- Mesmo cenário com janela fechada: `POST /boloes/entrar/:token` 403.
- Admin: `POST /admin/usuarios` com janela fechada 201; usuário criado autentica em `POST /auth/login`.

### Comandos finais (rodados ao fim, não a cada passo)

```bash
pnpm lint
pnpm test
cd apps/backend && pnpm exec tsc --noEmit
```

## Atualização do README

Adicionar entrada em "Funcionalidades":

> - **Janela de inscrição** — cadastros e ingresso em bolões fecham 2h antes do primeiro jogo da Copa. Após esse horário, apenas o admin pode criar contas e adicionar usuários a bolões.

## Resumo dos arquivos tocados

**Novos:**
- `packages/shared/src/enums.ts` → adicionar `HORAS_CORTE_INSCRICAO = 2`
- `apps/backend/src/inscricao-window/inscricao-window.module.ts`
- `apps/backend/src/inscricao-window/inscricao-window.service.ts`
- `apps/backend/src/inscricao-window/inscricao-window.service.spec.ts`
- `apps/backend/src/admin/dto/create-usuario-admin.dto.ts`
- `apps/frontend/src/hooks/useInscricaoStatus.ts`
- `apps/frontend/src/hooks/useInscricaoStatus.test.ts`
- `e2e/tests/api/inscricao-window.spec.ts`

**Alterados (backend):**
- `apps/backend/src/auth/auth.controller.ts` (novo endpoint status + Google callback)
- `apps/backend/src/auth/auth.service.ts` (assertAberta no registrar)
- `apps/backend/src/auth/auth.module.ts` (import InscricaoWindowModule)
- `apps/backend/src/bolao/bolao.service.ts` (assertAberta + tornar `adicionarMembro` público)
- `apps/backend/src/bolao/bolao.controller.ts` (passa user pro service)
- `apps/backend/src/bolao/bolao.module.ts` (import InscricaoWindowModule)
- `apps/backend/src/admin/admin.controller.ts` (POST /usuarios e POST /boloes/:bolaoId/membros)
- `apps/backend/src/admin/admin.service.ts` (criarUsuario, adicionarUsuarioBolao)
- `apps/backend/src/admin/admin.module.ts` (import BolaoModule para reuso de `adicionarMembro`)

**Alterados (frontend):**
- `apps/frontend/src/app/(auth)/login/page.tsx`
- `apps/frontend/src/app/(auth)/registrar/page.tsx`
- `apps/frontend/src/app/(admin)/admin/usuarios/page.tsx`

**Alterados (docs):**
- `README.md` (entrada em "Funcionalidades")
