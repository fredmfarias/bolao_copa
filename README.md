# Bolão Trovão

**Bolão Trovão** é uma aplicação web de bolão esportivo para a Copa do Mundo 2026. Usuários criam ou entram em grupos, registram palpites de placar para cada partida e disputam pontos em rankings ao vivo.

---

## Funcionalidades

- **Grupos (Bolões)** — crie grupos privados com código de convite ou participe do bolão global automático
- **Palpites** — envie previsões de placar com prazo de 60 min antes do apito inicial; re-envios substituem o palpite anterior
- **Palpites revelados** — após o encerramento das apostas, a tela do jogo lista os palpites ordenados pela classificação de cada membro no bolão, com destaque metálico para os 5 primeiros colocados (mesmo estilo do ranking) e um filtro por placar com chips e contagem
- **Pontuação automática** — placar exato, acerto de vencedor, empate e outros níveis de acerto computados assincronamente via fila Redis
- **Ranking por publicação** — participantes veem um snapshot congelado publicado pelo admin; dois modos: **Geral** (acumulado) e **Rodada** (seletor por data da publicação, ranking reordenado pela pontuação da rodada e lista de palpites do usuário no expand). Os **5 primeiros colocados** ganham destaque metálico na listagem (ouro, prata e bronze; 4º e 5º em tons degradê do bronze)
- **Variação de posição** — seta colorida indicando quantas posições o participante subiu ou caiu em relação à publicação anterior
- **Gráfico de evolução** — line chart com a trajetória de posição do participante ao longo das rodadas
- **Notificações push** — alertas via Web Push (PWA) quando partidas começam ou terminam
- **Login social** — autenticação com Google OAuth ou e-mail/senha
- **Painel administrativo** — habilitar/desabilitar bolões, gerenciar placares, pré-visualizar ranking (draft ao vivo), publicar rankings globalmente (com modal de confirmação listando os jogos da rodada) e gerir usuários com busca por nome/email (ativar/desativar, resetar senha). Usuários desativados não conseguem entrar (Google ou e-mail/senha) e deixam de aparecer nas listas de membros, nas contagens e nos rankings
- **Janela de inscrição** — cadastros e ingresso em bolões fecham 2h antes do primeiro jogo da Copa. Após esse horário, apenas o admin pode criar contas (em `/admin/usuarios`) e adicionar usuários a bolões.

---

## Stack

| Camada | Tecnologias |
|---|---|
| **Backend** | NestJS 10, Prisma 5 (PostgreSQL), Bull 4 (Redis), Passport.js (JWT + Google OAuth), Nodemailer, web-push |
| **Frontend** | Next.js 14 (App Router), React 18, shadcn/ui v4, Tailwind CSS 3.4, Recharts |
| **Shared** | Pacote TypeScript com enums e constantes compartilhados |
| **Infra** | Docker Compose, Nginx (proxy reverso), Turborepo, pnpm workspaces |
| **Testes** | Jest 29 + Testing Library (frontend), ts-jest (backend) |

---

## Pré-requisitos

