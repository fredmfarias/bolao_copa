# Suíte de Testes E2E + Integração — Bolão Trovão

**Data:** 2026-05-27
**Status:** Aprovado (design) — pronto para plano de implementação
**Autor:** QA / Arquitetura de Testes

---

## Contexto

O Bolão Trovão é um monorepo (Turborepo + pnpm) com backend NestJS 10 (Prisma/PostgreSQL,
Bull/Redis, Nodemailer, web-push) e frontend Next.js 14. Já existe uma camada de **testes
unitários** sólida:

- Backend: 7 `*.service.spec.ts` (Prisma mockado).
- Frontend: ~23 testes Testing Library.
- CI (`.github/workflows/ci.yml`): `lint` → `test` (apenas unit backend, sem DB/Redis reais) → `build-check` (Docker).

**Lacuna:** não há testes E2E nem de integração de ponta a ponta. Este documento define a
arquitetura, a stack e o plano de cobertura para preencher essa lacuna.

### Decisões já tomadas

- **Entrega:** suíte E2E implementada e rodando (trabalho multi-sessão).
- **Stack:** Playwright + TypeScript.
- **Fluxos da 1ª leva:** Auth completo, Bolão + convite, Aposta + prazo, Pontuação + publicação,
  **autorização/IDOR** (negativos) e **push notifications**.
- **Seção de código de exemplo:** fluxo de confirmação de e-mail.
- **Fora de escopo (por ora):** Google OAuth real (custoso/instável em E2E — coberto por bypass/stub);
  webhook de pagamento (**não existe no código** — `BolaoStatus.PAGO` é um toggle manual do admin).

---

## 1. Arquitetura e ferramental

### Por que Playwright

Para um SaaS web único, multi-papel e com forte componente de API, o Playwright é o melhor encaixe:

- **Um runner para UI E2E e integração de API**: a fixture `request` exercita o NestJS direto em
  `:3001` sem browser — ideal para os testes de autorização/IDOR.
- **Paralelismo com isolamento por worker** e **auto-waiting** (reduz flakiness sem `sleep`).
- **`storageState`**: login feito uma vez por papel; testes reaproveitam a sessão.
- **Trace viewer**: depuração de falhas de CI com timeline, network e snapshots de DOM.
- **TypeScript**: consistente com o monorepo; reaproveita tipos/constantes de `@bolao/shared`
  (ex.: `BOLAO_GLOBAL_ID`).

Cypress foi descartado por tratar API e cenários multi-usuário como cidadãos de segunda classe e
exigir Dashboard pago para paralelizar; Selenium por ser verboso, sem camada de API e propenso a waits manuais.

### Estrutura de pastas

Novo workspace `e2e/` na raiz (adicionado ao `pnpm-workspace.yaml`), isolado de `apps/`:

```
e2e/
├── package.json
├── playwright.config.ts        # projects: "api" e "ui-chromium"; webServer reaproveitado
├── global-setup.ts             # prisma migrate reset + seed referência + storageState por papel
├── global-teardown.ts
├── fixtures/
│   ├── index.ts                # test estendido com fixtures custom
│   ├── api-client.ts           # wrapper tipado sobre request (App Actions)
│   └── roles.ts                # authedPage(role): admin | participante | moderador
├── pages/                      # Page Objects (somente UI)
│   ├── login.page.ts
│   ├── registro.page.ts
│   ├── jogos.page.ts
│   ├── aposta-drawer.page.ts
│   ├── ranking.page.ts
│   └── admin/
│       ├── placares.page.ts
│       └── publicacao.page.ts
├── api/                        # App Actions HTTP (setup rápido de estado)
│   ├── auth.api.ts
│   ├── bolao.api.ts
│   ├── aposta.api.ts
│   ├── notificacao.api.ts
│   └── admin.api.ts
├── data/                       # factories/builders
│   ├── user.factory.ts
│   ├── bolao.factory.ts
│   └── jogo.factory.ts
├── support/
│   ├── mailpit.ts              # REST API do Mailpit (listar, ler, limpar)
│   ├── db.ts                   # Prisma direto p/ estados de borda + truncate
│   ├── queue.ts                # poll do ranking draft (espera Bull concluir)
│   └── time.ts                 # helpers de prazo (60 min antes do apito)
└── tests/
    ├── auth/
    │   ├── registro-confirmacao.spec.ts
    │   ├── login.spec.ts
    │   └── recuperacao-senha.spec.ts
    ├── bolao/
    │   ├── criar-bolao.spec.ts
    │   ├── convite.spec.ts
    │   └── bolao-global.spec.ts
    ├── aposta/
    │   ├── upsert-palpite.spec.ts
    │   └── prazo.spec.ts
    ├── ranking/
    │   ├── calculo-draft.spec.ts
    │   └── publicacao-snapshot.spec.ts
    ├── notificacoes/
    │   └── push-subscribe.spec.ts
    ├── authz/
    │   ├── admin-endpoints.spec.ts
    │   ├── aposta-de-outro-usuario.spec.ts
    │   └── palpite-oculto-antes-do-prazo.spec.ts
    └── resiliencia/
        ├── falha-de-rede.spec.ts
        ├── payload-invalido.spec.ts
        ├── sessao-expirada.spec.ts
        └── concorrencia.spec.ts
```

