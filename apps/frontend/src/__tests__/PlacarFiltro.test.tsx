import { render, screen, fireEvent } from '@testing-library/react';
import { PlacarFiltro } from '@/components/PlacarFiltro';
import type { Palpite } from '@/types/api';

let seq = 0;
const mk = (casa: number, visitante: number): Palpite => ({
  usuarioId: `u${seq++}`, nome: 'X', avatarUrl: null,
  placarCasa: casa, placarVisitante: visitante, pontuacao: null,
  palpiteAtualizadoEm: '2026-06-11T12:00:00.000Z',
});

it('não renderiza com 0 ou 1 placar distinto', () => {
  const { container } = render(
    <PlacarFiltro palpites={[mk(2, 1), mk(2, 1)]} value={null} onChange={() => {}} />,
  );
  expect(container.firstChild).toBeNull();
});

it('exibe chip Todos e um chip por placar com contagem', () => {
  render(
    <PlacarFiltro palpites={[mk(2, 1), mk(2, 1), mk(1, 0)]} value={null} onChange={() => {}} />,
  );
  expect(screen.getByText('Todos')).toBeInTheDocument();
  expect(screen.getByText('2 × 1')).toBeInTheDocument();
  expect(screen.getByText('· 2')).toBeInTheDocument();
  expect(screen.getByText('1 × 0')).toBeInTheDocument();
});

it('chama onChange com a key ao clicar num placar', () => {
  const onChange = jest.fn();
  render(<PlacarFiltro palpites={[mk(2, 1), mk(1, 0)]} value={null} onChange={onChange} />);
  fireEvent.click(screen.getByText('1 × 0'));
  expect(onChange).toHaveBeenCalledWith('1x0');
});

it('chama onChange com null ao clicar em Todos', () => {
  const onChange = jest.fn();
  render(<PlacarFiltro palpites={[mk(2, 1), mk(1, 0)]} value="2x1" onChange={onChange} />);
  fireEvent.click(screen.getByText('Todos'));
  expect(onChange).toHaveBeenCalledWith(null);
});