- [Node.js 20+](https://nodejs.org/)
- [pnpm 9+](https://pnpm.io/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

---

## Início rápido (desenvolvimento)

O fluxo recomendado roda **infra no Docker** (Postgres, Redis, Mailpit) e **backend + frontend nativos** na sua máquina. Assim o hot-reload é instantâneo: salvou o arquivo → a mudança já aparece (o frontend atualiza sozinho via HMR, o backend reinicia em ~1s).

```bash
# 1. Clone e prepare o ambiente (instala deps, sobe infra, migra e popula o banco)
git clone <url-do-repo>
cd bolao-trovao
cp .env.example .env
pnpm setup

# 2. Suba backend e frontend (um único terminal, em paralelo)
pnpm dev
```

Serviços disponíveis:

| Serviço | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| Mailpit (e-mails de dev) | http://localhost:8025 |
| Postgres | localhost:5432 |
| Redis | localhost:6379 |

> [!NOTE]
> O seed cria o usuário administrador com credenciais padrão:
> - **E-mail:** `admin@bolaotrovao.com`
> - **Senha:** `admin123`
>
> Troque a senha após o primeiro login. Para criar outros usuários, acesse http://localhost:3000/registrar.

### O que rodar após mudar o código

| Você alterou… | O que fazer |
|---|---|
| `apps/frontend/**` | **Nada.** O Next.js aplica via HMR — basta olhar o browser (no máximo F5). |
| `apps/backend/**` | **Nada.** O NestJS reinicia em modo watch automaticamente (~1s). |
| `packages/shared/**` | Reinicie o `pnpm dev` (Ctrl+C e rode de novo) — o shared é recompilado no boot. |
| `prisma/schema.prisma` | `pnpm db:migrate` (cria a migração e regenera o client). |
| `package.json` (deps) | `pnpm install` e reinicie o `pnpm dev`. |

### Comandos de infra e banco

```bash
pnpm dev:infra        # sobe Postgres + Redis + Mailpit (detached)
pnpm dev:infra:down   # para a infra (dados persistem em volumes)
pnpm db:migrate       # aplica/gera migrações Prisma
pnpm db:seed          # popula o banco com dados da Copa 2026
pnpm db:reset         # ⚠️ destrói o banco e recria + seed
```

> [!TIP]
> Para zerar completamente os dados da infra:
> ```bash
> docker compose -f docker-compose.infra.yml down -v
> pnpm setup
> ```

### Alternativa: stack completa no Docker

Útil só para um smoke test do build de produção (sem hot-reload — exige rebuild a cada mudança):

```bash
docker compose up --build -d
docker exec bolao-trovao-backend-1 sh -c "cd /app/apps/backend && npx prisma db seed"
```

---

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha os valores:

```bash
cp .env.example .env
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | Sim | URL de conexão PostgreSQL |
| `REDIS_HOST` / `REDIS_PORT` | Sim | Endereço do Redis (usado pelo Bull) |
| `JWT_SECRET` | Sim | Chave de assinatura dos tokens de acesso (32+ chars) |
| `JWT_REFRESH_SECRET` | Sim | Chave de assinatura dos refresh tokens (32+ chars) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Não | OAuth Google — deixe em branco para desabilitar |
| `GOOGLE_CALLBACK_URL` | Não | URI de callback do OAuth — deve bater com a registrada no Google Cloud Console (ex.: `https://seudominio.com/auth/google/callback`) |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Não | Envio de e-mails (recuperação de senha, etc.) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Não | Web Push — gere com `npx web-push generate-vapid-keys` |
| `APP_URL` | Sim | URL pública do frontend — usada no redirect pós-login Google e nos e-mails |
| `NODE_ENV` | Sim | `development` ou `production`. Em `production` o cookie de refresh token vira `secure` (exige HTTPS) |
| `NEXT_PUBLIC_API_URL` | Sim | URL do backend acessível pelo browser |

> [!IMPORTANT]
> Em produção, substitua todos os segredos padrão (`change-me...`) por valores únicos e seguros antes de subir os contêineres.

### Configuração de produção do Google OAuth

O login com Google exige ajustes específicos ao sair do ambiente local:

1. **Crie um OAuth client dedicado de produção** no [Google Cloud Console](https://console.cloud.google.com/) (Web application). Recomenda-se separar do client de desenvolvimento para isolar os segredos.
2. **Registre a redirect URI de produção** (com HTTPS) em *Authorized redirect URIs*:
   ```
   https://seudominio.com/auth/google/callback
   ```
   O valor deve ser idêntico ao `GOOGLE_CALLBACK_URL`.
3. **Publique a OAuth consent screen** (status *In production*). Em modo *Testing* apenas os e-mails listados em *Test users* conseguem logar. Como o app só pede os escopos `email` e `profile` (non-sensitive), a publicação não requer verificação do Google.
4. **Defina as variáveis de produção**:
   ```env
   GOOGLE_CLIENT_ID="<client-id-de-producao>"
   GOOGLE_CLIENT_SECRET="<secret-de-producao>"
   GOOGLE_CALLBACK_URL="https://seudominio.com/auth/google/callback"
   APP_URL="https://seudominio.com"
   NODE_ENV="production"
   ```

> [!WARNING]
> Com `NODE_ENV=production` o cookie de refresh token é marcado como `secure` e só trafega por HTTPS — o backend de produção **precisa** estar atrás de HTTPS, caso contrário o login não persiste.

---

## Scripts

Execute os scripts pela raiz do monorepo:

```bash
pnpm setup           # primeira vez: install + infra + migrate + seed
pnpm dev             # inicia backend e frontend nativos em watch (paralelo)
pnpm dev:infra       # sobe só a infra (Postgres, Redis, Mailpit)
pnpm dev:infra:down  # para a infra
pnpm db:migrate      # aplica/gera migrações Prisma
pnpm db:seed         # popula banco com dados iniciais
pnpm db:reset        # ⚠️ destrói e recria o banco + seed
pnpm build           # compila todos os pacotes (Turborepo)
pnpm test            # roda todos os testes (Turborepo)
pnpm lint            # lint em todos os pacotes (Turborepo)
```

> [!NOTE]
> `pnpm dev` usa o runner paralelo do pnpm (não o Turborepo) para evitar problemas de spawn do processo `node` em alguns ambientes Windows. `build`, `test` e `lint` continuam via Turborepo.

Ou dentro de cada app:

```bash
# Backend — os scripts db:* carregam o .env da raiz via dotenv-cli
cd apps/backend
pnpm dev          # NestJS em watch (:3001)

# Frontend
cd apps/frontend
pnpm dev          # Next.js em watch (:3000)
pnpm test:watch   # testes em modo interativo
```

---

## Estrutura do monorepo

```
bolao-trovao/
├── apps/
│   ├── backend/          # API REST (NestJS)
│   │   ├── src/
│   │   │   ├── admin/       # Draft de ranking, status de bolão, gestão de usuários
│   │   │   ├── aposta/      # Palpites (upsert)
│   │   │   ├── auth/        # JWT + Google OAuth (bloqueia usuário inativo)
│   │   │   ├── bolao/       # CRUD de bolões e convites
│   │   │   ├── jogo/        # Partidas da copa
│   │   │   ├── publicacao/  # Evento global de publicação de ranking
│   │   │   ├── ranking/     # Processador Bull + snapshots publicados
│   │   │   └── ...
│   │   └── prisma/          # Schema, migrações e seed
│   └── frontend/            # Aplicação web (Next.js 14)
│       └── src/
│           ├── app/
│           │   ├── (auth)/        # Páginas públicas (login, cadastro)
│           │   ├── (app)/         # Área protegida (jogos, ranking, bolões)
│           │   └── (admin)/       # Painel admin (bolões, placares, ranking, usuários)
│           ├── components/        # Componentes reutilizáveis (incl. RankingEvolucao)
│           └── hooks/             # Custom React hooks
└── packages/
    └── shared/           # Enums e constantes TypeScript compartilhados
```

---

## Deploy em produção

Produção roda na **Google Cloud Platform** (projeto `bolao-497903`):

- **Frontend e backend** em Cloud Run (`bolao-frontend`, `bolao-backend`).
- **PostgreSQL** no Cloud SQL; **Redis** (filas Bull) numa VM e2-micro free-tier.
- **HTTPS** em `bolaotrovao.com` / `api.bolaotrovao.com` via Cloud Run Domain Mappings.
- **Segredos** no Secret Manager (nada no git).
- **Deploy automático**: todo merge na `main` dispara `.github/workflows/deploy.yml`,
  que builda as imagens, publica no Artifact Registry e roda `gcloud run deploy`.
  A autenticação usa Workload Identity Federation (sem chave JSON).

Setup completo e passo-a-passo:
- Spec: `docs/superpowers/specs/2026-05-30-deploy-gcp-cloud-run-design.md`
- Plano de execução: `docs/superpowers/plans/2026-05-30-deploy-gcp-cloud-run.md`

> [!NOTE]
> O `docker-compose.prod.yml` permanece no repo apenas para smoke test local do build de produção.

---

## Como funciona a pontuação e publicação

O fluxo é em duas etapas — **cálculo ao vivo** e **publicação** — para que o admin controle o momento em que os participantes veem os resultados.

### Cálculo (assíncrono, após cada placar)

1. Admin registra o placar final de uma partida via painel
2. Backend enfileira um job no Bull (Redis)
3. `RankingProcessor` calcula os pontos de todos os palpites daquela partida
4. Resultados são gravados na tabela `Ranking` (draft ao vivo — visível só ao admin)

### Ordenação do ranking

- Apenas usuários **ativos** são rankeados.
- Todo membro do bolão aparece no ranking; quem não apostou entra com **0 pontos** e fica no fundo (uma aposta não realizada vale 0).
- Critério de desempate, nesta ordem: pontuação total → placar exato → placar do vencedor correto → empate correto (sem placar exato) → placar do perdedor correto → acertou apenas o vencedor → ordem alfabética crescente do nome.

### Publicação (evento global, acionado pelo admin)

5. Admin clica em **Publicar rodada** no painel
6. Um único evento (`POST /admin/publicacoes`) marca todos os jogos com placar preenchido como pertencentes à nova publicação (rodada N)
7. Para cada bolão habilitado × participante é gravado um `RankingSnapshot` com posição, pontuação total, pontos da rodada e variação vs publicação anterior
8. Participantes passam a ver o snapshot congelado; correções de placar posteriores só aparecem na próxima publicação

> O botão "Publicar rodada" no admin só fica habilitado quando há jogo com placar preenchido e ainda sem publicação. A confirmação prévia exibe os jogos e placares que entrarão na rodada.

> [!IMPORTANT]
> O Redis é um componente **crítico** do sistema. Sem ele, o Bull não consegue processar as filas e os rankings não são atualizados. Certifique-se de que `REDIS_HOST` aponta para o serviço correto (dentro do Docker, use o nome do serviço `redis`).

---

## Testes

```bash
# Rodar todos os testes
pnpm test

# Apenas frontend (com cobertura)
cd apps/frontend
pnpm test -- --coverage

# Verificação de tipos (backend)
cd apps/backend
pnpm exec tsc --noEmit
```

### E2E (Playwright)

Os testes E2E vivem num workspace dedicado (`e2e/`) e rodam contra um banco isolado
(`bolao_trovao_e2e`) em portas próprias (backend `:3101`, frontend `:3100`) — por isso
convivem com o `pnpm dev` normal (que usa 3000/3001) sem conflito.

Pré-requisitos: infra no ar (`pnpm dev:infra`) e o banco de teste criado uma vez:

```bash
docker exec bolao-trovao-postgres-1 psql -U bolao -d postgres -c "CREATE DATABASE bolao_trovao_e2e;"
```

```bash
# Suíte completa: reseta+popula o banco e sobe backend+frontend automaticamente
pnpm --filter @bolao/e2e test

# Um único spec (passa --project corretamente)
cd e2e && npx playwright test <arquivo> --project=api          # testes de API
cd e2e && npx playwright test <arquivo> --project=ui-chromium  # testes de UI

# Relatório HTML da última execução
pnpm --filter @bolao/e2e exec playwright show-report
```

Os testes validam e-mails via Mailpit e isolam as filas Bull no Redis (DB lógico `/3`),
sem afetar a stack de desenvolvimento.
