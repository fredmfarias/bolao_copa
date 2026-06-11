import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApostaDrawer } from '@/components/ApostaDrawer';
import type { Jogo } from '@/types/api';

jest.mock('@/lib/api', () => ({
  api: { post: jest.fn().mockResolvedValue({}) },
}));

import { api } from '@/lib/api';
const mockPost = api.post as jest.Mock;

const selecao = (nome: string) => ({
  id: nome, nome, codigo: nome.slice(0, 3).toUpperCase(), bandeiraSvg: '<svg></svg>',
});

const jogo: Jogo = {
  id: 'j1', rodada: 1, grupo: 'A', fase: 'GRUPOS',
  placarCasa: null, placarVisitante: null, pesoPontuacao: 1, publicacaoId: null,
  dataHora: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
  selecaoCasa: selecao('Brasil'), selecaoVisitante: selecao('Argentina'),
};

const props = {
  jogo,
  aberto: true,
  onFechar: jest.fn(),
  onSalvo: jest.fn(),
};

beforeEach(() => {
  mockPost.mockClear();
  (props.onFechar as jest.Mock).mockClear();
  (props.onSalvo as jest.Mock).mockClear();
});

it('exibe códigos dos times quando aberto', () => {
  render(<ApostaDrawer {...props} />);
  expect(screen.getByText('BRA')).toBeInTheDocument();
  expect(screen.getByText('ARG')).toBeInTheDocument();
});

it('botão + incrementa placar da casa', () => {
  render(<ApostaDrawer {...props} />);
  const botoesMais = screen.getAllByRole('button', { name: '+' });
  fireEvent.click(botoesMais[0]);
  expect(screen.getByTestId('placar-casa')).toHaveTextContent('1');
});

it('botão − não decrementa abaixo de 0', () => {
  render(<ApostaDrawer {...props} />);
  const botoesMenos = screen.getAllByRole('button', { name: '−' });
  fireEvent.click(botoesMenos[0]);
  expect(screen.getByTestId('placar-casa')).toHaveTextContent('0');
});

it('Confirmar chama api.post com payload correto', async () => {
  render(<ApostaDrawer {...props} />);
  fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);
  fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);
  fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
  await waitFor(() => {
    expect(mockPost).toHaveBeenCalledWith('/apostas', {
      jogoId: 'j1', placarCasa: 2, placarVisitante: 0,
    });
  });
});

it('chama onSalvo e onFechar após confirmar', async () => {
  render(<ApostaDrawer {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
  await waitFor(() => {
    expect(props.onSalvo).toHaveBeenCalledTimes(1);
    expect(props.onFechar).toHaveBeenCalledTimes(1);
  });
});