**Padrão híbrido Page Objects + App Actions.** A UI é exercitada via Page Objects; as
pré-condições (criar usuário, bolão, palpites) são montadas via App Actions (chamadas HTTP) —
rápido e resiliente a mudanças de layout. Separa "o que estou testando" de "como cheguei no estado".

**Dois projects no Playwright:**

- `api`: sem browser, só `request` contra `:3001` — integração e authz.
- `ui-chromium`: E2E real no browser, depende de `storageState` gerado no global-setup.

---

## 2. Regras de negócio e fluxos críticos (sucesso)

### 2.1 Auth — registro → confirmação de e-mail → login

```gherkin
Cenário: Novo usuário se registra, confirma e-mail e faz login
  Dado que eu informo nome, e-mail e senha válidos em /registrar
  Quando envio o formulário (POST /auth/registrar)
  Então recebo um e-mail de confirmação no Mailpit
  E o e-mail contém um link com token de ativação
  Quando acesso o link (GET /auth/confirmar-email?token=...)
  Então minha conta fica com emailVerificado = true
  E consigo fazer login com e-mail/senha (POST /auth/login)
  E recebo um accessToken e o cookie httpOnly refresh_token
```

### 2.2 Bolão + convite

```gherkin
Cenário: Criação de bolão e ingresso via convite
  Dado um usuário autenticado
  Quando ele cria um bolão privado com escopo e max de participantes
  Então ele vira MODERADOR do bolão
  E pode gerar um token de convite
  Quando um segundo usuário acessa o convite
  Então ele entra como PARTICIPANTE (respeitando maxParticipantes)

Cenário: Ingresso automático no bolão global
  Dado um usuário recém-confirmado
  Então ele já é membro do bolão global (BOLAO_GLOBAL_ID)
  E possui um registro de Ranking nesse bolão
```

### 2.3 Aposta + prazo

```gherkin
Cenário: Envio e re-envio de palpite (upsert)
  Dado um jogo a mais de 60 min do apito inicial
  Quando o usuário envia um palpite de placar
  Então a aposta é persistida (única por usuário+jogo)
  Quando ele reenvia um placar diferente
  Então o palpite anterior é substituído (não duplica)

Cenário: Bloqueio após o prazo
  Dado um jogo a menos de 60 min do apito inicial
  Quando o usuário tenta enviar/alterar o palpite
  Então a operação é recusada com mensagem amigável
  E nenhuma aposta é criada/alterada
```

### 2.4 Pontuação + publicação (fluxo mais complexo)

```gherkin
Cenário: Publicação congela ranking e calcula variação de posição
  Dado um bolão habilitado com 3 participantes ativos e palpites lançados
  E o admin registrou os placares finais da rodada
  Quando o processador Bull conclui o cálculo (draft ao vivo, visível só ao admin)
  E o admin aciona "Publicar rodada" (POST /admin/publicacoes)
  Então cada participante ativo recebe um RankingSnapshot da publicação
  E o participante vê o snapshot congelado (não o draft)
  E a variação de posição vs publicação anterior é exibida com a seta correta
  E quem não apostou aparece com 0 pontos no fundo do ranking
```

Regras de ordenação a verificar (do README): apenas usuários **ativos**; desempate por
pontuação total → placar exato → vencedor → empate → perdedor → só vencedor → ordem alfabética.

---

## 3. Cenários de erro e resiliência (borda)

| Cenário | Técnica Playwright | Assert |
|---|---|---|
| Falha de rede | `page.route()` aborta/atrasa a chamada | UI mostra erro amigável (toast), sem tela branca |
| Payload inválido | `apiClient` envia DTO ruim | HTTP `400` + mensagens do `class-validator`; **nunca** `500` |
| Sessão expirada | limpar/expirar cookie `refresh_token`; refresh inválido | redirect ao login; `/auth/refresh` retorna `401` |
| Concorrência (duplo clique) | `Promise.all` disparando 2× o upsert de aposta | `@@unique([usuarioId, jogoId])` garante 1 registro; sem erro ao usuário |

