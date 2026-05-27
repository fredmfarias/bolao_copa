---
title: Dev Seed — População de Dados de Teste
date: 2026-05-27
status: aprovado
---

# Dev Seed — População de Dados de Teste

## Contexto

O seed base (`prisma/seed.ts`) cria a estrutura invariante do sistema: admin, Bolão Global, estádios, seleções e os 72 jogos da Copa 2026. O dev seed é um complemento para o ambiente de desenvolvimento local — limpa e recria usuários, bolões, membros e apostas com dados realistas suficientes para exercitar todas as telas do app.

## Arquivos e Scripts

**Arquivo novo:**
```
apps/backend/prisma/seed-dev.ts
```

**Scripts adicionados em `apps/backend/package.json`:**
```json
"db:seed:dev":  "dotenv -e ../../.env -- ts-node prisma/seed-dev.ts",
"db:dev:reset": "pnpm db:reset && pnpm db:seed:dev"
```

**Como executar (da raiz do monorepo):**

| Cenário | Comando |
|---|---|
| Reset completo — schema + base + dev | `pnpm --filter @bolao/backend db:dev:reset` |
| Só repopular (schema e base já existem) | `pnpm --filter @bolao/backend db:seed:dev` |

O script é idempotente: pode ser executado múltiplas vezes sem deixar dados duplicados.

## Dados Criados

### Usuários

52 usuários criados pelo seed-dev (o admin original do base seed é preservado intocado):

| Qtd | Role | emailVerificado | Senha |
|---|---|---|---|
| 4 | ADMIN | true | `Test@123` |
| 48 | USER | true | `Test@123` |

Todos os usuários têm `ativo: true` e `emailVerificado: true`.

### Bolões

6 bolões criados com `criadoPorId = ADMIN_ID`:

| # | Nome | Escopo | maxParticipantes | precoReais |
|---|---|---|---|---|
| 1 | Bolão dos Grupos A | GRUPOS | 20 | 10,00 |
| 2 | Bolão dos Grupos B | GRUPOS | 20 | 20,00 |
| 3 | Bolão Eliminatórias 1 | ELIMINATORIAS | 15 | 30,00 |
| 4 | Bolão Eliminatórias 2 | ELIMINATORIAS | 15 | 50,00 |
| 5 | Bolão Completo Alpha | AMBOS | 25 | 0,00 |
| 6 | Bolão Completo Beta | AMBOS | 25 | 15,00 |

Todos com `status: ATIVO`.

### Distribuição de Membros

Para cada bolão, são sorteados aleatoriamente 12 usuários do pool de 52. Um usuário pode aparecer em múltiplos bolões. A constraint `@@unique([bolaoId, usuarioId])` garante sem duplicatas dentro do mesmo bolão.

- Primeiro usuário sorteado para cada bolão → `papel: MODERADOR`
- Demais → `papel: PARTICIPANTE`

Total esperado: ~72 registros em `BolaoMembro`.

### Jogos com Datas Ajustadas

O script seleciona os 8 primeiros jogos ordenados por `dataHora ASC` e reescreve suas datas de forma relativa ao momento de execução:

| Jogo | Nova dataHora | Estado no app |
|---|---|---|
| jogo[0] | `now − 3 dias` | Aposta encerrada |
| jogo[1] | `now − 2 dias` | Aposta encerrada |
| jogo[2] | `now − 1 dia` | Aposta encerrada |
| jogo[3] | `now − 6 horas` | Aposta encerrada |
| jogo[4] | `now − 1 hora` | Aposta encerrada |
| jogo[5] | `now + 10 minutos` | Encerrando em breve |
| jogo[6] | `now + 20 minutos` | Encerrando em breve |
| jogo[7] | `now + 2h15min` | Ainda aberta (próxima) |

Os 64 jogos restantes ficam com as datas originais da Copa 2026 (todos futuros).

Nenhum jogo recebe `placarCasa` ou `placarVisitante`.

### Apostas

Cada um dos 52 usuários recebe apostas em 20 jogos:
- Os 8 jogos com datas ajustadas (5 passados + 3 próximos)
- Os 12 primeiros jogos futuros da Copa 2026 (pelo índice após os 8)

Placar de cada aposta: inteiros aleatórios de 0 a 4 para casa e visitante.

Constraint `@@unique([usuarioId, jogoId])` garante que, mesmo com execuções repetidas após a limpeza, não haverá duplicatas.

Total: **1.040 apostas** (52 × 20).

### Rankings e Publicações

Nenhum `Ranking`, `RankingSnapshot` ou `Publicacao` é criado. Rankings serão calculados naturalmente pelo sistema conforme jogos forem processados.

## Ordem de Execução Interna

```
1. LIMPEZA (ordem inversa das dependências FK)
   ├── aposta.deleteMany()
   ├── rankingSnapshot.deleteMany()
   ├── ranking.deleteMany()
   ├── bolaoConvite.deleteMany()
   ├── bolaoMembro.deleteMany()
   ├── bolao.deleteMany({ where: { id: { not: BOLAO_GLOBAL_ID } } })
   └── usuario.deleteMany({ where: { id: { not: ADMIN_ID } } })

2. AJUSTE DE DATAS DOS JOGOS
   └── jogo.update() nos 8 primeiros jogos com datas relativas a Date.now()

3. CRIAÇÃO DE USUÁRIOS
   └── usuario.createMany() — 52 usuários, senhaHash de "Test@123"

4. CRIAÇÃO DE BOLÕES
   └── bolao.createMany() — 6 bolões

5. DISTRIBUIÇÃO DE MEMBROS
   └── para cada bolão: sortear 12 do pool de 52 → bolaoMembro.createMany()

6. CRIAÇÃO DE APOSTAS
   └── para cada usuário × 20 jogos alvo → aposta.createMany()
       (lotes de 10 usuários via Promise.all para não sobrecarregar)
```

## Log de Saída Esperado

```
✓ Limpeza concluída
✓ 8 jogos com datas ajustadas
✓ 52 usuários criados
✓ 6 bolões criados
✓ ~72 membros distribuídos (6 moderadores + participantes com sobreposição)
✓ 1.040 apostas criadas (52 usuários × 20 jogos)
Seed dev concluído.
```
