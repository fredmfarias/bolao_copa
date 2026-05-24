# Frontend Maduro — Bolão Trovão

**Data:** 2026-05-23  
**Status:** aprovado  
**Projeto:** `apps/frontend` (monorepo `bolao-trovao`)  
**Contexto:** A reescrita Next.js 14 gerou um frontend funcional mas raso. Esta especificação define a evolução completa para recuperar todas as funcionalidades do legado JSF/PrimeFaces, adicionando as melhorias de UX e a nova arquitetura de múltiplos bolões.

---

## Decisões de alto nível

| Decisão | Escolha | Razão |
|---|---|---|
| Dispositivo prioritário | Mobile first | Uso intenso durante torneios, pelo celular |
| Biblioteca de componentes | shadcn/ui + Tailwind | Zero lock-in, integração perfeita, acelera componentes complexos |
| Estratégia de implementação | Por camadas | Cada camada é deployável; fundação evita retrabalho |
| Convite para bolão | Link/código compartilhável | Sem fricção, funciona fora do app (WhatsApp) |
| Ranking | Workflow draft/publish | Admin publica após o último jogo do dia; usuários veem variações em relação ao ranking anterior |
| Direção visual | Cartola FC — dark green + gold | Identidade esportiva premium, dark mode first |

---

## Sistema visual

### Paleta de cores (tokens Tailwind)

```
--color-base:        #071A0E   ← fundo da página
--color-card:        #0D2A1C   ← fundo de cards
--color-card-hover:  #0D3321   ← hover / expandido
--color-surface:     #0A2015   ← superfície alternativa
--color-border:      #1B5E20   ← bordas padrão
--color-border-mid:  #2E7D32   ← bordas hover / ativas
--color-green-mid:   #4CAF50   ← texto secundário
--color-green-light: #69F0AE   ← accent / texto destaque
--color-gold:        #FFD600   ← CTA principal / pontuação / 1º lugar
--color-gold-dark:   #F9A825   ← gradiente do CTA
--color-text:        #E8F5E9   ← texto principal
--color-muted:       #4CAF50   ← texto secundário
--color-subtle:      #2E7D32   ← texto sutil / placeholders
--color-error:       #F44336   ← erros / aposta incompleta
--color-warning:     #F59E0B   ← avisos
```

### Componentes visuais base

- **Card padrão**: fundo `card`, borda `border`, `rounded-xl`, faixa gradiente dourada/verde no topo (2px)
- **CTA primário**: gradiente `gold → gold-dark`, texto preto, `font-extrabold`, `rounded-xl`
- **Botão secundário**: fundo transparente, borda `border-mid`, texto `green-mid`
- **Badge de estado**: pill colorido — verde (salvo), vermelho (incompleto), cinza (fechado/neutro)
- **Chip de filtro ativo**: fundo `gold`, texto preto; inativo: fundo `card`, borda `border`

### Tipografia

- Headings: `font-extrabold`, cor `text` ou `gold`
- Labels de seção: `text-xs uppercase tracking-widest`, cor `green-mid`
- Texto secundário: `text-xs`, cor `muted`
- Pontuação/placar: `text-2xl font-extrabold`, cor `gold`

---

## Arquitetura de rotas

```
/                              → redirect /jogos

/convite/[codigo]              → público · landing de convite

/(auth)/
  login/
  registrar/
  esqueceu-senha/
  nova-senha/
  confirmar-email/

/(app)/                        → requer auth · layout com BottomNav
  jogos/                       → lista de jogos + apostas (bolão global)
  boloes/
    novo/
    [id]/                      → detalhe do bolão + jogos
      convidar/                → NOVO · só moderador
  ranking/[bolaoId]/           → ranking publicado
  palpites/[jogoId]/           → NOVO · todos os palpites de um jogo
  perfil/

/(admin)/                      → requer role ADMIN · layout com AdminTopNav
  placares/
  ranking/
  usuarios/
```

---

## Camada 1 — Fundação

**O que é:** infraestrutura visual e padrões que todas as camadas seguintes dependem.

