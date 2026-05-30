# Deploy em Produção na GCP (Cloud Run) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **⚠️ Natureza deste plano:** quase todas as tarefas são **executadas manualmente por você (Fred)** no Google Cloud Shell, pois exigem credenciais GCP, compras interativas (domínio), ações no Console (OAuth) e configurações no GitHub. Um agente **não** consegue rodá-las. Os únicos artefatos de repositório são o workflow `.github/workflows/deploy.yml` (Task 15) e a atualização do README (Task 18) — esses sim um agente pode escrever. As "verificações" abaixo substituem os testes: cada passo tem um comando de checagem e a saída esperada.

**Goal:** Publicar o Bolão Trovão em produção na GCP (projeto `bolao-497903`) com HTTPS em `bolaotrovao.com`, deploy automático no merge para `main` e nenhum segredo no git.

**Architecture:** Frontend e backend em Cloud Run; PostgreSQL no Cloud SQL; Redis em VM e2-micro free-tier alcançada via Direct VPC egress; HTTPS via Cloud Run Domain Mappings; segredos no Secret Manager; CI/CD via GitHub Actions com Workload Identity Federation (sem chave JSON).

**Tech Stack:** GCP (Cloud Run, Cloud SQL, Compute Engine, Artifact Registry, Secret Manager, Cloud DNS, Cloud Domains, IAM/WIF), Docker, GitHub Actions, `gcloud` CLI.

**Spec de referência:** `docs/superpowers/specs/2026-05-30-deploy-gcp-cloud-run-design.md`

---

## Pré-requisitos

- [ ] Acesso de **Owner** ao projeto GCP `bolao-497903`.
- [ ] Billing ativo no projeto (com o crédito de US$300 aplicado).
- [ ] Acesso de admin ao repositório GitHub do Bolão Trovão.
- [ ] Trabalhar pelo **Google Cloud Shell** (`>_` em console.cloud.google.com) — já tem `gcloud`, `docker`, `openssl`, `git`, `pnpm`/`node` e está autenticado.

> **Variáveis de sessão:** o Cloud Shell pode reciclar a sessão. Se você voltar depois de uma pausa,
> **re-execute o bloco de exports do Task 1** antes de continuar — várias tarefas dependem dessas variáveis.

---

## Task 1: Preparar Cloud Shell e variáveis de sessão

**Files:** nenhum (configuração de shell).

- [ ] **Step 1: Clonar o repo no Cloud Shell (se ainda não estiver lá)**

```bash
git clone <url-do-repo> bolao-trovao 2>/dev/null; cd ~/bolao-trovao
```

- [ ] **Step 2: Exportar as variáveis-base**

```bash
export PROJECT_ID=bolao-497903
export REGION=us-central1
export ZONE=us-central1-a
gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
export REPO=$(git config --get remote.origin.url | sed 's#.*github.com[:/]##; s/\.git$//')
export IMAGE_BASE="$REGION-docker.pkg.dev/$PROJECT_ID/bolao"
```

- [ ] **Step 3: Verificar**

Run:
```bash
echo "proj=$PROJECT_ID num=$PROJECT_NUMBER repo=$REPO"
```
Expected: imprime `proj=bolao-497903 num=<número> repo=<owner>/bolao-trovao` — todos preenchidos (nenhum vazio).

> Se `REPO` sair errado (ex.: usando outro remote), defina manualmente: `export REPO=<owner>/bolao-trovao`.

---

## Task 2: Habilitar APIs da GCP

**Files:** nenhum.

- [ ] **Step 1: Habilitar todas as APIs necessárias**

```bash
gcloud services enable \
  run.googleapis.com sqladmin.googleapis.com compute.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com \
  dns.googleapis.com domains.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com
```

- [ ] **Step 2: Verificar**

Run:
```bash
gcloud services list --enabled --format='value(config.name)' | grep -E 'run|sqladmin|compute|artifactregistry|secretmanager|dns|domains|iamcredentials|sts' | sort
```
Expected: lista as 9 APIs habilitadas (pode levar ~1 min para propagar; reexecute se faltar alguma).

---

## Task 3: Comprar domínio e confirmar zona Cloud DNS

**Files:** nenhum.

- [ ] **Step 1: Registrar o domínio (Console)**

