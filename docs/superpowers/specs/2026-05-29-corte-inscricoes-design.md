# Corte de inscrições antes da Copa

Data: 2026-05-29
Status: implementado (atualizado retroativamente com decisões da execução)

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
- **Cache**: `getStatus()` mantém resultado em memória por 60s. Aceita drift de até 1 min entre instâncias do backend — irrelevante para um corte de 2h. Invalidável manualmente via `POST /admin/inscricoes/cache/clear` (útil quando admin reagenda o primeiro jogo).
- **Singleton garantido**: `InscricaoWindowModule` é `@Global()` e registrado uma única vez em `AppModule`. Esta foi uma correção encontrada na execução — quando cada módulo importava separadamente, NestJS criava instâncias por consumidor (cada uma com seu próprio cache), o que quebraria o invalidador.
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

`InscricaoWindowModule` é decorado com `@Global()`, exporta o service e importa `PrismaModule`. Registrado **uma única vez em `AppModule`** (`apps/backend/src/app.module.ts`). Os módulos consumidores (`AuthModule`, `BolaoModule`, `AdminModule`) NÃO importam explicitamente — receberiam instâncias separadas via DI scope local, o que invalidaria o cache. `AdminModule` consome o service para o endpoint de cache clear.

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
  clearCache(): void; // invalida cache em memória (usado pelo endpoint admin)
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

Membro privado `cache: { value: InscricaoStatus; expiresAt: number } | null = null`. Cada chamada de `getStatus` verifica `cache?.expiresAt > Date.now()`; senão recomputa e seta `expiresAt = Date.now() + 60_000`. `clearCache()` zera para `null` — próxima chamada recomputa.

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

### `POST /admin/inscricoes/cache/clear` (novo)

```
POST /admin/inscricoes/cache/clear
@UseGuards(JwtAuthGuard, RolesGuard) @Roles(ADMIN)
```

Chama `InscricaoWindowService.clearCache()` e retorna `{ message: 'Cache invalidado.' }`. Uso em produção: admin reagenda primeiro jogo e quer que o novo `dataCorte` seja refletido imediatamente, sem esperar o TTL de 60s. Também consumido pelo E2E spec para garantir determinismo após mutar `Jogo.dataHora`.

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

`apps/frontend/src/app/admin/usuarios/page.tsx` (sem route group `(admin)`):

**Botão "Novo usuário" no topo da página**: abre `AdminCriarUsuarioDialog` (`apps/frontend/src/components/AdminCriarUsuarioDialog.tsx`) — componente novo que usa `Dialog` de `components/ui/dialog.tsx`. Formulário:

- Campos: nome, email, senha temporária, "Adicionar também ao bolão?" (autocomplete usando `GET /boloes/buscar?nome=...`, opcional).
- Submit: `POST /admin/usuarios` → fecha modal, callback `onCriado` recarrega lista.
- Erros: e-mail duplicado renderiza inline.

**Botão "+ Bolão" por linha de usuário** (em `AdminUsuarioRow.tsx`): abre `AdminAdicionarBolaoDialog` (`apps/frontend/src/components/AdminAdicionarBolaoDialog.tsx`) — componente novo com autocomplete de bolão. Submit: `POST /admin/boloes/:bolaoId/membros` com `{ usuarioId }` → callback `onAdicionado` (reusa `onAtualizado` da row para refresh), fecha modal.

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
| Múltiplas instâncias do backend | Cada uma tem seu cache de 60s; drift máximo de 1 min é aceitável. `clearCache` invalida só a instância que recebeu a chamada — em frota com várias instâncias, drift permanece até próximo TTL nas outras. |
| Race entre `getStatus` e mudança de calendário | Aceito sem lock distribuído |
| Admin reagenda primeiro jogo e precisa janela imediata | Chamar `POST /admin/inscricoes/cache/clear` após o reagendamento |

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

Testes em `apps/frontend/src/__tests__/` (padrão do projeto — testes não co-localizados):

| Arquivo | Casos novos |
|---|---|
| `LoginPage.test.tsx` (estender) | Link "Criar conta" desabilitado quando `abertas=false`; banner renderiza quando `?erro=cadastros-encerrados` |
| `RegistrarPage.test.tsx` (novo) | Renderiza só mensagem quando `abertas=false`; renderiza form quando `abertas=true` |
| `AdminCriarUsuarioDialog.test.tsx` (novo) | Submete `POST /admin/usuarios`; exibe erro inline em falha |
| `AdminAdicionarBolaoDialog.test.tsx` (novo) | Submete `POST /admin/boloes/:bolaoId/membros` e chama `onAdicionado` |
| `useInscricaoStatus.test.ts` (novo) | Lê do `sessionStorage` quando válido; faz fetch quando expirou; retorna `abertas=true` durante loading |

