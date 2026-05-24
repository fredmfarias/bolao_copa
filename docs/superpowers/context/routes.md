# Rotas — Bolão Trovão Frontend

> Contexto permanente. Carregar sempre que criar rotas ou layouts.

---

## Árvore de rotas atual

```
app/
├── page.tsx                          → redirect para /jogos
├── layout.tsx                        ← RootLayout: envolve <AuthProvider>
│
├── (auth)/                           ← rotas públicas (sem NavBar)
│   ├── login/page.tsx
│   ├── registrar/page.tsx
│   ├── confirmar-email/page.tsx
│   ├── esqueceu-senha/page.tsx
│   └── nova-senha/page.tsx
│
├── auth/
│   └── callback/page.tsx             ← redirect pós-Google OAuth
│
└── (app)/                            ← rotas autenticadas (AppLayout)
    ├── layout.tsx                    ← guard: redireciona para /login se !user
    ├── jogos/page.tsx
    ├── boloes/
    │   ├── page.tsx
    │   ├── novo/page.tsx
    │   └── [id]/page.tsx
    ├── perfil/page.tsx
    └── ranking/
        └── [bolaoId]/page.tsx
```

---

## Rotas a criar por módulo

### M3 — Ranking

```
(app)/
└── palpites/
    └── [jogoId]/page.tsx            ← palpites de todos os usuários para um jogo
```

### M4 — Admin

```
(admin)/                             ← route group com AdminLayout (separado do AppLayout)
├── layout.tsx                       ← guard: Role.ADMIN + AdminTopNav
├── placares/page.tsx                ← entrada de placares por jogo
├── ranking/page.tsx                 ← preview do ranking draft + botão publicar
└── usuarios/page.tsx                ← lista com toggles de status e role
```

### M5 — Bolão/Convite

```
(app)/
└── boloes/
    └── [id]/page.tsx                ← adicionar painel do moderador (ConvitePanel)

convite/                             ← fora de (app), rota pública
└── [codigo]/page.tsx                ← landing de convite (5 estados)
```

---

## Guards e layouts

### AppLayout `(app)/layout.tsx`

```typescript
// Redireciona para /login se não autenticado
const { user, loading } = useAuth();
useEffect(() => {
  if (!loading && !user) router.push('/login');
}, [user, loading, router]);
```

Renderiza `<NavBar />` no topo (atual) → será substituído por `<BottomNav />` em M1.

### AdminLayout `(admin)/layout.tsx` — a criar em M4

```typescript
// Redireciona para /jogos se não for ADMIN
const { user } = useAuth();
useEffect(() => {
  if (!loading && user?.role !== 'ADMIN') router.push('/jogos');
}, [user, loading, router]);
```

Renderiza `<AdminTopNav />` sem `<BottomNav />`.

### Rota pública de convite — sem guard

`/convite/[codigo]` não usa nem `(app)` nem `(admin)`. Usuário não autenticado pode acessar, mas para aceitar é redirecionado ao login com `?redirect=/convite/[codigo]`.

---

## Convenção de nomenclatura

| Contexto | Padrão |
|---|---|
| Página | `apps/frontend/src/app/(grupo)/rota/page.tsx` |
| Layout de grupo | `apps/frontend/src/app/(grupo)/layout.tsx` |
| Parâmetro dinâmico | `[id]`, `[bolaoId]`, `[jogoId]`, `[codigo]` |
| Componente de página | PascalCase, arquivo em `src/components/` |

---

## NavBar atual vs BottomNav (M1)

**Atual:** `<NavBar />` — barra horizontal no topo, desktop-first.  
**Alvo (M1):** `<BottomNav />` — barra fixa no rodapé, mobile-first, 4 ícones: Jogos · Bolões · Ranking · Perfil.

O `AppLayout` será atualizado em M1 para trocar `<NavBar />` por `<BottomNav />` e ajustar o padding do `<main>` para não ficar atrás da barra.

---

## Resumo operacional

Dois route groups principais: `(app)` (autenticado, com BottomNav) e `(admin)` (role ADMIN, com AdminTopNav). Rotas de auth são públicas e sem layout de navegação. `/convite/[codigo]` é pública com redirect pós-auth via query string.
