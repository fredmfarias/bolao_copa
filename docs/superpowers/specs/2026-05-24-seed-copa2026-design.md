# Spec: Atualização do Seed Copa 2026 com dados da API Globo Esporte

**Data:** 2026-05-24  
**Escopo:** `apps/backend/prisma/seed.ts` + arquivos SVG de bandeiras

---

## Contexto

O seed atual contém estádios, seleções e grupos **provisórios** (sorteio ainda não refletido). Não há jogos seeded. A API da Globo Esporte expõe os 72 jogos da fase de grupos com dados reais de time, estádio, data e hora.

**Fonte de dados:**
```
GET https://api.globoesporte.globo.com/tabela/b5ff9c28-476e-4816-a699-7645acc94cd0
    /fase/fase-de-grupos-copa-do-mundo-2026
    /rodada/{1|2|3}
    /grupo/{5811..5822}
    /jogos/
```
- Grupos A–L = códigos 5811–5822
- 3 rodadas, 2 jogos por grupo por rodada = **72 jogos no total**

---

## O que muda

| Tabela | Antes | Depois |
|--------|-------|--------|
| `estadio` | 16 estádios com nomes oficiais (`MetLife Stadium`, etc.) | 16 estádios com nomes da API (`Nova Jersey`, etc.) |
| `selecao` | 48 times com grupos errados e siglas FIFA (`GER`, `NED`…) | 48 times com grupos corretos e siglas da API (`ALE`, `HOL`…) |
| `jogo` | Nenhum jogo | 72 jogos da fase de grupos |
| Flags SVG | Nomeados com código FIFA | Renomeados para código API (23 arquivos) |

---

## Arquitetura da solução

**Arquivo único:** tudo em `apps/backend/prisma/seed.ts`, seguindo o padrão existente.  
**Dados:** hardcoded (não chama a API em runtime).

### Ordem de execução no `main()`

```
1. [existente] upsert usuário admin
2. [existente] upsert bolão global
3. [existente] upsert configurações de pontuação
4. [NOVO] deleteMany apostas
5. [NOVO] deleteMany jogos
6. [NOVO] deleteMany seleções
7. [NOVO] deleteMany estádios
8. [NOVO] createMany estádios  → captura map { nome → id }
9. [NOVO] createMany seleções  → captura map { codigo → id }
10.[NOVO] createMany jogos     → usa os dois maps acima
```

Os deletes nas linhas 4–7 garantem idempotência mesmo com mudança de chave única (`codigo`).

---

## Estádios (16)

Usam `sede.nome_popular` da API como campo `nome`. Cidades e países preenchidos manualmente.

| nome | cidade | pais |
|------|--------|------|
| Azteca | Cidade do México | México |
| Akron | Guadalajara | México |
| El Gigante de Acero | Monterrey | México |
| Toronto Field | Toronto | Canadá |
| Vancouver Place | Vancouver | Canadá |
| Nova Jersey | East Rutherford | EUA |
| Los Angeles | Los Angeles | EUA |
| Santa Clara | Santa Clara | EUA |
| Dallas | Dallas | EUA |
| Houston | Houston | EUA |
| Miami | Miami | EUA |
| Atlanta | Atlanta | EUA |
| Seattle Field | Seattle | EUA |
| Filadélfia | Filadélfia | EUA |
| Boston | Boston | EUA |
| Kansas City | Kansas City | EUA |

---

## Seleções (48)

Campo `codigo` usa a sigla da API. Campo `bandeiraSvg` usa `/flags/<codigo>.svg` (consistente após renomear os SVGs).

| Grupo | Times (codigo) |
|-------|----------------|
| A | MEX, AFS, COR, TCH |
| B | CAN, BOS, CAT, SUI |
| C | BRA, MAR, HAI, ESC |
| D | EUA, PAR, AUS, TUR |
| E | ALE, CUR, CDM, EQU |
| F | HOL, JAP, SUE, TUN |
| G | BEL, EGI, IRA, NZE |
| H | ESP, CAB, ARS, URU |
| I | FRA, SEN, IRQ, NOR |
| J | ARG, AGL, AUT, JOR |
| K | POR, RDC, UZB, COL |
| L | ING, CRO, GAN, PAN |

---

## Renomeação de bandeiras SVG (23 arquivos)

Arquivos em `apps/frontend/public/flags/`:

| Arquivo atual (FIFA) | Arquivo novo (API) |
|---------------------|--------------------|
| ALG.svg | AGL.svg |
| BIH.svg | BOS.svg |
| CIV.svg | CDM.svg |
| COD.svg | RDC.svg |
| CPV.svg | CAB.svg |
| CUW.svg | CUR.svg |
| CZE.svg | TCH.svg |
| ECU.svg | EQU.svg |
| EGY.svg | EGI.svg |
| ENG.svg | ING.svg |
| GER.svg | ALE.svg |
| GHA.svg | GAN.svg |
| IRN.svg | IRA.svg |
| JPN.svg | JAP.svg |
| KOR.svg | COR.svg |
| KSA.svg | ARS.svg |
| NED.svg | HOL.svg |
| NZL.svg | NZE.svg |
| QAT.svg | CAT.svg |
| RSA.svg | AFS.svg |
| SCO.svg | ESC.svg |
| SWE.svg | SUE.svg |
| USA.svg | EUA.svg |

Os 25 arquivos restantes (BRA, MEX, CAN, ARG, FRA, SEN, ESP, POR, BEL, AUS, COL, TUR, IRQ, NOR, JOR, AUT, UZB, TUN, PAR, PAN, CRO, SUI, MAR, HAI, URU) não precisam de renomeação.

---

## Jogos (72)

Todos com `fase: GRUPOS`, `pesoPontuacao: 1`, `placarCasa: null`, `placarVisitante: null`.

Referências resolvidas em runtime do seed via maps construídos após createMany:
- `selecaoCasaId` = `selecaoMap[mandante.sigla]`
- `selecaoVisitanteId` = `selecaoMap[visitante.sigla]`
- `estadioId` = `estadioMap[sede.nome_popular]`

### Rodada 1 (24 jogos)

| dataHora | casa | visitante | estadio | grupo |
|----------|------|-----------|---------|-------|
| 2026-06-11T16:00 | MEX | AFS | Azteca | A |
| 2026-06-11T23:00 | COR | TCH | Akron | A |
| 2026-06-12T16:00 | CAN | BOS | Toronto Field | B |
| 2026-06-12T22:00 | EUA | PAR | Los Angeles | D |
| 2026-06-13T16:00 | CAT | SUI | Santa Clara | B |
| 2026-06-13T19:00 | BRA | MAR | Nova Jersey | C |
| 2026-06-13T22:00 | HAI | ESC | Boston | C |
| 2026-06-14T01:00 | AUS | TUR | Vancouver Place | D |
| 2026-06-14T14:00 | ALE | CUR | Houston | E |
| 2026-06-14T17:00 | HOL | JAP | Dallas | F |
| 2026-06-14T20:00 | CDM | EQU | Filadélfia | E |
| 2026-06-14T23:00 | SUE | TUN | El Gigante de Acero | F |
| 2026-06-15T13:00 | ESP | CAB | Atlanta | H |
| 2026-06-15T16:00 | BEL | EGI | Seattle Field | G |
| 2026-06-15T19:00 | ARS | URU | Miami | H |
| 2026-06-15T22:00 | IRA | NZE | Los Angeles | G |
| 2026-06-16T16:00 | FRA | SEN | Nova Jersey | I |
| 2026-06-16T19:00 | IRQ | NOR | Boston | I |
| 2026-06-16T22:00 | ARG | AGL | Kansas City | J |
| 2026-06-17T01:00 | AUT | JOR | Santa Clara | J |
| 2026-06-17T14:00 | POR | RDC | Houston | K |
| 2026-06-17T17:00 | ING | CRO | Dallas | L |
| 2026-06-17T20:00 | GAN | PAN | Toronto Field | L |
| 2026-06-17T23:00 | UZB | COL | Azteca | K |

### Rodada 2 (24 jogos)