No Console: **Network Services → Cloud Domains → Register domain** → digite `bolaotrovao.com` → siga o checkout. Marque a opção de criar a **zona Cloud DNS** automaticamente (padrão).

- [ ] **Step 2: Capturar o nome da zona**

```bash
export DNS_ZONE=$(gcloud dns managed-zones list --format='value(name)' --filter='dnsName~bolaotrovao')
echo "DNS_ZONE=$DNS_ZONE"
```

- [ ] **Step 3: Verificar**

Run:
```bash
gcloud dns managed-zones describe $DNS_ZONE --format='value(dnsName)'
```
Expected: `bolaotrovao.com.`

> Se `DNS_ZONE` vier vazio, o registro do domínio ainda está processando — aguarde alguns minutos e repita o Step 2.

---

## Task 4: Provisionar Cloud SQL (PostgreSQL)

**Files:** nenhum.

- [ ] **Step 1: Criar a instância**

```bash
gcloud sql instances create bolao-db \
  --database-version=POSTGRES_16 --tier=db-f1-micro --region=$REGION \
  --storage-size=10GB --storage-auto-increase \
  --backup --backup-start-time=06:00 --availability-type=zonal
```
(Leva ~5–10 min.)

- [ ] **Step 2: Criar banco e usuário; guardar a senha**

```bash
gcloud sql databases create bolao_trovao --instance=bolao-db
export DB_PASSWORD=$(openssl rand -base64 24)
gcloud sql users create bolao --instance=bolao-db --password="$DB_PASSWORD"
export SQL_CONN=$(gcloud sql instances describe bolao-db --format='value(connectionName)')
echo "SQL_CONN=$SQL_CONN"
```

- [ ] **Step 3: Verificar**

Run:
```bash
gcloud sql instances describe bolao-db --format='value(state)' && echo "conn=$SQL_CONN" && test -n "$DB_PASSWORD" && echo "senha OK"
```
Expected: `RUNNABLE`, depois `conn=bolao-497903:us-central1:bolao-db`, depois `senha OK`.

> **Importante:** não feche o shell sem ter `DB_PASSWORD` salva em algum lugar seguro temporariamente — ela vai para o Secret Manager no Task 9. Se a sessão cair antes disso, recrie a senha: `gcloud sql users set-password bolao --instance=bolao-db --password="$(openssl rand -base64 24)"`.

---

## Task 5: Criar VM e2-micro com Redis

**Files:** nenhum.

- [ ] **Step 1: Criar a VM com container Redis**

```bash
export REDIS_PASSWORD=$(openssl rand -base64 24)
gcloud compute instances create redis-vm \
  --zone=$ZONE --machine-type=e2-micro \
  --image-family=cos-stable --image-project=cos-cloud \
  --boot-disk-size=10GB --network=default --subnet=default \
  --container-image=redis:7-alpine --container-restart-policy=always \
  --container-arg="--requirepass" --container-arg="$REDIS_PASSWORD" \
  --container-arg="--appendonly" --container-arg="yes"
```

- [ ] **Step 2: Capturar o IP privado**

```bash
export REDIS_IP=$(gcloud compute instances describe redis-vm --zone=$ZONE \
  --format='value(networkInterfaces[0].networkIP)')
echo "REDIS_IP=$REDIS_IP REDIS_PASSWORD=$REDIS_PASSWORD"
```

- [ ] **Step 3: Verificar a VM**

Run:
```bash
gcloud compute instances describe redis-vm --zone=$ZONE --format='value(status)'
```
Expected: `RUNNING`. (O container Redis sobe ~30–60s após o boot; será testado de ponta a ponta no smoke test do Task 12/17.)

> **Confirme** que `REDIS_IP` está numa faixa privada (`10.128.x.x`). Se aparecer um IP público, algo saiu do esperado — revise o `--network/--subnet`.

---

## Task 6: Configurar firewall (rede privada)

**Files:** nenhum.

- [ ] **Step 1: Liberar Redis só para a faixa interna da sub-rede**

```bash
gcloud compute firewall-rules create allow-redis-internal \
  --network=default --direction=INGRESS --action=ALLOW \
  --rules=tcp:6379 --source-ranges=10.128.0.0/20
```

- [ ] **Step 2: Liberar SSH só via IAP**

```bash
gcloud compute firewall-rules create allow-ssh-iap \
  --network=default --direction=INGRESS --action=ALLOW \
  --rules=tcp:22 --source-ranges=35.235.240.0/20
```

