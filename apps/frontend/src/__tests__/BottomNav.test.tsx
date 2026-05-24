import { render, screen } from '@testing-library/react';
import { BottomNav } from '@/components/BottomNav';

jest.mock('next/navigation', () => ({
  usePathname: () => '/jogos',
}));

it('renderiza os 4 itens de navegação', () => {
  render(<BottomNav />);
  expect(screen.getByText('Jogos')).toBeInTheDocument();
  expect(screen.getByText('Bolões')).toBeInTheDocument();
  expect(screen.getByText('Ranking')).toBeInTheDocument();
  expect(screen.getByText('Perfil')).toBeInTheDocument();
});

it('marca o item ativo quando pathname bate', () => {
  render(<BottomNav />);
  const jogosLink = screen.getByText('Jogos').closest('a');
  expect(jogosLink).toHaveClass('text-trovao-gold');
});