### shadcn/ui — componentes a instalar

```bash
npx shadcn@latest add dialog sheet toast tabs accordion badge avatar separator skeleton
```

- **Dialog**: modal para apostas de outro usuário, legenda, confirmações
- **Sheet**: drawer mobile de aposta (desliza de baixo)
- **Toast** (Sonner): confirmação de auto-save, erros, publicação do ranking
- **Tabs**: navegação interna em telas admin
- **Accordion**: expansão de linha no ranking (stats detalhados)
- **Badge**: status de jogo, tipo de acerto, estado da aposta
- **Skeleton**: loading state de todas as listas
- **Avatar**: foto de usuário no ranking e perfil

### Componentes próprios

| Componente | Descrição |
|---|---|
| `SelecaoAvatar` | Bandeira SVG (do campo `bandeiraSvg`) + nome da seleção. Fallback: emoji do código ISO. Tamanhos: `sm` / `md` / `lg` |
| `BottomNav` | Barra de navegação inferior mobile com 4 ítens: Jogos / Bolões / Ranking / Perfil. Item ativo em dourado |
| `AdminTopNav` | Tabs horizontais no topo da área admin: Placares / Ranking / Usuários. Cor roxa para distinguir do app |
| `PageSkeleton` | Grid de cards com animação pulse, usado enquanto dados carregam |
| `EmptyState` | Ícone + mensagem + CTA opcional. Ex: "Nenhum jogo encontrado" |
| `ScoreDisplay` | Placar numérico grande com separador "×". Variantes: `live` (dourado), `final` (branco), `pending` (cinza) |

### Hooks

| Hook | Comportamento |
|---|---|
| `useAutoSave(fn, deps, delay = 800)` | Debounce de 800ms → chama `fn` → emite toast "Salvo" discreto. Retorna `{ status: 'idle' \| 'saving' \| 'saved' \| 'error' }` |
| `useAdmin()` | Lê `user.role` do AuthProvider. Retorna `{ isAdmin: boolean }` |
| `useModerador(bolaoId)` | Verifica se o usuário é MODERADOR do bolão informado |

### Tailwind config

Adicionar os tokens de cor como extensão de tema em `tailwind.config.ts`:

```ts
colors: {
  base: '#071A0E',
  card: '#0D2A1C',
  'card-hover': '#0D3321',
  surface: '#0A2015',
  border: { DEFAULT: '#1B5E20', mid: '#2E7D32' },
  green: { mid: '#4CAF50', light: '#69F0AE' },
  gold: { DEFAULT: '#FFD600', dark: '#F9A825' },
}
```

Atualizar `globals.css`: `background: #071A0E`, `color: #E8F5E9`.

---

## Camada 2 — Apostas

**Tela:** `/jogos` e `/boloes/[id]`

### JogoCard (redesenho)

Estrutura visual do card:
- Faixa de 2px no topo: gradiente dourado/verde (estado normal), vermelho (incompleta), cinza (fechada)
- Linha de metadados: `Grupo A · Rodada 1` à esquerda, `12/06 (Qui) 14:00` à direita
- Confronto: `SelecaoAvatar (lg)` casa — `ScoreDisplay` central — `SelecaoAvatar (lg)` visitante
- Rodapé do card: estádio em texto sutil (`🏟 Estádio Lusail`)
- Badge de aposta: `Sua aposta: 2 × 0 · ✓ salvo 13:47` (verde) ou `⚠ Incompleta` (vermelho)
- Botão: `APOSTAR` / `EDITAR APOSTA` (CTA dourado) ou ausente quando fechado

**Três estados visuais obrigatórios:**

| Estado | Indicador visual |
|---|---|
| Aberto sem aposta | Faixa verde, badge ausente, botão "APOSTAR" |
| Aposta salva | Faixa verde, badge verde com placar e timestamp |
| Incompleta (um lado vazio) | Faixa vermelha, badge vermelho `⚠ Incompleta` |
| Prazo encerrado | Faixa cinza, card com `opacity-50`, ícone 🔒, sem botão |

### Lista de jogos