- [ ] **Step 3: Verificar que 6379 NÃO está aberto à internet**

Run:
```bash
gcloud compute firewall-rules list --format='table(name,sourceRanges.list(),allowed[].map().firewall_rule().list())'
```
Expected: `allow-redis-internal` com source `10.128.0.0/20` (não `0.0.0.0/0`) e `allow-ssh-iap` com `35.235.240.0/20`. **Nenhuma** regra deve expor `tcp:6379` para `0.0.0.0/0`.

---

## Task 7: Criar Artifact Registry

**Files:** nenhum.

- [ ] **Step 1: Criar o repositório Docker**

```bash
gcloud artifacts repositories create bolao \
  --repository-format=docker --location=$REGION \
  --description="Imagens Docker do Bolão Trovão"
```

- [ ] **Step 2: Verificar**

Run:
```bash
gcloud artifacts repositories describe bolao --location=$REGION --format='value(name)'
```
Expected: termina em `/repositories/bolao`.

---

## Task 8: Criar OAuth client de produção (Console)

**Files:** nenhum.

- [ ] **Step 1: Criar o client**

Console → **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**:
- **Name:** `Bolão Trovão — Produção`
- **Authorized JavaScript origins:** `https://bolaotrovao.com`
- **Authorized redirect URIs:** `https://api.bolaotrovao.com/auth/google/callback`

- [ ] **Step 2: Publicar a consent screen**

Console → **OAuth consent screen** → garantir status **In production** (escopos `email` e `profile` são non-sensitive, não exigem verificação).

- [ ] **Step 3: Anotar credenciais**

Copie **Client ID** e **Client secret** para uso no Task 9. (Não há comando de verificação aqui — os valores serão validados no login do smoke test, Task 17.)

---

## Task 9: Popular o Secret Manager

**Files:** nenhum.

> Depende das variáveis `DB_PASSWORD`, `SQL_CONN`, `REDIS_PASSWORD`, `REDIS_IP` (Tasks 4 e 5) ainda exportadas na sessão.

- [ ] **Step 1: Definir o helper e criar os segredos de app**

```bash
create_secret () { printf "%s" "$2" | gcloud secrets create "$1" --data-file=- --replication-policy=automatic; }

create_secret JWT_SECRET          "$(openssl rand -base64 48)"
create_secret JWT_REFRESH_SECRET  "$(openssl rand -base64 48)"
create_secret DATABASE_URL "postgresql://bolao:${DB_PASSWORD}@localhost/bolao_trovao?host=/cloudsql/${SQL_CONN}&schema=public"
create_secret REDIS_URL    "redis://:${REDIS_PASSWORD}@${REDIS_IP}:6379"
```

- [ ] **Step 2: Criar os segredos do Google OAuth (valores do Task 8)**

```bash
create_secret GOOGLE_CLIENT_ID     "<cole-o-client-id>"
create_secret GOOGLE_CLIENT_SECRET "<cole-o-client-secret>"
```

- [ ] **Step 3: Criar os segredos de SMTP (Gmail app password)**

Gere a app password em myaccount.google.com → **Segurança → Verificação em duas etapas → Senhas de app**.

```bash
create_secret SMTP_USER "<seuemail@gmail.com>"
create_secret SMTP_PASS "<app-password-16-chars-sem-espacos>"
```

- [ ] **Step 4: Criar os segredos VAPID (Web Push)**

```bash
npx web-push generate-vapid-keys   # copie Public Key e Private Key da saída
create_secret VAPID_PUBLIC_KEY  "<chave-publica>"
create_secret VAPID_PRIVATE_KEY "<chave-privada>"
```

- [ ] **Step 5: Verificar que todos os 12 segredos existem**

