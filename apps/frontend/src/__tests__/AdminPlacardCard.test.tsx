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

const jogoPublicado: Jogo = { ...jogo, placarCasa: 2, placarVisitante: 1 };

beforeEach(() => mockPatch.mockClear());

it('exibe nomes das seleções', () => {
  render(<AdminPlacardCard jogo={jogo} onSalvo={jest.fn()} />);
  expect(screen.getByText('BRA')).toBeInTheDocument();
  expect(screen.getByText('ARG')).toBeInTheDocument();
});

it('mostra "-" em cada placar quando ainda não publicado', () => {
  render(<AdminPlacardCard jogo={jogo} onSalvo={jest.fn()} />);
  expect(screen.getAllByText('-')).toHaveLength(2);
});

it('desabilita Salvar enquanto algum lado for nulo', () => {
  render(<AdminPlacardCard jogo={jogo} onSalvo={jest.fn()} />);
  const botaoSalvar = screen.getByRole('button', { name: /salvar/i });
  expect(botaoSalvar).toBeDisabled();
  fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);
  expect(botaoSalvar).toBeDisabled();
  fireEvent.click(screen.getAllByRole('button', { name: '+' })[1]);
  expect(botaoSalvar).toBeEnabled();
});

it('primeiro + revela 0; segundo + vai pra 1; − em 0 volta pra "-"', () => {
  render(<AdminPlacardCard jogo={jogo} onSalvo={jest.fn()} />);
  const maisCasa = screen.getAllByRole('button', { name: '+' })[0];
  const menosCasa = screen.getAllByRole('button', { name: '−' })[0];
  fireEvent.click(maisCasa);
  expect(screen.getAllByText('0')).toHaveLength(1);
  fireEvent.click(maisCasa);
  expect(screen.getByText('1')).toBeInTheDocument();
  fireEvent.click(menosCasa);
  fireEvent.click(menosCasa);
  expect(screen.getAllByText('-')).toHaveLength(2);
});

it('chama PATCH com placar correto ao salvar', async () => {
  render(<AdminPlacardCard jogo={jogo} onSalvo={jest.fn()} />);
  fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);
  fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);
  fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);
  fireEvent.click(screen.getAllByRole('button', { name: '+' })[1]);
  fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
  await waitFor(() => {
    expect(mockPatch).toHaveBeenCalledWith('/jogos/j1/placar', { placarCasa: 2, placarVisitante: 0 });
  });
});

it('chama onSalvo após sucesso', async () => {
  const onSalvo = jest.fn();
  render(<AdminPlacardCard jogo={jogoPublicado} onSalvo={onSalvo} />);
  fireEvent.click(screen.getByRole('button', { name: /atualizar/i }));
  await waitFor(() => expect(onSalvo).toHaveBeenCalledTimes(1));
});

it('mostra badge Publicado e botão Atualizar quando placar já existe', () => {
  render(<AdminPlacardCard jogo={jogoPublicado} onSalvo={jest.fn()} />);
  expect(screen.getByText('Publicado')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /atualizar/i })).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
  expect(screen.getByText('1')).toBeInTheDocument();
});
