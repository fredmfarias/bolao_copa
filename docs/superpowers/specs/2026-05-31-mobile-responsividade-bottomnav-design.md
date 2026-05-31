# Mobile: Responsividade e BottomNav sempre visível

**Data:** 2026-05-31  
**Escopo:** Frontend — telas `/boloes`, `/ranking` (índice) e shell de layout  

## Problema

No Android Chrome, as telas `/boloes` e `/ranking` (sem bolão selecionado) apresentam dois problemas relacionados:

1. **Scroll lateral:** conteúdo ultrapassa a largura do viewport, causando scroll horizontal.
2. **BottomNav some:** no Android Chrome, scroll horizontal quebra o `position: fixed` — o nav passa a se comportar como elemento no fluxo normal do documento e só aparece ao scrollar até o fim da página. Adicionalmente, o layout atual tem early returns que omitem o BottomNav durante o loading de autenticação.

Os dois problemas são conectados: resolver o overflow resolve o fixed. Mas o early return de loading é um bug independente que também precisa de correção.

## Solução escolhida

Refatoração do layout shell (Opção B), com correções adicionais nas páginas afetadas. Toca 3 arquivos. Não redesenha as telas.

---

## Seção 1: AppLayout (`app/(app)/layout.tsx`)

### Mudanças

**`overflow-x-hidden` no wrapper raiz**  
Impede qualquer filho de causar scroll horizontal. Resolve a causa raiz do BottomNav sumindo no Android Chrome.

**BottomNav fora dos early returns**  
O layout atual tem dois caminhos sem BottomNav:
- `if (loading) return <spinner>` — omite o nav durante verificação de auth
- `if (!user) return null` — omite o nav durante redirect

O único early return que sobrevive é `if (!loading && !user) return null` (redirect já disparado, duração de um frame). Em todos os outros estados o shell completo é renderizado.

**Spinner de loading move para dentro do `<main>`**  
O spinner deixa de ser um full-page takeover e passa a ocupar a área de conteúdo, mantendo o BottomNav visível.

### Estrutura resultante

```
if (!loading && !user) → return null  // redirect em andamento

return (
  <div min-h-screen overflow-x-hidden>
    <main max-w-lg mx-auto px-4 pt-6 pb-24>
      {loading ? <Spinner /> : children}
    </main>
    <BottomNav />   ← sempre renderizado
  </div>
)
```

### Comportamento por estado

| Estado | Atual | Proposto |
|--------|-------|----------|
| Auth loading | Spinner sem nav | Spinner + BottomNav |
| `!user` (redirect) | `null` sem nav | `null` (flash, aceitável) |
| Dados da página loading (PageSkeleton) | Nav ok | Nav ok (sem mudança) |
| Pronto | Nav ok | Nav ok |

---

## Seção 2: BolaoCard (`components/BolaoCard.tsx`)

### Mudanças

- **`overflow-hidden`** no `div` wrapper do card — impede que conteúdo interno vaze horizontalmente e permite que `truncate` funcione corretamente dentro do card (itens de grid têm `min-width: auto` por default).
- **`truncate`** no `<p>` de `bolao.nome` — nomes longos sem espaços ficam truncados com ellipsis em vez de expandir o card.

### Rationale

O BolaoCard é usado em `/boloes`, `/ranking` e potencialmente em outras telas futuras. Centralizar o overflow-safe aqui protege todos os usos.

---

## Seção 3: Página de Bolões (`app/(app)/boloes/page.tsx`)

### Mudanças

- **`min-w-0`** no `<input>` de busca — em flex containers, inputs têm `min-width: auto` por default, o que pode impedir o encolhimento correto em telas pequenas.
- **Padronização de cores** para o tema trovao:
  - `bg-gray-800` → `bg-trovao-card`
  - `border-gray-700` → `border-trovao-border`
  - `focus:border-yellow-400` → `focus:border-trovao-gold`
  - `bg-gray-700 hover:bg-gray-600` (botão) → `bg-trovao-surface hover:bg-trovao-border`

A padronização de cores é cosmética mas resolve a inconsistência visual que ficava aparente ao lado dos BolaoCards com tema trovao.

---

## Arquivos afetados

| Arquivo | Tipo de mudança |
|---------|----------------|
| `apps/frontend/src/app/(app)/layout.tsx` | Estrutural — early returns + overflow |
| `apps/frontend/src/components/BolaoCard.tsx` | Defensivo — overflow + truncate |
| `apps/frontend/src/app/(app)/boloes/page.tsx` | CSS — min-w-0 + cores |

`ranking/page.tsx` não muda — herda todas as correções via AppLayout e BolaoCard.

---

## Fora de escopo

- Redesenho visual das telas
- Mudanças nas telas de detalhe (`/boloes/[id]`, `/ranking/[bolaoId]`)
- Safe area inset para iOS (não foi reportado problema em iOS)
- PWA / viewport meta tags