### E2E

`e2e/tests/auth/janela-inscricao.api.spec.ts` (novo):

- **Isolamento**: spec mexe APENAS no jogo de menor `dataHora` (não `updateMany` sem `where`). `afterAll` restaura para T+30 dias, garantindo janela aberta para suítes subsequentes — independentemente do estado em que outros testes deixaram o jogo (importante porque `aposta/prazo.api.spec.ts` roda alfabeticamente antes e move o primeiro jogo para o passado).
- **Determinismo de cache**: cada mutação de `dataHora` é seguida por `POST /admin/inscricoes/cache/clear`, evitando esperas de TTL.
- Casos:
  - Janela fechada (jogo em T+30min) → `POST /auth/registrar` 403, mensagem contém "Inscrições encerradas".
  - Janela fechada → admin chama `POST /admin/usuarios` 201; usuário criado consegue `POST /auth/login` imediatamente (emailVerificado=true).
- Também ajustado `e2e/playwright.config.ts` para incluir o subdiretório `auth` no `testMatch` do projeto API (estava cobrindo só `authz|aposta|...`).

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
- `packages/shared/src/enums.ts` → `HORAS_CORTE_INSCRICAO = 2`
- `apps/backend/src/inscricao-window/inscricao-window.module.ts` (`@Global()`)
- `apps/backend/src/inscricao-window/inscricao-window.service.ts`
- `apps/backend/src/inscricao-window/inscricao-window.service.spec.ts`
- `apps/backend/src/admin/dto/create-usuario-admin.dto.ts`
- `apps/frontend/src/hooks/useInscricaoStatus.ts`
- `apps/frontend/src/components/AdminCriarUsuarioDialog.tsx`
- `apps/frontend/src/components/AdminAdicionarBolaoDialog.tsx`
- `apps/frontend/src/__tests__/useInscricaoStatus.test.ts`
- `apps/frontend/src/__tests__/RegistrarPage.test.tsx`
- `apps/frontend/src/__tests__/AdminCriarUsuarioDialog.test.tsx`
- `apps/frontend/src/__tests__/AdminAdicionarBolaoDialog.test.tsx`
- `e2e/tests/auth/janela-inscricao.api.spec.ts`

**Alterados (backend):**
- `apps/backend/src/app.module.ts` (importa `InscricaoWindowModule` — singleton via `@Global()`)
- `apps/backend/src/auth/auth.controller.ts` (`GET /auth/inscricoes/status` + Google callback guard)
- `apps/backend/src/auth/auth.service.ts` (`assertAberta()` no `registrar`)
- `apps/backend/src/bolao/bolao.service.ts` (`assertAberta(user)` em `entrarViaConvite`/`aprovarMembro`; `adicionarMembro` público)
- `apps/backend/src/bolao/bolao.controller.ts` (passa user pro service)
- `apps/backend/src/bolao/bolao.module.ts` (exporta `BolaoService`)
- `apps/backend/src/admin/admin.controller.ts` (POST `/usuarios`, `/boloes/:bolaoId/membros`, `/inscricoes/cache/clear`)
- `apps/backend/src/admin/admin.service.ts` (`criarUsuario`, `adicionarUsuarioBolao`)
- `apps/backend/src/admin/admin.module.ts` (importa `BolaoModule` para reuso de `adicionarMembro`)
- `apps/backend/src/auth/auth.service.spec.ts`, `bolao/bolao.service.spec.ts`, `admin/admin.service.spec.ts` (testes estendidos)

**Alterados (frontend):**
- `apps/frontend/src/app/(auth)/login/page.tsx`
- `apps/frontend/src/app/(auth)/registrar/page.tsx`
- `apps/frontend/src/app/admin/usuarios/page.tsx` (sem route group `(admin)`)
- `apps/frontend/src/components/AdminUsuarioRow.tsx` (botão "+ Bolão" + dialog mount)
- `apps/frontend/src/__tests__/LoginPage.test.tsx` (testes estendidos)

**Alterados (E2E):**
- `e2e/playwright.config.ts` (adiciona `auth` ao `testMatch` do projeto API)

**Alterados (docs):**
- `README.md` (entrada em "Funcionalidades")
