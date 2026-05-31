# Deploy em produção na GCP — Cloud Run + serviços gerenciados

**Data:** 2026-05-30
**Status:** Aprovado (design) — pronto para plano de implementação
**Autor:** Fred + Claude

---

## 1. Objetivo

Colocar o **Bolão Trovão** em produção na Google Cloud Platform, com:

- **Deploy automático** ao dar merge na branch `main`.
- **HTTPS** no domínio `bolaotrovao.com` (+ `www` e `api`).
- **Zero segredos no git** ou em arquivos — tudo no Secret Manager.
- **Custo baixo** — caber no crédito de US$300/3 meses e permanecer modesto depois.
- Carga esperada: ~200 usuários cadastrados, ~20 acessos simultâneos.

Projeto GCP existente reutilizado: **`bolao-497903`**.

---

## 2. Decisões consolidadas (do brainstorming)

| Tema | Decisão |
|---|---|
| Hospedagem dos apps | **Cloud Run** (serverless gerenciado) — frontend e backend |
| Banco de dados | **Cloud SQL for PostgreSQL** (menor tier, backups automáticos) |
| Redis (filas Bull) | **Container Redis numa VM e2-micro free-tier** (~US$0) |
| Conexão Cloud Run → Redis | **Direct VPC egress** (sem custo de VPC connector) |
| Conexão Cloud Run → Postgres | **Cloud SQL connector** (socket Unix, sem expor IP) |
| HTTPS / domínio | **Cloud Run Domain Mappings** (certs gerenciados, sem Load Balancer) |
| E-mail transacional | **Gmail SMTP + app password** (grátis, ~500/dia) |
| Segredos | **Secret Manager**, injetados via `--set-secrets` |
| Deploy CI/CD | **GitHub Actions** + **Workload Identity Federation** (sem chave JSON) |
| Filas Bull | Backend `min-instances=1` + `--no-cpu-throttling` (worker sempre vivo) |
| Cold start | Frontend **também** `min-instances=1` |

### Região

Tudo em **`us-central1`** (zona `us-central1-a`). Motivo: a VM e2-micro só é grátis (free-tier permanente) em `us-central1`, `us-east1` ou `us-west1`, e `us-central1` suporta Cloud Run Domain Mappings.

---

## 3. Arquitetura

```
                      Internet (HTTPS)
                            │
        ┌───────────────────┴────────────────────┐
        │                                         │
  bolaotrovao.com / www                  api.bolaotrovao.com
        │                                         │
   ┌────▼─────────┐                       ┌────────▼────────┐
   │ Cloud Run    │   fetch (browser)     │  Cloud Run      │
   │ FRONTEND     │ ────────────────────► │  BACKEND        │
   │ Next.js      │   credentials:include │  NestJS         │
   │ min=1        │                       │  min=1, CPU on  │
   └──────────────┘                       └───┬─────────┬───┘
                                              │         │
                              Cloud SQL conn. │         │ Direct VPC egress
                                          ┌───▼────┐ ┌──▼──────────────┐
                                          │Cloud SQL│ │ VM e2-micro     │
                                          │Postgres │ │ Redis 7         │
                                          │ backups │ │ IP privado+senha│
                                          └─────────┘ └─────────────────┘
```

**Componentes GCP:**

- **Artifact Registry** (`bolao`): repositório Docker para as imagens `backend` e `frontend`.
- **Cloud Run `bolao-backend`**: `min-instances=1`, CPU sempre alocada (`--no-cpu-throttling`), Direct VPC egress (para alcançar o Redis), Cloud SQL connector. Roda `prisma migrate deploy` no boot.
- **Cloud Run `bolao-frontend`**: `min-instances=1`, sem acesso a banco/Redis.
- **Cloud SQL `bolao-db`** (Postgres 16, `db-f1-micro`): banco `bolao_trovao`, backups diários.
- **VM `redis-vm`** (e2-micro, COS): container `redis:7-alpine` com senha e AOF, só IP privado.
- **Secret Manager**: todos os segredos.
- **Cloud DNS**: zona criada pelo Cloud Domains ao comprar `bolaotrovao.com`.

### Por que não há mudança de código

