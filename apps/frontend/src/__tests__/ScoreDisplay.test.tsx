import { render, screen } from '@testing-library/react';
import { ScoreDisplay } from '@/components/ScoreDisplay';

it('mostra traço quando não há placar', () => {
  render(<ScoreDisplay placarCasa={null} placarVisitante={null} />);
  expect(screen.getByText('— : —')).toBeInTheDocument();
});

it('mostra o placar quando ambos os valores existem', () => {
  render(<ScoreDisplay placarCasa={2} placarVisitante={1} />);
  expect(screen.getByText('2 : 1')).toBeInTheDocument();
});

it('mostra traço quando apenas um lado tem placar', () => {
  render(<ScoreDisplay placarCasa={0} placarVisitante={null} />);
  expect(screen.getByText('— : —')).toBeInTheDocument();
});