**Amigável vs sistema:** assert no texto visível (toast/inline) **e** no corpo da resposta da API
(mensagem sanitizada, sem stack trace). Logs de sistema ficam fora do assert de UI — no máximo
verificados em testes de integração de backend dedicados.

---

## 4. Validação de e-mails

**Mailpit já está no stack de dev** (porta 8025) — dispensa Mailtrap/Mailosaur.

`support/mailpit.ts` usa a REST API do Mailpit:

- `GET /api/v1/messages` — listar (filtrar por destinatário).
- `GET /api/v1/message/{id}` — corpo HTML/texto.
- `DELETE /api/v1/messages` — limpar a caixa entre testes (isolamento).

**O que validar:**

1. Destinatário e assunto corretos.
2. Variáveis do template renderizadas (ex.: nome do usuário).
3. Presença e formato do **link de ativação/reset** (extrair token via regex).
4. **Fechar o fluxo ponta-a-ponta**: navegar no link extraído pelo browser e confirmar o efeito
   (conta verificada / senha redefinida).

Em CI, Mailpit sobe como service container.

---

## 5. Estratégia de dados de teste

**Abordagem híbrida** (escolhida para minimizar flakiness mantendo testes honestos):

- **Referência estática** (seleções, estádios, jogos, config de pontuação, bolão global): seed
  Prisma existente, **uma vez** no `global-setup`.
- **Dados dinâmicos** (usuários, bolões, convites, apostas): criados **via API** em factories, por
  teste. Passam pela validação real → resilientes a mudanças de schema, e mais próximos do uso real
  que um insert direto.
- **Estados de borda** que a API não produz facilmente (jogo já passado do prazo; partida finalizada
  aguardando processamento da fila): seed direto via Prisma em `support/db.ts`.
- **Isolamento:** banco de teste dedicado; `prisma migrate reset` no setup + `TRUNCATE` das tabelas
  dinâmicas entre arquivos. E-mails únicos por worker (`user+${workerIndex}-${nanoid}@test.local`)
  evitam colisão no paralelismo.
- **Fila Bull (assíncrona):** `support/queue.ts` faz `expect.poll()` contra o endpoint de ranking
  draft até o cálculo concluir — **sem `sleep` fixo** (anti-flaky).

Justificativa do trade-off: seed direto é rápido porém acopla os testes ao schema e pode mascarar
bugs de validação/serviço; massa 100% via API é fiel porém lenta para estados temporais. O híbrido
usa API como padrão e DB direto só onde a API não alcança.

---

## 6. Push notifications

Sem endpoint de entrega em tempo real; o envio acontece server-side via `web-push`. Cobertura em duas camadas:

- **API (`tests/notificacoes`)**: `GET /notificacoes/vapid-public-key`; `POST /notificacoes/subscribe`
  (cria `NotificacaoSubscription`, respeita `endpoint` único); `DELETE /notificacoes/subscribe`
  (remove). Exige JWT — incluir caso negativo sem token (`401`).
- **UI (E2E)**: conceder permissão de notificações via `context({ permissions: ['notifications'] })`,
  registrar o service worker, clicar em "ativar notificações" e assertar que a subscription foi criada.
- **Envio (integração backend)**: o disparo real de push (início/fim de jogo) é validado com
  `web-push` **mockado**, assertando que `sendNotification` é chamado com a subscription e o payload
  corretos. Asserir uma push entregue de verdade no browser é não-determinístico e fica fora.

---

## 7. Testes de autorização / IDOR (negativos)

Camada `api` (sem browser), exercitando os guards reais:

```gherkin
Cenário: Usuário comum não acessa endpoints de admin
  Dado um token de usuário com role USER
  Quando ele chama qualquer rota /admin/* (GET e mutações)
  Então recebe 403 Forbidden

Cenário: Usuário não vê o palpite de outro antes do prazo
  Dado dois usuários com palpites no mesmo jogo ainda aberto
  Quando o usuário A consulta os palpites do jogo
  Então o palpite do usuário B não é exposto

Cenário: Usuário não edita aposta de outro usuário
  Dado uma aposta pertencente ao usuário B
  Quando o usuário A tenta alterá-la
  Então recebe 403/404 e a aposta de B permanece intacta
```

Cobrir também: usuário **inativo** bloqueado no login/refresh; token expirado; troca de papel.