- **CORS** (`apps/backend/src/main.ts`): `origin: process.env.APP_URL`, `credentials: true`. Basta `APP_URL=https://bolaotrovao.com`.
- **Cookie de refresh** (`apps/backend/src/auth/auth.controller.ts`): `httpOnly`, `sameSite:'strict'`, `secure` em produção, **sem `domain`**. Como `bolaotrovao.com` e `api.bolaotrovao.com` compartilham o mesmo *registrable domain*, são **same-site** → o cookie é enviado nas chamadas do front para a API. Exige apenas HTTPS nos dois hosts (teremos) e `APP_URL` correto.
- **Redis** (`apps/backend/src/app.module.ts`): lê `process.env.REDIS_URL` (default `redis://localhost:6379`). Em produção passamos `REDIS_URL=redis://:<senha>@<ip-privado>:6379`.

---

## 4. Custo estimado (mensal)

| Item | Custo aprox. |
|---|---|
| Cloud Run backend (min=1, CPU sempre alocada, 1 vCPU/512Mi) | US$15–45 |
| Cloud Run frontend (min=1, 1 vCPU/512Mi) | US$10–20 |
| Cloud SQL `db-f1-micro` + 10GB + backups | US$9–12 |
| VM e2-micro Redis | **US$0** (free-tier) |
| Artifact Registry (storage) | < US$1 |
| Cloud DNS (1 zona) | ~US$0,20 |
| Egress de rede (carga baixa) | ~US$0–2 |
| **Total** | **~US$35–80/mês** |

O crédito de US$300/3 meses (~US$100/mês) cobre com folga. Depois do crédito, se o custo do Cloud Run sempre-ligado incomodar, a alavanca de economia é reduzir CPU/memória ou migrar para a alternativa "1 VM + docker-compose" (que rodaria ~US$13–15/mês). **Não faz parte deste escopo**, mas fica registrado.

---

## 5. Pré-requisitos e ferramenta de trabalho