- **Agrupamento por data**: cada data é um header com ponto dourado `● Quinta-feira, 12/06`
- **Filtros em chips** (scroll horizontal): Todos / Grupos / Oitavas / Quartas / Semis / Final
- **Ordenação**: por data/hora crescente dentro de cada grupo
- **Paginação**: não necessária — lista por data filtra naturalmente o volume

### Drawer de aposta (Sheet mobile)

Ao clicar "APOSTAR" ou "EDITAR APOSTA":
- Abre `Sheet` do shadcn ancorado na base da tela
- Handle visual (barra cinza) no topo do drawer
- Nome das seleções com bandeiras, estádio e hora
- **Steppers** `−` / valor / `+` para cada time (valores 0–99)
- Auto-save via `useAutoSave`: debounce 800ms → `PATCH /apostas/:id` ou `POST /apostas` → toast discreto
- Texto de status: `✓ Salvo automaticamente` em verde-light
- Botão "Fechar" (secundário)
- **Sem botão "Confirmar"** — a aposta salva automaticamente

### Lógica de aposta incompleta

Uma aposta é "incompleta" quando exatamente um dos campos (casa ou visitante) está preenchido e o outro está em branco/nulo. O backend deve rejeitar apostas incompletas — o frontend exibe o badge mas não bloqueia o fechamento do drawer.

---

## Camada 3 — Ranking

**Telas:** `/ranking/[bolaoId]` e `/palpites/[jogoId]`

### Ranking publicado

**Pódio visual (top 3):**
- Layout de 3 colunas com alturas diferentes: 2º (esquerda, menor) / 1º (centro, maior, borda dourada) / 3º (direita, menor)
- Cada posição: avatar, nome, pontuação, variação (▲▼—)
- 1º lugar: borda `border-2 border-gold`, fundo com leve gradiente dourado

**Lista (4º em diante):**
- Cada linha: `posição · variação · nome · pontuação · chevron ›`
- Linha do usuário logado: fundo `gold/10`, borda `gold/50`, nome em dourado
- Clique em qualquer linha → abre `Dialog` com apostas daquele usuário

**Accordion de stats (ao clicar `›`):**
Grid 3×2 dentro do Accordion com os 6 tipos de acerto:

| Cor | Tipo | Descrição |
|---|---|---|
| `green-light` | Exato | Placar correto — maior pontuação |
| `blue-400` | Vencedor+ | Acertou gols do vencedor |
| `purple-400` | Empate | Acertou o empate |
| `amber-400` | Perdedor+ | Acertou gols do perdedor |
| `orange-400` | Ganhador | Acertou só quem ganhou |
| `gray-500` | Zerou | Errou tudo — 0 pts |

**Legenda:** `Dialog` aberto pelo botão `? Legenda` explicando cada tipo de acerto com suas cores.

**Variação de posição:**
- ▲N em `green-light` — subiu N posições vs ranking anterior publicado
- ▼N em `error` — desceu N posições
- — em `muted` — sem variação

### Estado "aguardando publicação"

Quando `bolao.rankingStatus === 'DRAFT'` (ranking ainda não publicado para o dia):
- Tela de espera com ⏳, texto explicativo
- Card mostrando dados do último ranking publicado ("Você estava em 2º lugar")
- Sem tabela de ranking — não expõe dados parciais para usuários

### Dialog: apostas de outro usuário

Abre ao clicar em qualquer linha do ranking:
- Nome e posição no cabeçalho
- Lista de apostas com: `SelecaoAvatar` casa e visitante, placar apostado, resultado real, tipo de acerto colorido e pontos ganhos
- Botão "Fechar"

### Tela: Todos os palpites (`/palpites/[jogoId]`)

- Dropdown (ou chips) para selecionar o jogo
- Resultado real do jogo (se disponível) em destaque
- Palpites agrupados por placar apostado, ordenados por: exato primeiro, depois vencedor, etc.
- Para cada grupo: quantas pessoas apostaram + lista de nomes com posição no ranking
- Acessível pelo menu "Jogos" → ícone de "olho" em cada card fechado

---

