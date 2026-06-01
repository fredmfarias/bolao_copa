# Mobile Fixes e Logos — Design Spec

**Data:** 2026-06-01  
**Status:** Aprovado

## Problema

Dois bugs de layout no mobile:

1. **ModeradorPanel** — botão "Remover" na lista de membros extravasa o card no mobile. A linha `flex items-center gap-3` com avatar + nome + badge de papel + badge de pagamento + botões de ação é larga demais para viewports estreitas.

2. **AdminTopNav** — link "← App" fica fora da viewport no mobile. O nav com `flex items-center gap-1` coloca Admin + 4 links + "← App" numa linha que excede a largura da tela, empurrando "← App" para além do scroll.

Adicionalmente, o projeto ganhou três imagens de marca (`favicon.ico`, `logo_site.png`, `logo_bolao.png`) que precisam ser integradas corretamente ao Next.js e usadas para melhorar o design visual.

## Escopo

- Mover imagens de marca para os locais corretos do Next.js
- Substituir o cabeçalho de texto da login page pelo logo real
- Corrigir overflow do AdminTopNav no mobile (layout sandwich)
- Corrigir overflow do ModeradorPanel no mobile (flex-wrap)

## Design

### 1. Localização das imagens

| Arquivo | Destino | Motivo |
|---|---|---|
| `favicon.ico` | `apps/frontend/src/app/favicon.ico` | Next.js App Router serve automaticamente no `<head>` |
| `logo_bolao.png` | `apps/frontend/public/logo_bolao.png` | Servido em `/logo_bolao.png` |
| `logo_site.png` | `apps/frontend/public/logo_site.png` | Servido em `/logo_site.png` |

Nenhuma configuração adicional de metadata é necessária para o favicon — Next.js detecta automaticamente.

### 2. Login page — logo visual

Substituir o `<h1>` de texto `⚡ Bolão Trovão` por um `<Image>` do Next.js apontando para `/logo_bolao.png`.

- Tamanho: `width={176} height={176}` (w-44), centralizado com `mx-auto`
- Atributo `priority` para carregamento imediato (above the fold)
- `alt="Bolão Trovão"`

O logo tem fundo branco, o que cria um contraste visual limpo contra o card escuro `bg-gray-900`. Não é necessário adicionar `rounded` ou sombra — o recorte orgânico do logo já funciona bem.

### 3. AdminTopNav — sandwich fixo

**Antes:** um único `flex` com todos os itens. "← App" usa `ml-auto` e fica invisível no mobile.

**Depois:** três elementos no flex container principal:
1. `<span>Admin</span>` — `shrink-0`, fixo à esquerda
2. `<div className="flex flex-1 overflow-x-auto gap-1">` — links de nav scrolláveis
3. `<Link href="/jogos">← App</Link>` — `shrink-0 ml-2`, sempre visível à direita

Scrollbar da área de nav oculta via Tailwind arbitrary properties: `[&::-webkit-scrollbar]:hidden [scrollbar-width:none]` (o projeto não usa plugin de scrollbar — sem `scrollbar-none`).

### 4. ModeradorPanel — flex-wrap

**Antes:** `flex items-center gap-3` — linha única que transborda.

**Depois:** `flex flex-wrap items-center gap-x-3 gap-y-2` com dois grupos:

- **Grupo esquerdo** (avatar + nome): `flex items-center gap-2 flex-1 min-w-0` — o `min-w-0` garante que nomes longos truncam corretamente com `truncate`.
- **Grupo direito** (badges + botões): `flex items-center gap-1 shrink-0` — não comprime; se não couber na linha, quebra para a próxima.

No mobile, o grupo direito vai para a segunda linha, alinhado naturalmente à direita do `flex-wrap`. Em telas maiores (sm+), tudo cabe numa linha só — sem breakpoint explícito necessário.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `apps/frontend/src/app/favicon.ico` | Novo (movido) |
| `apps/frontend/public/logo_bolao.png` | Novo (movido) |
| `apps/frontend/public/logo_site.png` | Novo (movido) |
| `apps/frontend/src/app/(auth)/login/page.tsx` | Substituir h1 texto por `<Image>` |
| `apps/frontend/src/components/AdminTopNav.tsx` | Sandwich layout |
| `apps/frontend/src/components/ModeradorPanel.tsx` | flex-wrap com dois grupos |

## Fora do escopo

- Uso do logo em outras páginas além do login
- Mudanças no conteúdo ou regras dos componentes
- Modificações no backend