> **Recomendação forte:** faça toda a configuração inicial (Seção 6) pelo **Google Cloud Shell**
> (ícone `>_` no topo do [console.cloud.google.com](https://console.cloud.google.com)). Ele já vem com
> `gcloud`, `openssl`, `docker` e `git` instalados e autenticado — evita atrito de ambiente no Windows.
> Para clonar o repositório lá dentro: `git clone <url-do-repo> && cd bolao-trovao`.

Antes de começar, defina as variáveis de ambiente da sessão (no Cloud Shell):

```bash
export PROJECT_ID=bolao-497903
export REGION=us-central1
export ZONE=us-central1-a
export REPO=$(git config --get remote.origin.url | sed 's#.*github.com[:/]##; s/\.git$//')  # ex: fredfarias/bolao-trovao
gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
```

---

## 6. Passo-a-passo de configuração (executado uma vez)

### Fase 1 — Habilitar APIs

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  compute.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  dns.googleapis.com \
  domains.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com
```

### Fase 2 — Comprar domínio e configurar DNS

1. No Console: **Network Services → Cloud Domains → Register domain** → `bolaotrovao.com` → comprar.
   Isso cria automaticamente uma **zona gerenciada no Cloud DNS**.
2. Confirme a zona:
   ```bash
   gcloud dns managed-zones list
   export DNS_ZONE=$(gcloud dns managed-zones list --format='value(name)' --filter='dnsName~bolaotrovao')
   ```

### Fase 3 — Cloud SQL (PostgreSQL)

```bash
# Instância (menor tier, backups diários às 06:00 UTC)
gcloud sql instances create bolao-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=$REGION \
  --storage-size=10GB \
  --storage-auto-increase \
  --backup --backup-start-time=06:00 \
  --availability-type=zonal

# Banco da aplicação
gcloud sql databases create bolao_trovao --instance=bolao-db

# Usuário da aplicação (gere uma senha forte e GUARDE — vai para o Secret Manager)
export DB_PASSWORD=$(openssl rand -base64 24)
gcloud sql users create bolao --instance=bolao-db --password="$DB_PASSWORD"

# Nome de conexão (formato projeto:regiao:instancia) — usado pelo Cloud Run
export SQL_CONN=$(gcloud sql instances describe bolao-db --format='value(connectionName)')
echo "SQL_CONN=$SQL_CONN"
```

`DATABASE_URL` de produção (socket Unix do Cloud SQL connector):

```
postgresql://bolao:${DB_PASSWORD}@localhost/bolao_trovao?host=/cloudsql/${SQL_CONN}&schema=public
```

### Fase 4 — VM e2-micro com Redis

```bash
export REDIS_PASSWORD=$(openssl rand -base64 24)

# VM e2-micro (free-tier), rodando container Redis via Container-Optimized OS.
# Persistência AOF ligada; protegida por senha.
gcloud compute instances create redis-vm \
  --zone=$ZONE \
  --machine-type=e2-micro \
  --image-family=cos-stable --image-project=cos-cloud \
  --boot-disk-size=10GB \
  --network=default --subnet=default \
  --container-image=redis:7-alpine \
  --container-restart-policy=always \
  --container-arg="--requirepass" --container-arg="$REDIS_PASSWORD" \
  --container-arg="--appendonly"  --container-arg="yes"

# IP privado da VM (usado no REDIS_URL)
export REDIS_IP=$(gcloud compute instances describe redis-vm --zone=$ZONE \
  --format='value(networkInterfaces[0].networkIP)')
echo "REDIS_IP=$REDIS_IP"
```

`REDIS_URL` de produção:

```
redis://:${REDIS_PASSWORD}@${REDIS_IP}:6379
```

> **Nota de segurança:** a senha do Redis aparece nos metadados da instância (visível a quem
> tem acesso ao projeto — só você). É defesa em profundidade; a proteção principal é a rede
> (sem IP público + firewall default-deny). Se quiser blindar mais tarde, troque o `--container-arg`
> por um startup-script que lê a senha do Secret Manager.

### Fase 5 — Firewall (rede privada)

A GCP **bloqueia todo ingresso por padrão**; só abrimos o necessário.

```bash
# Permite Cloud Run (Direct VPC egress, faixa da sub-rede default us-central1) alcançar o Redis
gcloud compute firewall-rules create allow-redis-internal \
  --network=default --direction=INGRESS --action=ALLOW \
  --rules=tcp:6379 --source-ranges=10.128.0.0/20

# Permite SSH apenas via Identity-Aware Proxy (para você administrar a VM com segurança)
gcloud compute firewall-rules create allow-ssh-iap \
  --network=default --direction=INGRESS --action=ALLOW \
  --rules=tcp:22 --source-ranges=35.235.240.0/20
```

> A porta 6379 **nunca** é exposta à internet. Para abrir um shell na VM:
> `gcloud compute ssh redis-vm --zone=$ZONE --tunnel-through-iap`.

### Fase 6 — Artifact Registry

```bash
gcloud artifacts repositories create bolao \
  --repository-format=docker --location=$REGION \
  --description="Imagens Docker do Bolão Trovão"

export IMAGE_BASE="$REGION-docker.pkg.dev/$PROJECT_ID/bolao"
```

### Fase 7 — OAuth Google de produção

Manual no Console (**APIs & Services → Credentials**):

1. **Create credentials → OAuth client ID → Web application** (separe do client de dev).
2. **Authorized JavaScript origins:** `https://bolaotrovao.com`
3. **Authorized redirect URIs:** `https://api.bolaotrovao.com/auth/google/callback`
4. **OAuth consent screen:** publicar (status *In production*). Como o app só pede `email` e `profile`
   (escopos non-sensitive), **não** exige verificação do Google.
5. Anote o **Client ID** e **Client secret** (vão para o Secret Manager).

### Fase 8 — Gerar e guardar segredos no Secret Manager

```bash
# Helper
create_secret () { printf "%s" "$2" | gcloud secrets create "$1" --data-file=- --replication-policy=automatic; }

# JWT
create_secret JWT_SECRET          "$(openssl rand -base64 48)"
create_secret JWT_REFRESH_SECRET  "$(openssl rand -base64 48)"

# Banco e Redis (montados nas fases 3 e 4)
create_secret DATABASE_URL "postgresql://bolao:${DB_PASSWORD}@localhost/bolao_trovao?host=/cloudsql/${SQL_CONN}&schema=public"
create_secret REDIS_URL    "redis://:${REDIS_PASSWORD}@${REDIS_IP}:6379"

# Google OAuth (cole os valores da Fase 7)
create_secret GOOGLE_CLIENT_ID     "<cole-aqui>"
create_secret GOOGLE_CLIENT_SECRET "<cole-aqui>"

# SMTP Gmail (gere a app password em myaccount.google.com → Segurança → Senhas de app)
create_secret SMTP_USER "<seuemail@gmail.com>"
create_secret SMTP_PASS "<app-password-de-16-chars>"

# Web Push VAPID
npx web-push generate-vapid-keys   # copie as duas chaves geradas
create_secret VAPID_PUBLIC_KEY  "<chave-publica>"
create_secret VAPID_PRIVATE_KEY "<chave-privada>"
```

> Se precisar **atualizar** um segredo depois:
> `printf "%s" "<novo-valor>" | gcloud secrets versions add NOME --data-file=-`

### Fase 9 — Service accounts e IAM

```bash
# (a) SA de runtime do Cloud Run — privilégio mínimo
gcloud iam service-accounts create bolao-run \
  --display-name="Cloud Run runtime - Bolao"
export RUN_SA="bolao-run@$PROJECT_ID.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$RUN_SA" --role="roles/secretmanager.secretAccessor"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$RUN_SA" --role="roles/cloudsql.client"

# (b) SA de deploy usada pelo GitHub Actions
gcloud iam service-accounts create github-deploy \
  --display-name="GitHub Actions deploy"
export DEPLOY_SA="github-deploy@$PROJECT_ID.iam.gserviceaccount.com"

for ROLE in roles/run.admin roles/artifactregistry.writer roles/cloudsql.client roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$DEPLOY_SA" --role="$ROLE"
done
# Permite a SA de deploy "agir como" a SA de runtime ao implantar
gcloud iam service-accounts add-iam-policy-binding $RUN_SA \
  --member="serviceAccount:$DEPLOY_SA" --role="roles/iam.serviceAccountUser"
```

### Fase 10 — Workload Identity Federation (GitHub → GCP sem chave)

```bash
# Pool
gcloud iam workload-identity-pools create github \
  --location=global --display-name="GitHub Actions"

# Provider OIDC, restrito ao SEU repositório
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global --workload-identity-pool=github \
  --display-name="GitHub provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${REPO}'"

# Deixa o GitHub (só este repo) assumir a SA de deploy
gcloud iam service-accounts add-iam-policy-binding $DEPLOY_SA \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${REPO}"

# Valor que vai como variável (NÃO-secreta) no GitHub:
echo "WIF_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/github-provider"
echo "DEPLOY_SA=$DEPLOY_SA"
```

### Fase 11 — Primeiro deploy manual (validação)

Faz o primeiro deploy à mão para validar tudo **antes** de automatizar.

```bash
gcloud auth configure-docker $REGION-docker.pkg.dev

# Build + push backend (contexto = raiz do repo)
docker build -f apps/backend/Dockerfile -t $IMAGE_BASE/backend:bootstrap .
docker push $IMAGE_BASE/backend:bootstrap

# Build + push frontend (NEXT_PUBLIC_API_URL é assado no bundle)
docker build -f apps/frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.bolaotrovao.com \
  -t $IMAGE_BASE/frontend:bootstrap .
docker push $IMAGE_BASE/frontend:bootstrap

# Deploy backend
gcloud run deploy bolao-backend \
  --image=$IMAGE_BASE/backend:bootstrap \
  --region=$REGION --platform=managed \
  --service-account=$RUN_SA \
  --min-instances=1 --no-cpu-throttling \
  --cpu=1 --memory=512Mi \
  --allow-unauthenticated \
  --add-cloudsql-instances=$SQL_CONN \
  --network=default --subnet=default --vpc-egress=private-ranges-only \
  --set-env-vars=NODE_ENV=production,PORT=3001,APP_URL=https://bolaotrovao.com,GOOGLE_CALLBACK_URL=https://api.bolaotrovao.com/auth/google/callback,JWT_EXPIRES_IN=15m,JWT_REFRESH_EXPIRES_IN=30d,SMTP_HOST=smtp.gmail.com,SMTP_PORT=587,"SMTP_FROM=Bolão Trovão <noreply@bolaotrovao.com>",VAPID_MAILTO=mailto:admin@bolaotrovao.com \
  --set-secrets=JWT_SECRET=JWT_SECRET:latest,JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest,DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,SMTP_USER=SMTP_USER:latest,SMTP_PASS=SMTP_PASS:latest,VAPID_PUBLIC_KEY=VAPID_PUBLIC_KEY:latest,VAPID_PRIVATE_KEY=VAPID_PRIVATE_KEY:latest

# Deploy frontend
gcloud run deploy bolao-frontend \
  --image=$IMAGE_BASE/frontend:bootstrap \
  --region=$REGION --platform=managed \
  --min-instances=1 --cpu=1 --memory=512Mi \
  --allow-unauthenticated \
  --set-env-vars=NODE_ENV=production
```

> O `ENTRYPOINT` do backend roda `prisma migrate deploy` automaticamente no boot — as tabelas
> são criadas nesta primeira subida. Verifique os logs:
> `gcloud run services logs read bolao-backend --region=$REGION --limit=50`.

### Fase 12 — Domain Mappings + registros DNS

```bash
gcloud run domain-mappings create --service=bolao-frontend --domain=bolaotrovao.com     --region=$REGION
gcloud run domain-mappings create --service=bolao-frontend --domain=www.bolaotrovao.com --region=$REGION
gcloud run domain-mappings create --service=bolao-backend  --domain=api.bolaotrovao.com --region=$REGION
```

Cada comando imprime os **registros DNS** (A/AAAA para o apex; CNAME para `www` e `api`).
Adicione-os na zona do Cloud DNS — exemplo para os CNAMEs:

```bash
gcloud dns record-sets create www.bolaotrovao.com. --zone=$DNS_ZONE --type=CNAME --ttl=3600 --rrdatas="ghs.googlehosted.com."
gcloud dns record-sets create api.bolaotrovao.com. --zone=$DNS_ZONE --type=CNAME --ttl=3600 --rrdatas="ghs.googlehosted.com."
# Para o apex (bolaotrovao.com): use os IPs A/AAAA exatos que o comando de mapping mostrou.
```

> O certificado TLS gerenciado leva de minutos a ~24h para ficar ativo na primeira vez. Acompanhe:
> `gcloud run domain-mappings describe --domain=bolaotrovao.com --region=$REGION`.

### Fase 13 — Seed da Copa (uma vez)

Roda o seed (`apps/backend/prisma/seed.ts`) contra o banco de produção via Cloud SQL Auth Proxy:

```bash
# No Cloud Shell, na raiz do repo
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.11.0/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy
./cloud-sql-proxy $SQL_CONN &           # abre o proxy em localhost:5432

pnpm install
pnpm --filter @bolao/backend exec prisma generate
DATABASE_URL="postgresql://bolao:${DB_PASSWORD}@localhost:5432/bolao_trovao?schema=public" \
  pnpm --filter @bolao/backend exec ts-node prisma/seed.ts

kill %1                                  # encerra o proxy
```

> O seed também cria o admin padrão (`admin@bolaotrovao.com` / `admin123`). **Troque a senha no
> primeiro login** em produção.

### Fase 14 — Deploy automático (GitHub Actions)

**(a) Variáveis no GitHub** (Settings → Secrets and variables → Actions → **Variables**, não Secrets — não são sensíveis):

| Nome | Valor |
|---|---|
| `GCP_PROJECT_ID` | `bolao-497903` |
| `GCP_REGION` | `us-central1` |
| `WIF_PROVIDER` | (saída da Fase 10) |
| `DEPLOY_SA` | `github-deploy@bolao-497903.iam.gserviceaccount.com` |

**(b) Novo workflow** `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

concurrency:
  group: deploy-main
  cancel-in-progress: false

permissions:
  contents: read
  id-token: write   # necessário para Workload Identity Federation

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.WIF_PROVIDER }}
          service_account: ${{ vars.DEPLOY_SA }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker
        run: gcloud auth configure-docker ${{ vars.GCP_REGION }}-docker.pkg.dev --quiet

      - name: Build & push images
        env:
          IMAGE_BASE: ${{ vars.GCP_REGION }}-docker.pkg.dev/${{ vars.GCP_PROJECT_ID }}/bolao
        run: |
          docker build -f apps/backend/Dockerfile -t $IMAGE_BASE/backend:${{ github.sha }} .
          docker push $IMAGE_BASE/backend:${{ github.sha }}
          docker build -f apps/frontend/Dockerfile \
            --build-arg NEXT_PUBLIC_API_URL=https://api.bolaotrovao.com \
            -t $IMAGE_BASE/frontend:${{ github.sha }} .
          docker push $IMAGE_BASE/frontend:${{ github.sha }}

      - name: Deploy backend
        env:
          IMAGE_BASE: ${{ vars.GCP_REGION }}-docker.pkg.dev/${{ vars.GCP_PROJECT_ID }}/bolao
        run: |
          gcloud run deploy bolao-backend \
            --image=$IMAGE_BASE/backend:${{ github.sha }} \
            --region=${{ vars.GCP_REGION }} --quiet

      - name: Deploy frontend
        env:
          IMAGE_BASE: ${{ vars.GCP_REGION }}-docker.pkg.dev/${{ vars.GCP_PROJECT_ID }}/bolao
        run: |
          gcloud run deploy bolao-frontend \
            --image=$IMAGE_BASE/frontend:${{ github.sha }} \
            --region=${{ vars.GCP_REGION }} --quiet
```

> Como toda config (env vars, secrets, flags) já foi fixada no primeiro deploy manual (Fase 11),
> as revisões seguintes **herdam** essas configurações — o workflow só troca a imagem. Isso mantém
> o YAML enxuto e sem segredo algum.

**(c) Branch protection** (Settings → Branches → Add rule, branch `main`):

- ☑ Require a pull request before merging
- ☑ Require status checks to pass before merging → selecione os checks do CI (`Lint`, `Unit Tests`, `E2E Tests`)

Assim, só código testado chega na `main`, e o `deploy.yml` apenas publica.

### Fase 15 — Smoke test final

1. Abra `https://bolaotrovao.com` → frontend carrega com HTTPS válido.
2. Login por e-mail/senha (admin) → cookie de refresh persiste após F5.
3. Login com Google → redireciona e autentica.
4. Registre um placar no admin → confirme nos logs do backend que o job Bull processou o ranking
   (`gcloud run services logs read bolao-backend --region=$REGION`).
5. Dispare um "esqueci a senha" → e-mail chega via Gmail SMTP.

---

## 7. Operação contínua

- **Rollback:** `gcloud run services update-traffic bolao-backend --region=$REGION --to-revisions=<REVISAO-ANTERIOR>=100` (idem frontend). Listar revisões: `gcloud run revisions list --service=bolao-backend --region=$REGION`.
- **Logs:** `gcloud run services logs read <serviço> --region=$REGION` ou Console → Cloud Run → Logs.
- **Backups do banco:** automáticos (Fase 3). Restore: `gcloud sql backups list --instance=bolao-db` + `gcloud sql backups restore`.
- **Custo:** acompanhe em Billing → Reports; configure um **orçamento com alerta** (ex.: US$80/mês) em Billing → Budgets & alerts.
- **Atualizar um segredo:** `gcloud secrets versions add NOME --data-file=-` e redeploy (nova revisão relê `:latest`).

---

## 8. Checklist de segurança

- ☑ Nenhum segredo no git (`.env` no `.gitignore`; produção lê do Secret Manager).
- ☑ Nenhuma chave JSON de service account (auth via WIF, tokens efêmeros).
- ☑ WIF restrito ao repositório específico (`attribute-condition`).
- ☑ SAs com privilégio mínimo (runtime só acessa secrets + Cloud SQL).
- ☑ Postgres e Redis sem IP público; Redis com senha + firewall default-deny.
- ☑ HTTPS obrigatório (certs gerenciados); cookie de refresh `secure`+`httpOnly`+`sameSite:strict`.
- ☑ OAuth client de produção separado do de desenvolvimento.
- ☑ Trocar senha do admin padrão no primeiro acesso.

---

## 9. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Certificado TLS demora a propagar | Esperado na 1ª vez (até 24h); validar com `domain-mappings describe`. |
| VM Redis reinicia e perde jobs em voo | AOF reduz perda; rankings são recalculáveis pelo admin. Dado crítico mora no Postgres. |
| Custo do Cloud Run sempre-ligado após o crédito | Orçamento com alerta; alavanca = reduzir CPU/mem ou migrar para 1 VM + docker-compose. |
| `db-f1-micro` ficar pequeno | `--storage-auto-increase` já ligado; tier pode subir sem recriar a instância. |
| Erro de migration no deploy | `migrate deploy` é idempotente; se falhar, a revisão nova não recebe tráfego — rollback imediato. |

---

## 10. Fora de escopo (futuro)

- CDN / WAF (exigiria Load Balancer).
- Alta disponibilidade regional do Postgres (`--availability-type=regional`).
- Observabilidade avançada (Cloud Monitoring dashboards, alertas de erro).
- Migração para arquitetura "1 VM + docker-compose" caso o custo justifique.
</content>
</invoke>
