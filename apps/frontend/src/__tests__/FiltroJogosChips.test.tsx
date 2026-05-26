import { render, screen, fireEvent } from '@testing-library/react';
import { FiltroJogosChips } from '@/components/FiltroJogosChips';

it('renderiza os 4 filtros com rótulos legíveis', () => {
  render(<FiltroJogosChips selecionada="Todos" onChange={jest.fn()} />);
  expect(screen.getByText('Todos')).toBeInTheDocument();
  expect(screen.getByText('Pendentes de aposta')).toBeInTheDocument();
  expect(screen.getByText('Apostados')).toBeInTheDocument();
  expect(screen.getByText('Encerrados')).toBeInTheDocument();
});

it('chip selecionado tem destaque trovao-gold', () => {
  render(<FiltroJogosChips selecionada="Pendentes" onChange={jest.fn()} />);
  const chip = screen.getByText('Pendentes de aposta').closest('button');
  expect(chip?.className).toMatch(/trovao-gold/);
});

it('clique chama onChange com a chave do filtro', () => {
  const onChange = jest.fn();
  render(<FiltroJogosChips selecionada="Todos" onChange={onChange} />);
  fireEvent.click(screen.getByText('Encerrados'));
  expect(onChange).toHaveBeenCalledWith('Encerrados');
});