Run:
```bash
gcloud secrets list --format='value(name)' | sort
```
Expected (12 nomes): `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_SECRET`, `REDIS_URL`, `SMTP_PASS`, `SMTP_USER`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`.

> (São 10 listados aqui — `JWT_*` x2, `GOOGLE_*` x2, `SMTP_*` x2, `VAPID_*` x2, `DATABASE_URL`, `REDIS_URL`. Confirme que nenhum está faltando.)

---

## Task 10: Criar service accounts e conceder IAM

**Files:** nenhum.

- [ ] **Step 1: SA de runtime do Cloud Run (privilégio mínimo)**

```bash
gcloud iam service-accounts create bolao-run --display-name="Cloud Run runtime - Bolao"
export RUN_SA="bolao-run@$PROJECT_ID.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$RUN_SA" --role="roles/secretmanager.secretAccessor"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$RUN_SA" --role="roles/cloudsql.client"
```

- [ ] **Step 2: SA de deploy do GitHub Actions**

```bash
gcloud iam service-accounts create github-deploy --display-name="GitHub Actions deploy"
export DEPLOY_SA="github-deploy@$PROJECT_ID.iam.gserviceaccount.com"
for ROLE in roles/run.admin roles/artifactregistry.writer roles/cloudsql.client roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$DEPLOY_SA" --role="$ROLE"
done
gcloud iam service-accounts add-iam-policy-binding $RUN_SA \
  --member="serviceAccount:$DEPLOY_SA" --role="roles/iam.serviceAccountUser"
```

- [ ] **Step 3: Verificar**

Run:
```bash
gcloud iam service-accounts list --format='value(email)' | grep -E 'bolao-run|github-deploy'
```
Expected: lista `bolao-run@...` e `github-deploy@...`.

---

## Task 11: Configurar Workload Identity Federation

**Files:** nenhum.

- [ ] **Step 1: Criar o pool e o provider OIDC restrito ao repo**

```bash
gcloud iam workload-identity-pools create github \
  --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global --workload-identity-pool=github \
  --display-name="GitHub provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${REPO}'"
```

- [ ] **Step 2: Permitir o repo assumir a SA de deploy**

```bash
gcloud iam service-accounts add-iam-policy-binding $DEPLOY_SA \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${REPO}"
```

- [ ] **Step 3: Capturar o WIF_PROVIDER (vai para o GitHub no Task 16)**

```bash
export WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/github-provider"
echo "WIF_PROVIDER=$WIF_PROVIDER"
echo "DEPLOY_SA=$DEPLOY_SA"
```

- [ ] **Step 4: Verificar**

Run:
```bash
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global --workload-identity-pool=github \
  --format='value(attributeCondition)'
```
Expected: `assertion.repository=='<owner>/bolao-trovao'` (o seu repo). Anote `WIF_PROVIDER` e `DEPLOY_SA`.

---

## Task 12: Primeiro deploy manual (validação)

**Files:** nenhum (usa os Dockerfiles existentes).

- [ ] **Step 1: Autenticar o Docker no Artifact Registry**

```bash
gcloud auth configure-docker $REGION-docker.pkg.dev --quiet
```

- [ ] **Step 2: Build e push das imagens**

```bash
docker build -f apps/backend/Dockerfile -t $IMAGE_BASE/backend:bootstrap .
docker push $IMAGE_BASE/backend:bootstrap
docker build -f apps/frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.bolaotrovao.com \
  -t $IMAGE_BASE/frontend:bootstrap .
docker push $IMAGE_BASE/frontend:bootstrap
```

- [ ] **Step 3: Deploy do backend (fixa toda a config — env vars + secrets)**

```bash
gcloud run deploy bolao-backend \
  --image=$IMAGE_BASE/backend:bootstrap \
  --region=$REGION --platform=managed \
  --service-account=$RUN_SA \
  --min-instances=1 --no-cpu-throttling --cpu=1 --memory=512Mi \
  --allow-unauthenticated \
  --add-cloudsql-instances=$SQL_CONN \
  --network=default --subnet=default --vpc-egress=private-ranges-only \
  --set-env-vars=NODE_ENV=production,PORT=3001,APP_URL=https://bolaotrovao.com,GOOGLE_CALLBACK_URL=https://api.bolaotrovao.com/auth/google/callback,JWT_EXPIRES_IN=15m,JWT_REFRESH_EXPIRES_IN=30d,SMTP_HOST=smtp.gmail.com,SMTP_PORT=587,"SMTP_FROM=Bolão Trovão <noreply@bolaotrovao.com>",VAPID_MAILTO=mailto:admin@bolaotrovao.com \
  --set-secrets=JWT_SECRET=JWT_SECRET:latest,JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest,DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,SMTP_USER=SMTP_USER:latest,SMTP_PASS=SMTP_PASS:latest,VAPID_PUBLIC_KEY=VAPID_PUBLIC_KEY:latest,VAPID_PRIVATE_KEY=VAPID_PRIVATE_KEY:latest
