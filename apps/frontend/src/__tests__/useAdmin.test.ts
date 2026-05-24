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
