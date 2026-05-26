import { render, screen } from '@testing-library/react';
import { BottomNav } from '@/components/BottomNav';

jest.mock('next/navigation', () => ({
  usePathname: () => '/jogos',
}));

jest.mock('@/components/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '@/components/AuthProvider';
const mockUseAuth = useAuth as jest.Mock;

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { role: 'USER' } });
});

it('renderiza os 4 itens de navegação para usuário comum', () => {
  render(<BottomNav />);
  expect(screen.getByText('Jogos')).toBeInTheDocument();
  expect(screen.getByText('Bolões')).toBeInTheDocument();
  expect(screen.getByText('Ranking')).toBeInTheDocument();
  expect(screen.getByText('Perfil')).toBeInTheDocument();
  expect(screen.queryByText('Admin')).not.toBeInTheDocument();
});

it('marca o item ativo quando pathname bate', () => {
  render(<BottomNav />);
  const jogosLink = screen.getByText('Jogos').closest('a');
  expect(jogosLink).toHaveClass('text-trovao-gold');
});

it('exibe item Admin somente para usuários ADMIN', () => {
  mockUseAuth.mockReturnValue({ user: { role: 'ADMIN' } });
  render(<BottomNav />);
  expect(screen.getByText('Admin')).toBeInTheDocument();
  const adminLink = screen.getByText('Admin').closest('a');
  expect(adminLink).toHaveAttribute('href', '/admin/boloes');
});

it('não exibe item Admin quando user é null', () => {
  mockUseAuth.mockReturnValue({ user: null });
  render(<BottomNav />);
  expect(screen.queryByText('Admin')).not.toBeInTheDocument();
});