```

- [ ] **Step 4: Deploy do frontend**

```bash
gcloud run deploy bolao-frontend \
  --image=$IMAGE_BASE/frontend:bootstrap \
  --region=$REGION --platform=managed \
  --min-instances=1 --cpu=1 --memory=512Mi \
  --allow-unauthenticated \
  --set-env-vars=NODE_ENV=production
```

- [ ] **Step 5: Verificar que as migrations rodaram e o backend está saudável**

Run:
```bash
gcloud run services logs read bolao-backend --region=$REGION --limit=80 | grep -Ei 'migrat|Backend rodando|Nest application successfully started'
```
Expected: linhas indicando `prisma migrate deploy` aplicou as migrations e o Nest subiu (`Backend rodando...` / `Nest application successfully started`). **Sem** erros de conexão a Postgres ou Redis.

- [ ] **Step 6: Verificar resposta HTTP das URLs default do Cloud Run**

Run:
```bash
BACK_URL=$(gcloud run services describe bolao-backend --region=$REGION --format='value(status.url)')
FRONT_URL=$(gcloud run services describe bolao-frontend --region=$REGION --format='value(status.url)')
curl -s -o /dev/null -w "backend=%{http_code}\n" $BACK_URL/auth/inscricoes/status
curl -s -o /dev/null -w "frontend=%{http_code}\n" $FRONT_URL
```
Expected: `backend=200` (endpoint público que consulta o banco) e `frontend=200`. Se o backend não responder 200, revise os logs do Step 5 (provável Redis/DB).

---

## Task 13: Configurar Domain Mappings e DNS

**Files:** nenhum.

- [ ] **Step 1: Criar os mapeamentos de domínio**

```bash
gcloud run domain-mappings create --service=bolao-frontend --domain=bolaotrovao.com     --region=$REGION
gcloud run domain-mappings create --service=bolao-frontend --domain=www.bolaotrovao.com --region=$REGION
gcloud run domain-mappings create --service=bolao-backend  --domain=api.bolaotrovao.com --region=$REGION
```

- [ ] **Step 2: Adicionar os registros DNS na zona**

Cada comando do Step 1 imprime os registros a criar. Para `www` e `api` (CNAME):

```bash
gcloud dns record-sets create www.bolaotrovao.com. --zone=$DNS_ZONE --type=CNAME --ttl=3600 --rrdatas="ghs.googlehosted.com."
gcloud dns record-sets create api.bolaotrovao.com. --zone=$DNS_ZONE --type=CNAME --ttl=3600 --rrdatas="ghs.googlehosted.com."
```

Para o apex `bolaotrovao.com` (use os IPs **A/AAAA exatos** que o mapping mostrou):

```bash
# Exemplo — substitua pelos rrdatas exibidos no Step 1:
gcloud dns record-sets create bolaotrovao.com. --zone=$DNS_ZONE --type=A    --ttl=3600 --rrdatas="216.239.32.21,216.239.34.21,216.239.36.21,216.239.38.21"
gcloud dns record-sets create bolaotrovao.com. --zone=$DNS_ZONE --type=AAAA --ttl=3600 --rrdatas="2001:4860:4802:32::15,2001:4860:4802:34::15,2001:4860:4802:36::15,2001:4860:4802:38::15"
```

- [ ] **Step 3: Verificar provisionamento do certificado**

Run:
```bash
gcloud run domain-mappings describe --domain=api.bolaotrovao.com --region=$REGION \
  --format='value(status.conditions[].type, status.conditions[].status)'
```
Expected: eventualmente `CertificateProvisioned True` e `Ready True`. **Pode levar de minutos a ~24h na primeira vez** — reexecute periodicamente. Repita para `bolaotrovao.com` e `www.bolaotrovao.com`.

- [ ] **Step 4: Verificar HTTPS de ponta a ponta (após cert ativo)**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://bolaotrovao.com
curl -s -o /dev/null -w "%{http_code}\n" https://api.bolaotrovao.com/auth/inscricoes/status
```
Expected: `200` nos dois, com TLS válido (sem erro de certificado).

---

## Task 14: Rodar o seed da Copa (uma vez)