---

## 8. Exemplo de código (esqueleto) — fluxo de confirmação de e-mail

### `e2e/support/mailpit.ts`

```ts
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

export interface MailpitMessage {
  ID: string;
  To: { Address: string }[];
  Subject: string;
}

export const mailpit = {
  async clear(): Promise<void> {
    await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' });
  },

  async waitForMessageTo(email: string, timeoutMs = 10_000): Promise<MailpitMessage> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await fetch(`${MAILPIT_URL}/api/v1/messages`);
      const { messages } = (await res.json()) as { messages: MailpitMessage[] };
      const match = messages.find((m) => m.To.some((t) => t.Address === email));
      if (match) return match;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Nenhum e-mail para ${email} em ${timeoutMs}ms`);
  },

  async getBody(id: string): Promise<string> {
    const res = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
    const data = (await res.json()) as { HTML: string; Text: string };
    return data.HTML || data.Text;
  },

  extractToken(body: string): string {
    const match = body.match(/confirmar-email\?token=([\w.-]+)/);
    if (!match) throw new Error('Token de confirmação não encontrado no e-mail');
    return match[1];
  },
};
```

### `e2e/pages/login.page.ts`

```ts
import { Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, senha: string) {
    await this.page.getByLabel('E-mail').fill(email);
    await this.page.getByLabel('Senha').fill(senha);
    await this.page.getByRole('button', { name: /entrar/i }).click();
  }

  async expectLoggedIn() {
    await expect(this.page).toHaveURL(/\/jogos/);
  }
}
```

### `e2e/tests/auth/registro-confirmacao.spec.ts`

```ts
import { test, expect } from '../../fixtures';
import { mailpit } from '../../support/mailpit';
import { LoginPage } from '../../pages/login.page';
import { newUser } from '../../data/user.factory';

test.describe('Registro → confirmação de e-mail → login', () => {
  test.beforeEach(async () => {
    await mailpit.clear();
  });

  test('usuário se registra, confirma o e-mail e faz login', async ({ page, request }) => {
    const user = newUser(); // { nome, email único por worker, senha }

    // 1. Registro via API (App Action) — foco do teste é confirmação + login
    const res = await request.post('/auth/registrar', {
      data: { nome: user.nome, email: user.email, senha: user.senha },
    });
    expect(res.ok()).toBeTruthy();

    // 2. E-mail chega no Mailpit com link de ativação
    const msg = await mailpit.waitForMessageTo(user.email);
    expect(msg.Subject).toMatch(/confirm/i);
    const body = await mailpit.getBody(msg.ID);
    expect(body).toContain(user.nome); // variável do template renderizada
    const token = mailpit.extractToken(body);

    // 3. Confirma o e-mail navegando no link extraído
    await page.goto(`/auth/confirmar-email?token=${token}`);
    await expect(page.getByText(/e-mail confirmado/i)).toBeVisible();

    // 4. Login completa o fluxo ponta-a-ponta
    const login = new LoginPage(page);
    await login.goto();
    await login.login(user.email, user.senha);
    await login.expectLoggedIn();
  });
});
```

---

## 9. Integração com CI

Novo job `e2e` no `.github/workflows/ci.yml`, após `lint`/`test`:

- **Service containers:** Postgres, Redis, Mailpit.
- **Passos:** `pnpm install --frozen-lockfile` → `prisma migrate deploy` + seed → subir backend e
  frontend (modo prod ou dev) → `pnpm --filter @bolao/e2e exec playwright test`.
- **Artefatos:** publicar `playwright-report/` e traces em caso de falha (`if: failure()`).
- **Browsers:** cache de `~/.cache/ms-playwright` + `playwright install --with-deps chromium`.

Sharding por workers quando a suíte crescer.

---

## 10. Ordem de implementação sugerida

1. Scaffold do workspace `e2e/`, `playwright.config.ts`, fixtures e global-setup (storageState por papel).
2. Helpers de suporte: `mailpit.ts`, `db.ts`, `queue.ts`, `time.ts`; factories.
3. Auth (registro→confirmação→login, recuperação de senha).
4. Bolão + convite + bolão global.
5. Aposta + prazo (upsert e bloqueio).
6. Pontuação + publicação (com `expect.poll` na fila Bull).
7. Autorização/IDOR (camada API).
8. Push notifications (API + UI + envio mockado).
9. Resiliência (rede, payload, sessão, concorrência).
10. Job `e2e` no CI.

Cada item entra como tarefa no plano de implementação (writing-plans).
