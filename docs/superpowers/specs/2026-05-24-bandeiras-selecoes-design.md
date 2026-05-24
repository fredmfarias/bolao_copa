# Design: Bandeiras das Seleções — Static Files

**Data:** 2026-05-24  
**Status:** Aprovado

## Problema

O campo `bandeiraSvg` na tabela `selecao` armazena paths como `/flags/BRA.svg`, mas o componente `SelecaoAvatar` usa `dangerouslySetInnerHTML={{ __html: bandeiraSvg }}`, que espera markup SVG inline. Resultado: nenhuma bandeira é exibida nas páginas `/jogos` e `/boloes`.

Adicionalmente, a pasta `selecoes/` na raiz do projeto contém 48 arquivos SVG com nomes em português (ex: `Brasil.svg`, `Franca.svg`) que precisam ser organizados e integrados ao projeto.

## Solução

Servir as bandeiras como arquivos estáticos via Next.js (`public/flags/`), corrigir o componente para usar `<img>`, e atualizar o seed para refletir os 48 times reais com seus SVGs.

## Escopo

### 1. Mover e renomear os SVGs

Origem: `selecoes/<NomePT>.svg`  
Destino: `apps/frontend/public/flags/<CODIGO>.svg`

Mapeamento completo (48 arquivos):

| Arquivo original | Destino |
|---|---|
| Alemanha.svg | GER.svg |
| Arabia_Saudita.svg | KSA.svg |
| Argentina.svg | ARG.svg |
| Argélia.svg | ALG.svg |
| Australia.svg | AUS.svg |
| Belgica.svg | BEL.svg |
| Brasil.svg | BRA.svg |
| Bósnia.svg | BIH.svg |
| Cabo_Verde.svg | CPV.svg |
| Canada.svg | CAN.svg |
| Catar.svg | QAT.svg |
| Colombia.svg | COL.svg |
| Coreia_do_Sul.svg | KOR.svg |
| Costa_do_Marfim.svg | CIV.svg |
| Croacia.svg | CRO.svg |
| Curaçao.svg | CUW.svg |
| Egito.svg | EGY.svg |
| Equador.svg | ECU.svg |
| Escócia.svg | SCO.svg |
| Espanha.svg | ESP.svg |
| Estados_Unidos.svg | USA.svg |
| Franca.svg | FRA.svg |
| Gana.svg | GHA.svg |
| Haiti.svg | HAI.svg |
| Holanda.svg | NED.svg |
| Inglaterra.svg | ENG.svg |
| Iraque.svg | IRQ.svg |
| Irã.svg | IRN.svg |
| Japao.svg | JPN.svg |
| Jordania.svg | JOR.svg |
| Marrocos.svg | MAR.svg |
| Mexico.svg | MEX.svg |
| Noruega.svg | NOR.svg |
| Nova_Zelandia.svg | NZL.svg |
| Panamá.svg | PAN.svg |
| Paraguai.svg | PAR.svg |
| Portugal.svg | POR.svg |
| RD_Congo.svg | COD.svg |
| Rep_Tcheca.svg | CZE.svg |
| Senegal.svg | SEN.svg |
| Suica.svg | SUI.svg |
| Suécia.svg | SWE.svg |
| Tunisia.svg | TUN.svg |
| Turquia.svg | TUR.svg |
| Uruguai.svg | URU.svg |
| Uzbequistão.svg | UZB.svg |
| África_do_Sul.svg | RSA.svg |
| Áustria.svg | AUT.svg |

A pasta `selecoes/` na raiz é removida após a migração (os arquivos estão no git, mas não pertencem à estrutura do projeto).

### 2. Corrigir `SelecaoAvatar`

Arquivo: `apps/frontend/src/components/SelecaoAvatar.tsx`

```tsx
// ANTES
<div
  title={nome}
  className={`${SIZES[size]} rounded-full overflow-hidden flex-shrink-0 [&>svg]:w-full [&>svg]:h-full`}
  dangerouslySetInnerHTML={{ __html: bandeiraSvg }}
/>

// DEPOIS
<img
  src={bandeiraSvg}
  alt={nome}
  className={`${SIZES[size]} rounded-full object-cover flex-shrink-0`}
/>
```

A prop `bandeiraSvg` continua sendo `string` — nenhuma mudança na interface do componente nem nos seus consumidores.

### 3. Atualizar o seed

Arquivo: `apps/backend/prisma/seed.ts`

Substituir a lista provisória de 48 seleções pela lista que corresponde exatamente aos SVGs disponíveis, mantendo o mesmo formato de dados:

```ts
{ nome: 'Brasil',           codigo: 'BRA', grupo: 'A', bandeiraSvg: '/flags/BRA.svg' },
{ nome: 'Alemanha',         codigo: 'GER', grupo: 'A', bandeiraSvg: '/flags/GER.svg' },
// ... 48 entradas no total, uma por SVG
```

Os grupos permanecem provisórios (marcados com comentário no seed). O campo `bandeiraSvg` já estava correto no formato — só os times mudam.

## O que NÃO muda

- Schema Prisma (`bandeiraSvg String`) — sem migração necessária
- Interface TypeScript `Selecao` — sem alteração
- API do backend — sem alteração
- Todos os outros componentes que consomem `SelecaoAvatar` — funcionam automaticamente após a correção do componente

## Fluxo de dados após a mudança

```
DB: selecao.bandeiraSvg = "/flags/BRA.svg"
      ↓
API: { bandeiraSvg: "/flags/BRA.svg" }
      ↓
SelecaoAvatar: <img src="/flags/BRA.svg" alt="Brasil" />
      ↓
Next.js serve: apps/frontend/public/flags/BRA.svg → /flags/BRA.svg
```

## Critérios de sucesso

- Bandeiras visíveis em `/jogos` e `/boloes` sem erros no console
- Nenhum `dangerouslySetInnerHTML` relacionado a bandeiras
- `apps/frontend/public/flags/` contém exatamente 48 arquivos `.svg`
- Seed re-executável (`prisma db seed`) sem erros
