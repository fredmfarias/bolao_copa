import { render, screen } from '@testing-library/react';
import { AdminTopNav } from '@/components/AdminTopNav';

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin/boloes',
}));

it('renderiza link de volta ao app apontando para /jogos', () => {
  render(<AdminTopNav />);
  const link = screen.getByRole('link', { name: /app/i });
  expect(link).toHaveAttribute('href', '/jogos');
});

it('destaca o link de nav ativo com bg-trovao-gold', () => {
  render(<AdminTopNav />);
  const boloes = screen.getByRole('link', { name: 'Bolões' });
  expect(boloes).toHaveClass('bg-trovao-gold');
});

it('links de nav não ativos não têm bg-trovao-gold', () => {
  render(<AdminTopNav />);
  const placares = screen.getByRole('link', { name: 'Placares' });
  expect(placares).not.toHaveClass('bg-trovao-gold');
});