## Camada 4 — Admin

**Rotas:** `/(admin)/placares`, `/(admin)/ranking`, `/(admin)/usuarios`

### Layout admin

- Route group `/(admin)/` com `layout.tsx` próprio
- `AdminTopNav`: 3 tabs no topo com cor roxa/índigo para distinguir da área do usuário
- Link "← Voltar ao app" no header
- Guard: redireciona para `/jogos` se `user.role !== 'ADMIN'`
- Link de acesso: discreto na página `/perfil` para usuários admin

### Placares (`/(admin)/placares`)

**Filtro por data:** chips horizontais com os dias do torneio. Padrão: hoje.

**Card de jogo:**
- Metadados: seleções, hora
- Steppers `−` / `+` para placar casa e visitante (0–99)
- Botão `💾 Salvar placar` — chama `PATCH /jogos/:id` com os placares
- Após salvar: card muda para estado "salvo" (fundo verde escuro, placar em verde, botão "Corrigir placar")
- Jogos futuros (hora > agora): card em estado "pendente" (tracejado, sem interação)

**Comportamento pós-save:** backend deve automaticamente recalcular pontuações das apostas daquele jogo (já implementado em `RankingService.recalcularParaJogo`), mas **não publicar o ranking**.

### Ranking admin (`/(admin)/ranking`)

**Painel de status do dia:**
- Lista de jogos do dia com badge: `✓ placar salvo` (verde) ou `⏳ pendente` (amarelo)
- Aviso se houver jogos sem placar: `⚠ Aguardando N jogo(s) para publicar`

**Preview do ranking (draft):**
- Tabela com posição, variação, nome, pontuação total e delta (`+25` pontos ganhos no dia)
- Dados calculados em tempo real a partir das apostas, mas **não visível para usuários**

**Botão "Publicar ranking":**
- Desabilitado enquanto houver jogos do dia sem placar
- Ao clicar: `POST /admin/ranking/publicar` → snapshot salvo no backend → ranking torna-se visível para usuários com variações calculadas vs snapshot anterior
- Após publicação: toast de sucesso, botão muda para "✓ Publicado hoje às HH:mm"

**Requisito de backend associado:** endpoint `POST /admin/ranking/publicar` que:
1. Salva snapshot do ranking atual como "publicado"
2. Calcula `posicoesGanhas` comparando com snapshot anterior
3. Atualiza `bolao.rankingStatus = 'PUBLISHED'`

### Usuários (`/(admin)/usuarios`)

- Campo de busca por nome (debounce)
- Lista com: nome, e-mail, toggle "Ativo", toggle "Pago", botão "Reset senha"
- Cada toggle faz `PATCH /admin/usuarios/:id` imediatamente (sem botão confirmar)
- "Reset senha" envia e-mail de redefinição via `POST /admin/usuarios/:id/reset-senha`
- Contadores no topo: total / ativos / pagos

---

## Camada 5 — Bolão e Convite

### Painel do moderador (em `/boloes/[id]`)

Visível apenas para quem é `MODERADOR` do bolão (via `useModerador`):
- Stats do bolão em grid 3 colunas: membros atuais / máximo / valor (R$)
- Lista de membros com chip "★ Você" para o moderador
- Botões: `🔗 Convidar` (dourado) e `🏆 Ver ranking`
- Badge de papel do moderador no rodapé do card

### Página de convite (`/boloes/[id]/convidar`)

Acessível somente pelo moderador. Chama `POST /boloes/:id/convite` para gerar/obter código.

**Estado com link ativo:**
- Exibe URL completa: `bolao.app/convite/[codigo]`
- Prazo de validade (7 dias por padrão, exibido como "expira em DD/MM")
- Botão `📋 Copiar link` (usa Clipboard API)
- Botão `📱 WhatsApp` (abre `https://wa.me/?text=...` com URL codificada)
- Botão `🔄 Novo link` — gera novo código, invalida o anterior
- Botão `🚫 Desativar link` — revoga o convite ativo

### Landing pública (`/convite/[codigo]`)

