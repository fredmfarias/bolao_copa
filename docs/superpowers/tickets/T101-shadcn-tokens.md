# T101 — Instalar shadcn/ui, jest e aplicar tokens visuais

> **Módulo:** [M1 — Fundação](../modules/M1-fundacao.md)
> **Tamanho:** `M`
> **Status:** `concluído`

---

## O que fazer

Instalar shadcn/ui e a infraestrutura de testes, depois aplicar a paleta `trovao-*` no Tailwind e no `globals.css`.

---

## Arquivos

| Ação | Caminho |
|---|---|
| Modificar | `apps/frontend/package.json` |
| Criar | `apps/frontend/jest.config.ts` |
| Criar | `apps/frontend/jest.setup.ts` |
| Criar | `apps/frontend/src/lib/utils.ts` (gerado pelo shadcn, não editar) |
| Criar | `apps/frontend/components.json` (gerado pelo shadcn, não editar) |
| Substituir | `apps/frontend/tailwind.config.ts` |
| Substituir | `apps/frontend/src/app/globals.css` |

---

## Passos

- [x] **Passo 1: Instalar dependências de teste**

```bash
pnpm add -D jest jest-environment-jsdom @types/jest \
  @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event \
  --filter @bolao/frontend
```

- [x] **Passo 2: Adicionar script de teste ao `package.json`**

Editar `apps/frontend/package.json` — adicionar na seção `scripts`:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [x] **Passo 3: Criar `jest.config.ts`**

```typescript
// apps/frontend/jest.config.ts
import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};

export default createJestConfig(config);
```

- [x] **Passo 4: Criar `jest.setup.ts`**

```typescript
// apps/frontend/jest.setup.ts
import '@testing-library/jest-dom';
```

- [x] **Passo 5: Verificar que o jest está configurado**

```bash
pnpm test --filter @bolao/frontend
```

Saída esperada: `No tests found, exiting with code 0` (sem erro de configuração).

- [x] **Passo 6: Instalar shadcn/ui**

```bash
cd apps/frontend
pnpm dlx shadcn@latest init -d
```

Isso cria `components.json` e `src/lib/utils.ts` com o helper `cn()`.

- [x] **Passo 7: Substituir `tailwind.config.ts`**

```typescript
// apps/frontend/tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        trovao: {
          base:    '#071A0E',
          card:    '#0D2A1C',
          gold:    '#FFD600',
          green:   '#22C55E',
          red:     '#EF4444',
          border:  '#1E3A2A',
          muted:   '#94A3B8',
          surface: '#0F2318',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [x] **Passo 8: Substituir `globals.css`**

```css
/* apps/frontend/src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-trovao-base text-white font-sans;
    min-height: 100dvh;
  }
}
```

- [x] **Passo 9: Validar build**

```bash
pnpm build --filter @bolao/frontend
```

Saída esperada: build completo sem erros de tipo.

- [ ] **Passo 10: Commit**

```bash
git add apps/frontend/package.json apps/frontend/jest.config.ts \
  apps/frontend/jest.setup.ts apps/frontend/components.json \
  apps/frontend/tailwind.config.ts apps/frontend/src/app/globals.css \
  apps/frontend/src/lib/utils.ts pnpm-lock.yaml
git commit -m "feat(frontend): shadcn/ui + jest + tokens visuais trovao-*"
```

---

## Validação final

```bash
pnpm test --filter @bolao/frontend   # → No tests found
pnpm build --filter @bolao/frontend  # → Build sem erros
```
