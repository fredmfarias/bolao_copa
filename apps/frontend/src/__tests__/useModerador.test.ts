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