| dataHora | casa | visitante | estadio | grupo |
|----------|------|-----------|---------|-------|
| 2026-06-18T13:00 | TCH | AFS | Atlanta | A |
| 2026-06-18T16:00 | SUI | BOS | Los Angeles | B |
| 2026-06-18T19:00 | CAN | CAT | Vancouver Place | B |
| 2026-06-18T22:00 | MEX | COR | Akron | A |
| 2026-06-19T16:00 | EUA | AUS | Seattle Field | D |
| 2026-06-19T19:00 | ESC | MAR | Boston | C |
| 2026-06-19T21:30 | BRA | HAI | Filadélfia | C |
| 2026-06-20T01:00 | TUR | PAR | Santa Clara | D |
| 2026-06-20T14:00 | HOL | SUE | Houston | F |
| 2026-06-20T17:00 | ALE | CDM | Toronto Field | E |
| 2026-06-20T21:00 | EQU | CUR | Kansas City | E |
| 2026-06-21T01:00 | TUN | JAP | El Gigante de Acero | F |
| 2026-06-21T13:00 | ESP | ARS | Atlanta | H |
| 2026-06-21T16:00 | BEL | IRA | Los Angeles | G |
| 2026-06-21T19:00 | URU | CAB | Miami | H |
| 2026-06-21T22:00 | NZE | EGI | Vancouver Place | G |
| 2026-06-22T14:00 | ARG | AUT | Dallas | J |
| 2026-06-22T18:00 | FRA | IRQ | Filadélfia | I |
| 2026-06-22T21:00 | NOR | SEN | Nova Jersey | I |
| 2026-06-23T00:00 | JOR | AGL | Santa Clara | J |
| 2026-06-23T14:00 | POR | UZB | Houston | K |
| 2026-06-23T17:00 | ING | GAN | Boston | L |
| 2026-06-23T20:00 | PAN | CRO | Toronto Field | L |
| 2026-06-23T23:00 | COL | RDC | Akron | K |

### Rodada 3 (24 jogos)

| dataHora | casa | visitante | estadio | grupo |
|----------|------|-----------|---------|-------|
| 2026-06-24T16:00 | SUI | CAN | Vancouver Place | B |
| 2026-06-24T16:00 | BOS | CAT | Seattle Field | B |
| 2026-06-24T19:00 | MAR | HAI | Atlanta | C |
| 2026-06-24T19:00 | ESC | BRA | Miami | C |
| 2026-06-24T22:00 | AFS | COR | El Gigante de Acero | A |
| 2026-06-24T22:00 | TCH | MEX | Azteca | A |
| 2026-06-25T17:00 | EQU | ALE | Nova Jersey | E |
| 2026-06-25T17:00 | CUR | CDM | Filadélfia | E |
| 2026-06-25T20:00 | TUN | HOL | Kansas City | F |
| 2026-06-25T20:00 | JAP | SUE | Dallas | F |
| 2026-06-25T23:00 | PAR | AUS | Santa Clara | D |
| 2026-06-25T23:00 | TUR | EUA | Los Angeles | D |
| 2026-06-26T16:00 | SEN | IRQ | Toronto Field | I |
| 2026-06-26T16:00 | NOR | FRA | Boston | I |
| 2026-06-26T21:00 | URU | ESP | Akron | H |
| 2026-06-26T21:00 | CAB | ARS | Houston | H |
| 2026-06-27T00:00 | EGI | IRA | Seattle Field | G |
| 2026-06-27T00:00 | NZE | BEL | Vancouver Place | G |
| 2026-06-27T18:00 | CRO | GAN | Filadélfia | L |
| 2026-06-27T18:00 | PAN | ING | Nova Jersey | L |
| 2026-06-27T20:30 | COL | POR | Miami | K |
| 2026-06-27T20:30 | RDC | UZB | Atlanta | K |
| 2026-06-27T23:00 | AGL | AUT | Kansas City | J |
| 2026-06-27T23:00 | JOR | ARG | Dallas | J |

---

## Fuso horário

A API retorna `data_realizacao` sem fuso (ex: `"2026-06-11T16:00"`). Como a Globo Esporte é emissora brasileira, esses horários são de **Brasília (UTC-3)**. O seed converte adicionando o offset: `"2026-06-11T16:00:00-03:00"`. Isso preserva a hora local correta no banco (PostgreSQL armazena em UTC internamente).

---

## Critérios de sucesso

- `prisma db seed` conclui sem erro em banco limpo (`prisma migrate reset`)
- DB contém exatamente 16 estádios, 48 seleções, 72 jogos
- Cada jogo referencia times e estádio existentes
- Todos os arquivos `/flags/<codigo>.svg` existem para os 48 times
- Nenhum código FIFA antigo permanece no banco ou nos arquivos de bandeira
