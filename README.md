# Bolão Trovão

**Bolão Trovão** é uma aplicação web de bolão esportivo para a Copa do Mundo 2026. Usuários criam ou entram em grupos, registram palpites de placar para cada partida e disputam pontos em rankings ao vivo.

---

## Funcionalidades

- **Grupos (Bolões)** — crie grupos privados com código de convite ou participe do bolão global automático
- **Palpites** — envie previsões de placar com prazo de 60 min antes do apito inicial; re-envios substituem o palpite anterior
- **Pontuação automática** — placar exato, acerto de vencedor, empate e outros níveis de acerto computados assincronamente via fila Redis
- **Ranking ao vivo** — pódio e tabela por bolão, recalculado após cada atualização de placar
- **Notificações push** — alertas via Web Push (PWA) quando partidas começam ou terminam
- **Login social** — autenticação com Google OAuth ou e-mail/senha
- **Painel administrativo** — gerenciar placares, rascunhar e publicar rankings, moderar usuários

---

## Stack

| Camada | Tecnologias |
|---|---|
| **Backend** | NestJS 10, Prisma 5 (PostgreSQL), Bull 4 (Redis), Passport.js (JWT + Google OAuth), Nodemailer, web-push |
| **Frontend** | Next.js 14 (App Router), React 18, shadcn/ui v4, Tailwind CSS 3.4 |
| **Shared** | Pacote TypeScript com enums e constantes compartilhados |
| **Infra** | Docker Compose, Nginx (proxy reverso), Turborepo, pnpm workspaces |
| **Testes** | Jest 29 + Testing Library (frontend), ts-jest (backend) |

---

## Pré-requisitos

- [Node.js 20+](https://nodejs.org/)
- [pnpm 9+](https://pnpm.io/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

---

## Início rápido

### Com Docker (stack completa)

```bash
# 1. Clone e instale dependências
git clone <url-do-repo>
cd bolao-trovao
pnpm install

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com os valores necessários (veja a seção Variáveis de Ambiente)

# 3. Suba todos os serviços
docker compose up --build

# 4. Popule o banco (em outro terminal)
cd apps/backend
pnpm db:seed
```

Serviços disponíveis após a inicialização:

| Serviço | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| Mailpit (e-mails de dev) | http://localhost:8025 |

> [!NOTE]
> O seed cria dois usuários de teste:
> - `fred@bolao.com` / `senha123` — perfil **ADMIN**
> - `maria@bolao.com` / `senha123` — perfil **USER**

### Desenvolvimento local (sem Docker)

```bash
# 1. Suba apenas a infra
docker compose up postgres redis mailpit

# 2. Backend (terminal 1)
cd apps/backend
pnpm dev

# 3. Frontend (terminal 2)
cd apps/frontend
pnpm dev
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
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Não | Envio de e-mails (recuperação de senha, etc.) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Não | Web Push — gere com `npx web-push generate-vapid-keys` |
| `NEXT_PUBLIC_API_URL` | Sim | URL do backend acessível pelo browser |

> [!IMPORTANT]
> Em produção, substitua todos os segredos padrão (`change-me...`) por valores únicos e seguros antes de subir os contêineres.

---

## Scripts

Execute os scripts pela raiz do monorepo via Turborepo:

```bash
pnpm dev        # inicia backend e frontend em modo watch
pnpm build      # compila todos os pacotes
pnpm test       # roda todos os testes
pnpm lint       # lint em todos os pacotes
```

Ou dentro de cada app:

```bash
# Backend
cd apps/backend
pnpm db:migrate   # aplica migrações Prisma (dev)
pnpm db:seed      # popula banco com dados iniciais
pnpm db:reset     # ⚠️ destrói e recria o banco + seed

# Frontend
cd apps/frontend
pnpm test:watch   # testes em modo interativo
```

---

## Estrutura do monorepo

```
bolao-trovao/
├── apps/
│   ├── backend/          # API REST (NestJS)
│   │   ├── src/
│   │   │   ├── admin/    # Gerenciamento de placares e rankings
│   │   │   ├── aposta/   # Palpites (upsert)
│   │   │   ├── auth/     # JWT + Google OAuth
│   │   │   ├── bolao/    # CRUD de bolões e convites
│   │   │   ├── jogo/     # Partidas da copa
│   │   │   ├── ranking/  # Processador Bull + tabela de pontos
│   │   │   └── ...
│   │   └── prisma/       # Schema, migrações e seed
│   └── frontend/         # Aplicação web (Next.js 14)
│       └── src/
│           ├── app/
│           │   ├── (auth)/        # Páginas públicas (login, cadastro)
│           │   └── (app)/         # Área protegida (jogos, ranking, bolões)
│           ├── components/        # Componentes reutilizáveis
│           └── hooks/             # Custom React hooks
└── packages/
    └── shared/           # Enums e constantes TypeScript compartilhados
```

---

## Deploy em produção

```bash
# 1. Preencha .env com valores de produção
cp .env.example .env

# 2. Suba a stack com Nginx
docker compose -f docker-compose.prod.yml up -d --build
```

O Nginx escuta na porta 80 e roteia:
- `/api/*` → backend (porta 3001)
- `/*` → frontend (porta 3000)

> [!TIP]
> Para HTTPS, monte seus certificados em `/etc/nginx/certs` e ajuste `nginx/nginx.conf` para incluir o bloco SSL.

---

## Como funciona a pontuação

O recálculo de pontos é assíncrono e orientado a eventos:

1. Admin registra o placar final de uma partida via painel
2. Backend enfileira um job no Bull (Redis)
3. `RankingProcessor` calcula os pontos de todos os palpites daquela partida
4. Resultados são gravados na tabela `ranking`
5. Frontend lê o ranking pré-computado em tempo de resposta

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