**Files:** nenhum (usa `apps/backend/prisma/seed.ts` existente).

- [ ] **Step 1: Subir o Cloud SQL Auth Proxy**

```bash
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.11.0/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy
./cloud-sql-proxy $SQL_CONN &
sleep 5
```

- [ ] **Step 2: Instalar deps, gerar client e rodar o seed**

```bash
pnpm install --frozen-lockfile
pnpm --filter @bolao/backend exec prisma generate
DATABASE_URL="postgresql://bolao:${DB_PASSWORD}@localhost:5432/bolao_trovao?schema=public" \
  pnpm --filter @bolao/backend exec ts-node prisma/seed.ts
```

- [ ] **Step 3: Verificar e encerrar o proxy**

Run:
```bash
DATABASE_URL="postgresql://bolao:${DB_PASSWORD}@localhost:5432/bolao_trovao?schema=public" \
  pnpm --filter @bolao/backend exec prisma db execute --stdin <<< 'SELECT count(*) FROM "Jogo";'
kill %1
```
Expected: contagem de jogos > 0 (dados da Copa 2026 inseridos). Sem erro de conexão.

> O seed cria o admin padrão `admin@bolao.com` / `admin123`. Troque a senha no primeiro login (Task 17).

---

## Task 15: Criar o workflow de deploy automático

**Files:**
- Create: `.github/workflows/deploy.yml`

> **Esta é a única tarefa que altera o repositório** — um agente pode executá-la.

- [ ] **Step 1: Criar o arquivo do workflow**

Create `.github/workflows/deploy.yml`:

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
        run: |
          gcloud run deploy bolao-backend \
            --image=${{ vars.GCP_REGION }}-docker.pkg.dev/${{ vars.GCP_PROJECT_ID }}/bolao/backend:${{ github.sha }} \
            --region=${{ vars.GCP_REGION }} --quiet

      - name: Deploy frontend
        run: |
          gcloud run deploy bolao-frontend \
            --image=${{ vars.GCP_REGION }}-docker.pkg.dev/${{ vars.GCP_PROJECT_ID }}/bolao/frontend:${{ github.sha }} \
            --region=${{ vars.GCP_REGION }} --quiet
```

- [ ] **Step 2: Validar a sintaxe YAML localmente**

Run (no Cloud Shell ou local):
```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('YAML OK')"
```
Expected: `YAML OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: deploy automático para Cloud Run no merge à main"
```

> **Ainda não dê push para a `main`** — primeiro configure as variáveis e a branch protection no GitHub (Task 16). Faça via PR.

---

## Task 16: Configurar variáveis e branch protection no GitHub

**Files:** nenhum (configuração no GitHub).

- [ ] **Step 1: Criar as Actions Variables (não-secretas)**

GitHub → Settings → **Secrets and variables → Actions → aba Variables → New repository variable**:

| Nome | Valor |
|---|---|
| `GCP_PROJECT_ID` | `bolao-497903` |
| `GCP_REGION` | `us-central1` |
| `WIF_PROVIDER` | (valor de `echo $WIF_PROVIDER` do Task 11) |
| `DEPLOY_SA` | `github-deploy@bolao-497903.iam.gserviceaccount.com` |

- [ ] **Step 2: Ativar branch protection na `main`**

GitHub → Settings → **Branches → Add branch ruleset (ou rule)** para `main`:
- ☑ Require a pull request before merging
- ☑ Require status checks to pass before merging → adicione os checks `Lint`, `Unit Tests`, `E2E Tests` (do `ci.yml` existente)

- [ ] **Step 3: Verificar via PR**

Abra um PR com o commit do Task 15. Confirme que:
- Os checks do CI (`Lint`, `Unit Tests`, `E2E Tests`) rodam e são exigidos para o merge.
- Após o merge, a aba **Actions** mostra o workflow **Deploy** iniciando.

Expected: o job `Deploy` autentica via WIF (sem erro de credencial), builda, dá push e roda `gcloud run deploy` para os dois serviços com sucesso.

> Se o passo `auth` falhar com erro de permissão, revise o binding `workloadIdentityUser` (Task 11 Step 2) e se `REPO`/`attribute-condition` batem exatamente com `<owner>/<repo>`.

---

## Task 17: Smoke test de ponta a ponta

**Files:** nenhum.

- [ ] **Step 1: Frontend e HTTPS**

Abra `https://bolaotrovao.com` no navegador. Expected: a aplicação carrega com cadeado de HTTPS válido.

