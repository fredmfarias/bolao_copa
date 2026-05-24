# Bandeiras das Seleções Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer as bandeiras das seleções aparecerem nas páginas `/jogos` e `/boloes` servindo 48 SVGs como arquivos estáticos do Next.js.

**Architecture:** Os SVGs em `selecoes/` são copiados para `apps/frontend/public/flags/` com nomes no formato `<CODIGO>.svg`. O componente `SelecaoAvatar` é corrigido de `dangerouslySetInnerHTML` para `<img src>`. O seed do banco é atualizado para refletir os 48 times reais.

**Tech Stack:** Next.js 14 (static assets via `public/`), React, Prisma seed (ts-node), Jest + Testing Library

---

## Arquivos modificados

| Ação | Arquivo |
|---|---|
| Criar (48 arquivos) | `apps/frontend/public/flags/*.svg` |
| Modificar | `apps/frontend/src/components/SelecaoAvatar.tsx` |
| Modificar | `apps/frontend/src/__tests__/SelecaoAvatar.test.tsx` |
| Modificar | `apps/backend/prisma/seed.ts` |
| Remover | `selecoes/` (pasta raiz) |

---

## Task 1: Copiar e renomear os SVGs para public/flags/

**Files:**
- Create: `apps/frontend/public/flags/` (diretório com 48 arquivos `.svg`)

- [ ] **Step 1: Criar o diretório de destino**

```bash
mkdir -p apps/frontend/public/flags
```

- [ ] **Step 2: Copiar e renomear todos os 48 SVGs**

Execute este script bash a partir da raiz do projeto (`/c/workspace/bolao-trovao`):

```bash
SRC="selecoes"
DST="apps/frontend/public/flags"

cp "$SRC/Alemanha.svg"          "$DST/GER.svg"
cp "$SRC/Arabia_Saudita.svg"    "$DST/KSA.svg"
cp "$SRC/Argentina.svg"         "$DST/ARG.svg"
cp "$SRC/Argélia.svg"           "$DST/ALG.svg"
cp "$SRC/Australia.svg"         "$DST/AUS.svg"
cp "$SRC/Belgica.svg"           "$DST/BEL.svg"
cp "$SRC/Brasil.svg"            "$DST/BRA.svg"
cp "$SRC/Bósnia.svg"            "$DST/BIH.svg"
cp "$SRC/Cabo_Verde.svg"        "$DST/CPV.svg"
cp "$SRC/Canada.svg"            "$DST/CAN.svg"
cp "$SRC/Catar.svg"             "$DST/QAT.svg"
cp "$SRC/Colombia.svg"          "$DST/COL.svg"
cp "$SRC/Coreia_do_Sul.svg"     "$DST/KOR.svg"
cp "$SRC/Costa_do_Marfim.svg"   "$DST/CIV.svg"
cp "$SRC/Croacia.svg"           "$DST/CRO.svg"
cp "$SRC/Curaçao.svg"           "$DST/CUW.svg"
cp "$SRC/Egito.svg"             "$DST/EGY.svg"
cp "$SRC/Equador.svg"           "$DST/ECU.svg"
cp "$SRC/Escócia.svg"           "$DST/SCO.svg"
cp "$SRC/Espanha.svg"           "$DST/ESP.svg"
cp "$SRC/Estados_Unidos.svg"    "$DST/USA.svg"
cp "$SRC/Franca.svg"            "$DST/FRA.svg"
cp "$SRC/Gana.svg"              "$DST/GHA.svg"
cp "$SRC/Haiti.svg"             "$DST/HAI.svg"
cp "$SRC/Holanda.svg"           "$DST/NED.svg"
cp "$SRC/Inglaterra.svg"        "$DST/ENG.svg"
cp "$SRC/Iraque.svg"            "$DST/IRQ.svg"
cp "$SRC/Irã.svg"               "$DST/IRN.svg"
cp "$SRC/Japao.svg"             "$DST/JPN.svg"
cp "$SRC/Jordania.svg"          "$DST/JOR.svg"
cp "$SRC/Marrocos.svg"          "$DST/MAR.svg"
cp "$SRC/Mexico.svg"            "$DST/MEX.svg"
cp "$SRC/Noruega.svg"           "$DST/NOR.svg"
cp "$SRC/Nova_Zelandia.svg"     "$DST/NZL.svg"
cp "$SRC/Panamá.svg"            "$DST/PAN.svg"
cp "$SRC/Paraguai.svg"          "$DST/PAR.svg"
cp "$SRC/Portugal.svg"          "$DST/POR.svg"
cp "$SRC/RD_Congo.svg"          "$DST/COD.svg"
cp "$SRC/Rep_Tcheca.svg"        "$DST/CZE.svg"
cp "$SRC/Senegal.svg"           "$DST/SEN.svg"
cp "$SRC/Suica.svg"             "$DST/SUI.svg"
cp "$SRC/Suécia.svg"            "$DST/SWE.svg"
cp "$SRC/Tunisia.svg"           "$DST/TUN.svg"
cp "$SRC/Turquia.svg"           "$DST/TUR.svg"
cp "$SRC/Uruguai.svg"           "$DST/URU.svg"
cp "$SRC/Uzbequistão.svg"       "$DST/UZB.svg"
cp "$SRC/África_do_Sul.svg"     "$DST/RSA.svg"
cp "$SRC/Áustria.svg"           "$DST/AUT.svg"
```

