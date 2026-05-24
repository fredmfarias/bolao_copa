import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PerfilPage from '@/app/(app)/perfil/page';

const mockPush = jest.fn();
const mockLogout = jest.fn().mockResolvedValue(undefined);

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/components/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  api: { patch: jest.fn().mockResolvedValue({}) },
}));

import { useAuth } from '@/components/AuthProvider';
const mockUseAuth = useAuth as jest.Mock;

beforeEach(() => {
  mockPush.mockClear();
  mockLogout.mockClear();
  mockUseAuth.mockReturnValue({
    user: { nome: 'Test User', email: 'test@test.com', role: 'USER', avatarUrl: null },
    refresh: jest.fn(),
    logout: mockLogout,
  });
});

it('exibe o botão Sair', () => {
  render(<PerfilPage />);
  expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
});

it('chama logout e redireciona para /login ao clicar em Sair', async () => {
  render(<PerfilPage />);
  fireEvent.click(screen.getByRole('button', { name: /sair/i }));
  await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'));
});

it('desabilita o botão e exibe "Saindo..." durante o logout', async () => {
  mockLogout.mockImplementation(
    () => new Promise(resolve => setTimeout(resolve, 100)),
  );
  render(<PerfilPage />);
  fireEvent.click(screen.getByRole('button', { name: /sair/i }));
  expect(screen.getByRole('button', { name: /saindo/i })).toBeDisabled();
});
