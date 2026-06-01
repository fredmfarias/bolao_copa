import { render, screen } from '@testing-library/react';
import { BolaoCard } from '@/components/BolaoCard';

const mockBolao = {
  id: 'bolao-1',
  nome: 'Bolão Copa',
  descricao: 'Descrição do bolão',
  status: 'ATIVO' as const,
  precoReais: '20.00',
  _count: { membros: 5 },
  maxParticipantes: 20,
};

it('wrapper do card tem classe overflow-hidden', () => {
  const { container } = render(<BolaoCard bolao={mockBolao} href="/boloes/1" />);
  expect(container.firstElementChild).toHaveClass('overflow-hidden');
});

it('nome do bolão tem classe truncate', () => {
  render(<BolaoCard bolao={mockBolao} href="/boloes/1" />);
  expect(screen.getByText('Bolão Copa')).toHaveClass('truncate');
});