- [ ] **Step 3: Verificar que os 48 arquivos foram criados**

```bash
ls apps/frontend/public/flags/ | wc -l
```

Resultado esperado: `48`

- [ ] **Step 4: Remover a pasta selecoes/ da raiz**

```bash
rm -rf selecoes/
```

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/public/flags/
git rm -r selecoes/
git commit -m "feat: adicionar bandeiras SVG das seleções em public/flags"
```

---

## Task 2: Corrigir SelecaoAvatar para usar \<img\>

**Files:**
- Modify: `apps/frontend/src/__tests__/SelecaoAvatar.test.tsx`
- Modify: `apps/frontend/src/components/SelecaoAvatar.tsx`

- [ ] **Step 1: Atualizar o teste para a nova interface (img + alt)**

Substitua o conteúdo completo de `apps/frontend/src/__tests__/SelecaoAvatar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';

const svgPath = '/flags/BRA.svg';

it('renderiza a bandeira com o alt do país', () => {
  render(<SelecaoAvatar nome="Brasil" bandeiraSvg={svgPath} />);
  expect(screen.getByRole('img', { name: 'Brasil' })).toBeInTheDocument();
});

it('aplica classe de tamanho md por padrão', () => {
  render(<SelecaoAvatar nome="Brasil" bandeiraSvg={svgPath} />);
  expect(screen.getByRole('img', { name: 'Brasil' })).toHaveClass('w-10');
});

it('aplica classe de tamanho lg quando size="lg"', () => {
  render(<SelecaoAvatar nome="Brasil" bandeiraSvg={svgPath} size="lg" />);
  expect(screen.getByRole('img', { name: 'Brasil' })).toHaveClass('w-16');
});