Rota pública (sem auth). Chama `GET /convites/:codigo` para carregar dados do bolão.

**Três cenários:**

| Cenário | Comportamento |
|---|---|
| Não autenticado | Exibe card do bolão + botões "Criar conta e entrar" / "Já tenho conta". Após auth, redireciona de volta e entra automaticamente |
| Autenticado, não membro | Exibe card do bolão + botão "ENTRAR NO BOLÃO" → `POST /convites/:codigo/aceitar` → redirect para `/boloes/:id` |
| Autenticado, já membro | Exibe mensagem "Você já participa deste bolão" + botão "Ir para o bolão →" |

**Estados de erro:**
- Bolão cheio (membros == máximo): mensagem explicativa, sem CTA de entrada
- Convite expirado: mensagem + orientação para pedir novo link ao moderador
- Código inválido: 404 com link para criar conta / explorar bolões

**Redirect pós-auth:**
O link de convite deve ser preservado na sessão durante o fluxo de registro/login. Usar `?redirect=/convite/[codigo]` no redirect para auth, e o callback de auth deve verificar e redirecionar.

### Requisitos de backend para convite

| Endpoint | Descrição |
|---|---|
| `POST /boloes/:id/convite` | Cria ou retorna convite ativo. Gera código único de 6 chars, TTL 7 dias |
| `DELETE /boloes/:id/convite` | Revoga o convite ativo |
| `GET /convites/:codigo` | Retorna dados do bolão + status (válido/expirado/cheio). Público |
| `POST /convites/:codigo/aceitar` | Usuário autenticado entra no bolão. Valida código, prazo e vagas |

---

## Requisitos de backend adicionais

Esta especificação depende de endpoints que ainda não existem ou precisam de extensão:

| Endpoint | Status | Camada |
|---|---|---|
| `PATCH /jogos/:id` (placar) | Existe parcialmente | 4 |
| `POST /admin/ranking/publicar` | Não existe | 4 |
| `GET /boloes/:id/ranking` filtrado por `status: PUBLISHED` | Existe, mas sem variação | 3 |
| Campo `posicoesGanhas` em `Ranking` | Não existe | 3 |
| Campo `rankingStatus` em `Bolao` | Não existe | 3/4 |
| `GET /palpites?jogoId=` | Não existe | 3 |
| `POST /boloes/:id/convite` | Não existe | 5 |
| `GET /convites/:codigo` | Não existe | 5 |
| `POST /convites/:codigo/aceitar` | Não existe | 5 |
| `PATCH /admin/usuarios/:id` | Não existe | 4 |
| `POST /admin/usuarios/:id/reset-senha` | Não existe | 4 |

---

## Inventário de componentes novos/modificados

### Novos
- `BottomNav` — navegação mobile
- `AdminTopNav` — tabs admin
- `SelecaoAvatar` — bandeira + nome
- `ScoreDisplay` — placar numérico
- `JogoCard` (reescrita) — card completo com estados
- `ApostaDrawer` — Sheet com steppers
- `RankingPodium` — top 3 visual
- `RankingRow` — linha com accordion de stats
- `ApostasDialog` — modal de apostas de outro usuário
- `PalpitesPage` — todos os palpites de um jogo
- `AdminPlacardCard` — card de placar para admin
- `AdminRankingPreview` — tabela draft + botão publicar
- `ConvitePanel` — gestão de link pelo moderador
- `ConviteLanding` — landing pública
- `PageSkeleton` — loading state genérico
- `EmptyState` — estado vazio genérico

### Modificados
- `NavBar` → substituído por `BottomNav` + header compacto
- `RankingTable` → substituído por `RankingPodium` + `RankingRow`
- `ApostaForm` → substituído por `ApostaDrawer`
- `AuthProvider` → adicionar suporte a `redirect` pós-login

---

## Fora de escopo

- Notificações push / e-mail de apostas
- Gráfico de evolução de posição no ranking (mencionado no legado — adiado)
- Histórico de rankings anteriores além do "último publicado"
- Upload direto de avatar (permanece como URL externa)
- Modo escuro/claro alternável (dark mode fixo)
