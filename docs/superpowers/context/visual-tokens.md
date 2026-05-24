# Visual Tokens — Bolão Trovão

> Contexto permanente. Carregar sempre que criar ou modificar componentes visuais.

---

## Paleta de cores

| Token | Hex | Uso |
|---|---|---|
| `trovao-base` | `#071A0E` | Background de página |
| `trovao-card` | `#0D2A1C` | Cards, drawers, modais |
| `trovao-gold` | `#FFD600` | CTAs primários, destaques |
| `trovao-green` | `#22C55E` | Acertos, sucesso, variação positiva |
| `trovao-red` | `#EF4444` | Erros, variação negativa |
| `trovao-border` | `#1E3A2A` | Bordas de card e separadores |
| `trovao-muted` | `#94A3B8` | Texto secundário |
| `trovao-surface` | `#0F2318` | Superfície alternativa (inputs, hover) |

---

## Extensão do `tailwind.config.ts`

Substituir o conteúdo atual de `tailwind.config.ts` por:

```typescript
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
      borderRadius: {
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## `globals.css` — variáveis base

```css
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

---

## Classes utilitárias padrão

### Card

```tsx
<div className="bg-trovao-card border border-trovao-border rounded-xl p-4">
```

### CTA primário (dourado)

```tsx
<button className="w-full bg-trovao-gold text-trovao-base font-bold py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all">
```

### CTA secundário (outline)

```tsx
<button className="w-full border border-trovao-border text-white font-semibold py-3 rounded-xl hover:bg-trovao-surface transition-colors">
```

### Badge de acerto

```tsx
// Placar exato
<span className="bg-trovao-green/20 text-trovao-green text-xs font-bold px-2 py-0.5 rounded-full">
// Vencedor correto
<span className="bg-trovao-gold/20 text-trovao-gold text-xs font-bold px-2 py-0.5 rounded-full">
// Errou
<span className="bg-trovao-red/20 text-trovao-red text-xs font-bold px-2 py-0.5 rounded-full">
```

### Chip de filtro

```tsx
// Ativo
<button className="px-3 py-1 rounded-full bg-trovao-gold text-trovao-base text-sm font-semibold">
// Inativo
<button className="px-3 py-1 rounded-full border border-trovao-border text-trovao-muted text-sm hover:border-trovao-gold transition-colors">
```

### BottomNav (mobile)

```tsx
<nav className="fixed bottom-0 left-0 right-0 bg-trovao-card border-t border-trovao-border z-50 pb-safe">
  <div className="flex items-center justify-around h-16">
    {/* cada item */}
    <button className="flex flex-col items-center gap-1 text-trovao-muted hover:text-trovao-gold transition-colors">
      <Icon className="w-5 h-5" />
      <span className="text-[10px]">Label</span>
    </button>
  </div>
</nav>
```

### Variação de posição no ranking

```tsx
// Subiu
<span className="text-trovao-green text-xs">▲ {delta}</span>
// Caiu
<span className="text-trovao-red text-xs">▼ {delta}</span>
// Igual
<span className="text-trovao-muted text-xs">— </span>
```

---

## shadcn/ui — configuração base

Ao instalar em M1:

```bash
cd apps/frontend
npx shadcn-ui@latest init
```

Responder:
- Style: **Default**
- Base color: **Slate** (será sobrescrito pelos tokens acima)
- CSS variables: **Yes**

Após instalar, sobrescrever as variáveis CSS do shadcn em `globals.css` com os tokens `trovao-*` acima.

---

## Resumo operacional

Paleta de 8 tokens com prefixo `trovao-`, inspirada no visual dark-green do Cartola FC. Fundo `#071A0E`, cards `#0D2A1C`, CTA dourado `#FFD600`. Classes utilitárias padronizadas para card, CTA, badge e chip garantem consistência entre módulos sem depender de um design system externo.