it('usa o src correto', () => {
  render(<SelecaoAvatar nome="Brasil" bandeiraSvg={svgPath} />);
  expect(screen.getByRole('img', { name: 'Brasil' })).toHaveAttribute('src', '/flags/BRA.svg');
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/frontend && pnpm test -- --testPathPattern=SelecaoAvatar --no-coverage
```

Resultado esperado: 3 testes falham (o componente ainda renderiza `div` com `dangerouslySetInnerHTML`, não um `img`).

- [ ] **Step 3: Corrigir o componente**

Substitua o conteúdo completo de `apps/frontend/src/components/SelecaoAvatar.tsx`:

```tsx
interface SelecaoAvatarProps {
  nome: string;
  bandeiraSvg: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'w-6 h-6',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
} as const;

export function SelecaoAvatar({ nome, bandeiraSvg, size = 'md' }: SelecaoAvatarProps) {
  return (
    <img
      src={bandeiraSvg}
      alt={nome}
      className={`${SIZES[size]} rounded-full object-cover flex-shrink-0`}
    />
  );
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
cd apps/frontend && pnpm test -- --testPathPattern=SelecaoAvatar --no-coverage
```

Resultado esperado: 4 testes passam (PASS).

- [ ] **Step 5: Rodar a suíte completa para garantir nenhuma regressão**

```bash
cd apps/frontend && pnpm test --no-coverage
```

Resultado esperado: todos os testes passam. Se `JogoCard.test.tsx` ou outro teste usar `bandeiraSvg: '<svg></svg>'` como fixture, continuará funcionando porque `<img src="<svg></svg>" />` é válido em jsdom.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/components/SelecaoAvatar.tsx \
        apps/frontend/src/__tests__/SelecaoAvatar.test.tsx
git commit -m "fix: SelecaoAvatar usa <img src> em vez de dangerouslySetInnerHTML"
```

---

## Task 3: Atualizar o seed com os 48 times reais

**Files:**
- Modify: `apps/backend/prisma/seed.ts` (linhas 81–130, bloco `const selecoes`)

- [ ] **Step 1: Substituir o bloco `const selecoes` no seed**

No arquivo `apps/backend/prisma/seed.ts`, localize o bloco que começa em:
```ts
  // Seleções — 48 times em 12 grupos (A–L)
  // ATENÇÃO: grupos provisórios — atualizar após sorteio oficial da FIFA
  const selecoes = [
```

Substitua o array inteiro (do `[` até o `]` inclusive) pelo seguinte:

```ts
  const selecoes = [
    // Grupo A
    { nome: 'Brasil',           codigo: 'BRA', grupo: 'A', bandeiraSvg: '/flags/BRA.svg' },
    { nome: 'Alemanha',         codigo: 'GER', grupo: 'A', bandeiraSvg: '/flags/GER.svg' },
    { nome: 'Japão',            codigo: 'JPN', grupo: 'A', bandeiraSvg: '/flags/JPN.svg' },
    { nome: 'Marrocos',         codigo: 'MAR', grupo: 'A', bandeiraSvg: '/flags/MAR.svg' },
    // Grupo B
    { nome: 'Argentina',        codigo: 'ARG', grupo: 'B', bandeiraSvg: '/flags/ARG.svg' },
    { nome: 'França',           codigo: 'FRA', grupo: 'B', bandeiraSvg: '/flags/FRA.svg' },
    { nome: 'Senegal',          codigo: 'SEN', grupo: 'B', bandeiraSvg: '/flags/SEN.svg' },
    { nome: 'Equador',          codigo: 'ECU', grupo: 'B', bandeiraSvg: '/flags/ECU.svg' },
    // Grupo C
    { nome: 'Espanha',          codigo: 'ESP', grupo: 'C', bandeiraSvg: '/flags/ESP.svg' },
    { nome: 'Portugal',         codigo: 'POR', grupo: 'C', bandeiraSvg: '/flags/POR.svg' },
    { nome: 'México',           codigo: 'MEX', grupo: 'C', bandeiraSvg: '/flags/MEX.svg' },
    { nome: 'Catar',            codigo: 'QAT', grupo: 'C', bandeiraSvg: '/flags/QAT.svg' },
    // Grupo D
    { nome: 'Inglaterra',       codigo: 'ENG', grupo: 'D', bandeiraSvg: '/flags/ENG.svg' },
    { nome: 'Holanda',          codigo: 'NED', grupo: 'D', bandeiraSvg: '/flags/NED.svg' },
    { nome: 'Uruguai',          codigo: 'URU', grupo: 'D', bandeiraSvg: '/flags/URU.svg' },
    { nome: 'Tunísia',          codigo: 'TUN', grupo: 'D', bandeiraSvg: '/flags/TUN.svg' },
    // Grupo E
    { nome: 'Bélgica',          codigo: 'BEL', grupo: 'E', bandeiraSvg: '/flags/BEL.svg' },
    { nome: 'República Tcheca', codigo: 'CZE', grupo: 'E', bandeiraSvg: '/flags/CZE.svg' },
    { nome: 'Colômbia',         codigo: 'COL', grupo: 'E', bandeiraSvg: '/flags/COL.svg' },
    { nome: 'Austrália',        codigo: 'AUS', grupo: 'E', bandeiraSvg: '/flags/AUS.svg' },
    // Grupo F
    { nome: 'Estados Unidos',   codigo: 'USA', grupo: 'F', bandeiraSvg: '/flags/USA.svg' },
    { nome: 'Croácia',          codigo: 'CRO', grupo: 'F', bandeiraSvg: '/flags/CRO.svg' },
    { nome: 'Suíça',            codigo: 'SUI', grupo: 'F', bandeiraSvg: '/flags/SUI.svg' },
    { nome: 'Gana',             codigo: 'GHA', grupo: 'F', bandeiraSvg: '/flags/GHA.svg' },
    // Grupo G
    { nome: 'Canadá',           codigo: 'CAN', grupo: 'G', bandeiraSvg: '/flags/CAN.svg' },
    { nome: 'Bósnia',           codigo: 'BIH', grupo: 'G', bandeiraSvg: '/flags/BIH.svg' },
    { nome: 'Suécia',           codigo: 'SWE', grupo: 'G', bandeiraSvg: '/flags/SWE.svg' },
    { nome: 'Irã',              codigo: 'IRN', grupo: 'G', bandeiraSvg: '/flags/IRN.svg' },
    // Grupo H
    { nome: 'Coreia do Sul',    codigo: 'KOR', grupo: 'H', bandeiraSvg: '/flags/KOR.svg' },
    { nome: 'Jordânia',         codigo: 'JOR', grupo: 'H', bandeiraSvg: '/flags/JOR.svg' },
    { nome: 'Turquia',          codigo: 'TUR', grupo: 'H', bandeiraSvg: '/flags/TUR.svg' },
    { nome: 'Iraque',           codigo: 'IRQ', grupo: 'H', bandeiraSvg: '/flags/IRQ.svg' },
    // Grupo I
    { nome: 'Nova Zelândia',    codigo: 'NZL', grupo: 'I', bandeiraSvg: '/flags/NZL.svg' },
    { nome: 'Áustria',          codigo: 'AUT', grupo: 'I', bandeiraSvg: '/flags/AUT.svg' },
    { nome: 'Uzbequistão',      codigo: 'UZB', grupo: 'I', bandeiraSvg: '/flags/UZB.svg' },
    { nome: 'África do Sul',    codigo: 'RSA', grupo: 'I', bandeiraSvg: '/flags/RSA.svg' },
    // Grupo J
    { nome: 'Paraguai',         codigo: 'PAR', grupo: 'J', bandeiraSvg: '/flags/PAR.svg' },
    { nome: 'Panamá',           codigo: 'PAN', grupo: 'J', bandeiraSvg: '/flags/PAN.svg' },
    { nome: 'Arábia Saudita',   codigo: 'KSA', grupo: 'J', bandeiraSvg: '/flags/KSA.svg' },
    { nome: 'Cabo Verde',       codigo: 'CPV', grupo: 'J', bandeiraSvg: '/flags/CPV.svg' },
    // Grupo K
    { nome: 'RD Congo',         codigo: 'COD', grupo: 'K', bandeiraSvg: '/flags/COD.svg' },
    { nome: 'Escócia',          codigo: 'SCO', grupo: 'K', bandeiraSvg: '/flags/SCO.svg' },
    { nome: 'Egito',            codigo: 'EGY', grupo: 'K', bandeiraSvg: '/flags/EGY.svg' },
    { nome: 'Argélia',          codigo: 'ALG', grupo: 'K', bandeiraSvg: '/flags/ALG.svg' },
    // Grupo L
    { nome: 'Haiti',            codigo: 'HAI', grupo: 'L', bandeiraSvg: '/flags/HAI.svg' },
    { nome: 'Noruega',          codigo: 'NOR', grupo: 'L', bandeiraSvg: '/flags/NOR.svg' },
    { nome: 'Costa do Marfim',  codigo: 'CIV', grupo: 'L', bandeiraSvg: '/flags/CIV.svg' },
    { nome: 'Curaçao',          codigo: 'CUW', grupo: 'L', bandeiraSvg: '/flags/CUW.svg' },
  ];
```

- [ ] **Step 2: Verificar que o arquivo compila sem erros**

```bash
cd apps/backend && npx tsc --noEmit
```

Resultado esperado: sem erros de compilação.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/prisma/seed.ts
git commit -m "fix: atualizar seed com as 48 seleções reais da Copa 2026"
```

---

## Verificação Final

Após as 3 tasks, verifique que tudo funciona de ponta a ponta:

- [ ] **Checar arquivos SVG**

```bash
ls apps/frontend/public/flags/ | wc -l
```
Esperado: `48`

- [ ] **Checar que nenhum dangerouslySetInnerHTML resta para bandeiras**

```bash
grep -r "dangerouslySetInnerHTML" apps/frontend/src/components/SelecaoAvatar.tsx
```
Esperado: nenhuma saída.

- [ ] **Rodar todos os testes do frontend**

```bash
cd apps/frontend && pnpm test --no-coverage
```
Esperado: todos passam.

- [ ] **Subir o banco e rodar o seed (se o ambiente estiver disponível)**

```bash
cd apps/backend && pnpm db:seed
```
Esperado: `Seed concluído.` sem erros.
