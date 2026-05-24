# T105 — Hooks base: useAutoSave, useAdmin, useModerador

> **Módulo:** [M1 — Fundação](../modules/M1-fundacao.md)
> **Tamanho:** `M`
> **Status:** `pendente`
> **Depende de:** T101 concluído (jest configurado)

---

## O que fazer

Criar os três hooks utilitários usados pelos módulos seguintes: `useAutoSave` (debounce de salvamento), `useAdmin` (verifica role ADMIN), `useModerador` (verifica papel MODERADOR no bolão).

---

## Arquivos

| Ação | Caminho |
|---|---|
| Criar | `apps/frontend/src/hooks/useAutoSave.ts` |
| Criar | `apps/frontend/src/hooks/useAdmin.ts` |
| Criar | `apps/frontend/src/hooks/useModerador.ts` |
| Criar | `apps/frontend/src/__tests__/useAutoSave.test.ts` |
| Criar | `apps/frontend/src/__tests__/useAdmin.test.ts` |
| Criar | `apps/frontend/src/__tests__/useModerador.test.ts` |

---

## Passos

### useAutoSave

- [ ] **Passo 1: Escrever teste de useAutoSave (vai falhar)**

```typescript
// apps/frontend/src/__tests__/useAutoSave.test.ts
import { renderHook } from '@testing-library/react';
import { useAutoSave } from '@/hooks/useAutoSave';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('não chama onSave antes do delay', () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  renderHook(() => useAutoSave('dados', onSave, 1500));

  jest.advanceTimersByTime(1000);
  expect(onSave).not.toHaveBeenCalled();
});

it('chama onSave com os dados após o delay', () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  renderHook(() => useAutoSave('dados', onSave, 1500));

  jest.advanceTimersByTime(1500);
  expect(onSave).toHaveBeenCalledWith('dados');
  expect(onSave).toHaveBeenCalledTimes(1);
});

it('reseta o timer quando os dados mudam antes do delay', () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const { rerender } = renderHook(
    ({ data }) => useAutoSave(data, onSave, 1500),
    { initialProps: { data: 'v1' } }
  );

  jest.advanceTimersByTime(1000);
  rerender({ data: 'v2' });
  jest.advanceTimersByTime(1000);
  expect(onSave).not.toHaveBeenCalled();

  jest.advanceTimersByTime(500);
  expect(onSave).toHaveBeenCalledWith('v2');
  expect(onSave).toHaveBeenCalledTimes(1);
});
```

- [ ] **Passo 2: Implementar `useAutoSave`**

```typescript
// apps/frontend/src/hooks/useAutoSave.ts
import { useEffect, useRef } from 'react';

export function useAutoSave<T>(
  data: T,
  onSave: (data: T) => Promise<void>,
  delayMs = 1500
) {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    const timer = setTimeout(() => {
      onSaveRef.current(data);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [data, delayMs]);
}
```

- [ ] **Passo 3: Rodar teste de useAutoSave**

```bash
pnpm test --filter @bolao/frontend -- useAutoSave
```

Saída esperada: `PASS · 3 tests passed`

---

### useAdmin

- [ ] **Passo 4: Escrever teste de useAdmin (vai falhar)**

```typescript
// apps/frontend/src/__tests__/useAdmin.test.ts
import { renderHook } from '@testing-library/react';
import { useAdmin } from '@/hooks/useAdmin';

jest.mock('@/components/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '@/components/AuthProvider';
const mockUseAuth = useAuth as jest.Mock;

it('retorna isAdmin true para role ADMIN', () => {
  mockUseAuth.mockReturnValue({ user: { role: 'ADMIN' } });
  const { result } = renderHook(() => useAdmin());
  expect(result.current.isAdmin).toBe(true);
});

it('retorna isAdmin false para role USER', () => {
  mockUseAuth.mockReturnValue({ user: { role: 'USER' } });
  const { result } = renderHook(() => useAdmin());
  expect(result.current.isAdmin).toBe(false);
});

it('retorna isAdmin false quando não há usuário', () => {
  mockUseAuth.mockReturnValue({ user: null });
  const { result } = renderHook(() => useAdmin());
  expect(result.current.isAdmin).toBe(false);
});
```

- [ ] **Passo 5: Implementar `useAdmin`**

```typescript
// apps/frontend/src/hooks/useAdmin.ts
import { useAuth } from '@/components/AuthProvider';

export function useAdmin() {
  const { user } = useAuth();
  return { isAdmin: user?.role === 'ADMIN' };
}
```

- [ ] **Passo 6: Rodar teste de useAdmin**

```bash
pnpm test --filter @bolao/frontend -- useAdmin
```

Saída esperada: `PASS · 3 tests passed`

---

### useModerador

- [ ] **Passo 7: Escrever teste de useModerador (vai falhar)**

```typescript
// apps/frontend/src/__tests__/useModerador.test.ts
import { renderHook } from '@testing-library/react';
import { useModerador } from '@/hooks/useModerador';

jest.mock('@/components/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '@/components/AuthProvider';
const mockUseAuth = useAuth as jest.Mock;

const membros = [
  { usuarioId: 'user-1', papel: 'MODERADOR' as const },
  { usuarioId: 'user-2', papel: 'PARTICIPANTE' as const },
];

it('retorna isModerador true quando usuário é MODERADOR no bolão', () => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  const { result } = renderHook(() => useModerador(membros));
  expect(result.current.isModerador).toBe(true);
});

it('retorna isModerador false quando usuário é PARTICIPANTE', () => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-2' } });
  const { result } = renderHook(() => useModerador(membros));
  expect(result.current.isModerador).toBe(false);
});

it('retorna isModerador false quando usuário não está no bolão', () => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-99' } });
  const { result } = renderHook(() => useModerador(membros));
  expect(result.current.isModerador).toBe(false);
});
```

- [ ] **Passo 8: Implementar `useModerador`**

```typescript
// apps/frontend/src/hooks/useModerador.ts
import { useAuth } from '@/components/AuthProvider';

interface Membro {
  usuarioId: string;
  papel: 'MODERADOR' | 'PARTICIPANTE';
}

export function useModerador(membros: Membro[]) {
  const { user } = useAuth();
  const membro = membros.find(m => m.usuarioId === user?.id);
  return { isModerador: membro?.papel === 'MODERADOR' };
}
```

- [ ] **Passo 9: Rodar todos os testes do M1**

```bash
pnpm test --filter @bolao/frontend
```

Saída esperada: `PASS · todos os testes passam`

- [ ] **Passo 10: Validar build**

```bash
pnpm build --filter @bolao/frontend
```

- [ ] **Passo 11: Commit**

```bash
git add apps/frontend/src/hooks/ apps/frontend/src/__tests__/useAutoSave.test.ts \
  apps/frontend/src/__tests__/useAdmin.test.ts \
  apps/frontend/src/__tests__/useModerador.test.ts
git commit -m "feat(frontend): hooks base — useAutoSave, useAdmin, useModerador"
```

---

## Validação final

```bash
pnpm test --filter @bolao/frontend   # → todos os testes do M1 passam
pnpm build --filter @bolao/frontend  # → sem erros de tipo
```
