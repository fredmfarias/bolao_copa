import { render, screen, fireEvent } from '@testing-library/react';
import { FaseFilterChips } from '@/components/FaseFilterChips';

const FASES = ['Todos', 'GRUPOS', 'OITAVAS', 'FINAL'];

it('renderiza todos os chips com label legível', () => {
  render(<FaseFilterChips fases={FASES} selecionada="Todos" onChange={jest.fn()} />);
  expect(screen.getByText('Todos')).toBeInTheDocument();
  expect(screen.getByText('Grupos')).toBeInTheDocument();
  expect(screen.getByText('Oitavas')).toBeInTheDocument();
  expect(screen.getByText('Final')).toBeInTheDocument();
});

it('chip selecionado contém classe de destaque trovao-gold', () => {
  render(<FaseFilterChips fases={FASES} selecionada="GRUPOS" onChange={jest.fn()} />);
  const chip = screen.getByText('Grupos').closest('button');
  expect(chip?.className).toMatch(/trovao-gold/);
});

it('clique em chip chama onChange com o valor enum correto', () => {
  const onChange = jest.fn();
  render(<FaseFilterChips fases={FASES} selecionada="Todos" onChange={onChange} />);
  fireEvent.click(screen.getByText('Oitavas'));
  expect(onChange).toHaveBeenCalledWith('OITAVAS');
});
