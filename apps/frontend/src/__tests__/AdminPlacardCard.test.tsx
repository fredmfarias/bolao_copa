import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminPlacardCard } from '@/components/AdminPlacardCard';
import type { Jogo } from '@/types/api';

jest.mock('@/lib/api', () => ({ api: { patch: jest.fn().mockResolvedValue({}) } }));
import { api } from '@/lib/api';
const mockPatch = api.patch as jest.Mock;

const selecao = (nome: string) => ({ id: nome, nome, codigo: nome.slice(0, 3).toUpperCase(), bandeiraSvg: '<svg/>' });

const jogo: Jogo = {
  id: 'j1', rodada: 1, grupo: 'A', fase: 'GRUPOS',
  placarCasa: null, placarVisitante: null, pesoPontuacao: 1,
  dataHora: new Date().toISOString(),
  selecaoCasa: selecao('Brasil'), selecaoVisitante: selecao('Argentina'),
};

beforeEach(() => mockPatch.mockClear());

it('exibe nomes das seleções', () => {
  render(<AdminPlacardCard jogo={jogo} onSalvo={jest.fn()} />);
  expect(screen.getByText('BRA')).toBeInTheDocument();
  expect(screen.getByText('ARG')).toBeInTheDocument();
});

it('chama PATCH com placar correto ao salvar', async () => {
  render(<AdminPlacardCard jogo={jogo} onSalvo={jest.fn()} />);
  fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);
  fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);
  fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
  await waitFor(() => {
    expect(mockPatch).toHaveBeenCalledWith('/jogos/j1/placar', { placarCasa: 2, placarVisitante: 0 });
  });
});

it('chama onSalvo após sucesso', async () => {
  const onSalvo = jest.fn();
  render(<AdminPlacardCard jogo={jogo} onSalvo={onSalvo} />);
  fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
  await waitFor(() => expect(onSalvo).toHaveBeenCalledTimes(1));
});