- [ ] **Step 2: Login admin + persistência de sessão**

Faça login com `admin@bolao.com` / `admin123`. Dê **F5**. Expected: continua logado (cookie de refresh `secure` persistiu). Em seguida, **troque a senha do admin**.

- [ ] **Step 3: Login com Google**

Clique em "Entrar com Google". Expected: redireciona ao Google, autentica e volta logado em `bolaotrovao.com`.

- [ ] **Step 4: Filas Bull (ranking)**

No painel admin, registre um placar final de uma partida. Depois:
```bash
gcloud run services logs read bolao-backend --region=$REGION --limit=50 | grep -i ranking
```
Expected: logs do `RankingProcessor` processando o job (prova de que o backend alcança o Redis na VM).

- [ ] **Step 5: E-mail transacional**

Na tela de login, use "Esqueci minha senha" com um e-mail válido. Expected: o e-mail de recuperação chega (via Gmail SMTP).

---

## Task 18: Atualizar README e configurar alerta de orçamento

**Files:**
- Modify: `README.md` (seção "Deploy em produção")

- [ ] **Step 1: Substituir a seção de deploy do README**

No `README.md`, substitua o conteúdo atual da seção **## Deploy em produção** (atualmente baseada em `docker-compose.prod.yml`) por uma descrição do fluxo real de produção:

```markdown
## Deploy em produção

Produção roda na **Google Cloud Platform** (projeto `bolao-497903`):

- **Frontend e backend** em Cloud Run (`bolao-frontend`, `bolao-backend`).
- **PostgreSQL** no Cloud SQL; **Redis** (filas Bull) numa VM e2-micro free-tier.
- **HTTPS** em `bolaotrovao.com` / `api.bolaotrovao.com` via Cloud Run Domain Mappings.
- **Segredos** no Secret Manager (nada no git).
- **Deploy automático**: todo merge na `main` dispara `.github/workflows/deploy.yml`,
  que builda as imagens, publica no Artifact Registry e roda `gcloud run deploy`.
  A autenticação usa Workload Identity Federation (sem chave JSON).

Setup completo e passo-a-passo: `docs/superpowers/specs/2026-05-30-deploy-gcp-cloud-run-design.md`.

> O `docker-compose.prod.yml` permanece no repo apenas para smoke test local do build de produção.
```

- [ ] **Step 2: Criar alerta de orçamento (Console)**

Console → **Billing → Budgets & alerts → Create budget**: escopo no projeto `bolao-497903`, valor **US$80/mês**, alertas em 50%/90%/100%.

- [ ] **Step 3: Commit do README**

```bash
git add README.md
git commit -m "docs: atualiza seção de deploy para o fluxo GCP Cloud Run"
```

Expected: commit criado. (Entra na `main` via PR, como qualquer mudança.)

---

## Self-Review (cobertura do spec)

| Seção do spec | Task(s) que implementa |
|---|---|
| §2 Região us-central1 | Task 1 |
| §6 Fase 1 APIs | Task 2 |
| §6 Fase 2 Domínio/DNS | Task 3 |
| §6 Fase 3 Cloud SQL | Task 4 |
| §6 Fase 4 VM Redis | Task 5 |
| §6 Fase 5 Firewall | Task 6 |
| §6 Fase 6 Artifact Registry | Task 7 |
| §6 Fase 7 OAuth produção | Task 8 |
| §6 Fase 8 Secret Manager | Task 9 |
| §6 Fase 9 SAs + IAM | Task 10 |
| §6 Fase 10 WIF | Task 11 |
| §6 Fase 11 Deploy manual | Task 12 |
| §6 Fase 12 Domain Mappings | Task 13 |
| §6 Fase 13 Seed | Task 14 |
| §6 Fase 14 Deploy automático | Tasks 15, 16 |
| §6 Fase 15 Smoke test | Task 17 |
| §7 Operação (orçamento/alerta) | Task 18 |
| §8 Checklist de segurança | Verificado ao longo (Tasks 6, 9, 11) |

Sem lacunas: toda seção do spec tem tarefa correspondente. A atualização do README (Task 18) atende à preferência registrada de manter o README sincronizado com mudanças de arquitetura.
</content>
