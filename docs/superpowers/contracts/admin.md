# Contrato — Admin

> **Produzido em:** M4 — Admin
> **Necessário para:** M5 — Bolão/Convite (referência de padrão de guards e layout)

---

## Localização

| Componente/Arquivo | Responsabilidade |
|---|---|
| `apps/frontend/src/app/(admin)/layout.tsx` | Guard: redireciona não-ADMIN para `/jogos` |
| `apps/frontend/src/components/AdminTopNav.tsx` | Navegação entre seções admin |
| `apps/frontend/src/components/AdminPlacardCard.tsx` | Edição de placar com steppers |
| `apps/frontend/src/components/AdminRankingPreview.tsx` | Preview draft + publicar ranking |
| `apps/frontend/src/components/AdminUsuarioRow.tsx` | Toggle papel ADMIN/USER |
| `apps/backend/src/admin/admin.controller.ts` | 4 rotas `/admin/*` com `@Roles(Role.ADMIN)` |
| `apps/backend/src/admin/admin.service.ts` | Lógica de draft, publicar, listar/atualizar usuários |

---

## Rotas backend

| Método | Rota | Ação |
|---|---|---|
| `GET` | `/admin/ranking/:bolaoId/draft` | Recalcula ranking sem persistir |
| `POST` | `/admin/ranking/:bolaoId/publicar` | Persiste ranking calculado |
| `GET` | `/admin/usuarios` | Lista todos os usuários |
| `PATCH` | `/admin/usuarios/:id` | Atualiza `role` do usuário |

---

## Interfaces públicas dos componentes

```typescript
interface AdminPlacardCardProps {
  jogo: Jogo;
  onSalvo: () => void;
}

interface AdminRankingPreviewProps {
  bolaoId: string;
}

interface AdminUsuarioRowProps {
  usuario: Usuario;
  onAtualizado: () => void;
}
```

---

## Guard de acesso (frontend)

`(admin)/layout.tsx` usa `useAuth()` + `useRouter()`:
```typescript
if (!loading && user?.role !== 'ADMIN') router.replace('/jogos');
```

---

## Guard de acesso (backend)

Todo controller admin usa dois guards em cascata:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
```

---

## Padrão stepper

Usado em `AdminPlacardCard` (e `ApostaDrawer`):
- `aria-label="+"` / `aria-label="−"`
- `Math.max(0, value - 1)` para impedir negativos
- Chama endpoint PATCH ao confirmar, não ao incrementar

---

## Dependências internas

- `Jogo`, `Usuario`, `RankingEntry` de `@/types/api`
- `JwtAuthGuard`, `RolesGuard`, `Roles` do comum do backend
