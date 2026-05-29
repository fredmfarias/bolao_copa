import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RankingRow } from '@/components/RankingRow';
import type { RankingEntry } from '@/types/api';

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));

// Recharts usa ResizeObserver; mock para jsdom.
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  } as any;
});

import { api } from '@/lib/api';
const mockGet = api.get as jest.Mock;

beforeEach(() => {
  mockGet.mockClear();
  mockGet.mockResolvedValue([]);
});

const entry: RankingEntry = {
  id: 'r1', usuarioId: 'u1', posicao: 4, posicoesGanhas: 0,
  pontuacaoTotal: 55, pontuacaoRodada: 0,
  acertosPlacarExato: 3, acertosPlacarVencedor: 5, acertosPlacarPerdedor: 4,
  acertosEmpate: 1, acertosGanhador: 2, acertosNada: 0, apostasPostadas: 11,
  usuario: { id: 'u1', nome: 'Diego', avatarUrl: null },
};

it('exibe posição, nome e pontuação', () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  expect(screen.getByText('4º')).toBeInTheDocument();
  expect(screen.getByText('Diego')).toBeInTheDocument();
  expect(screen.getByText('55')).toBeInTheDocument();
});

it('estatísticas ficam ocultas inicialmente', () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  expect(screen.queryByText('Placar exato')).not.toBeInTheDocument();
});

it('expande para mostrar os 6 itens do grid ao clicar', async () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Placar exato')).toBeInTheDocument();
  expect(screen.getByText('Placar do vencedor correto')).toBeInTheDocument();
  expect(screen.getByText('Empate correto (sem placar exato)')).toBeInTheDocument();
  expect(screen.getByText('Placar do perdedor correto')).toBeInTheDocument();
  expect(screen.getByText('Acertou apenas o vencedor')).toBeInTheDocument();
  expect(screen.getByText('Acertou nada')).toBeInTheDocument();
});

it('exibe os valores corretos dos acertos no grid', async () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button'));
  // acertosPlacarExato=3, acertosPlacarVencedor=5, acertosPlacarPerdedor=4,
  // acertosEmpate=1, acertosGanhador=2, acertosNada=0
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getByText('5')).toBeInTheDocument();
  expect(screen.getByText('4')).toBeInTheDocument();
  expect(screen.getByText('1')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
  expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1);
});

it('destaca o usuário atual com cor ouro', () => {
  render(<RankingRow entry={entry} myId="u1" bolaoId="b1" />);
  expect(screen.getByText('Diego').className).toMatch(/trovao-gold/);
});

it('busca evolução com o usuarioId correto ao expandir', async () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => {
    expect(mockGet).toHaveBeenCalledWith(
      '/boloes/b1/ranking/evolucao?usuarioId=u1',
    );
  });
});

it('não repete a busca de evolução ao reabrir a linha', async () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button')); // abre
  await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button')); // fecha
  fireEvent.click(screen.getByRole('button')); // reabre
  expect(mockGet).toHaveBeenCalledTimes(1);    // não chamou de novo
});

it('exibe o gráfico de evolução quando há dados', async () => {
  mockGet.mockResolvedValueOnce([
    { numero: 1, posicao: 3 },
    { numero: 2, posicao: 2 },
  ]);
  const { container } = render(<RankingRow entry={entry} bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => {
    expect(container.querySelector('.recharts-responsive-container')).toBeTruthy();
  });
});

it('não exibe gráfico quando evolução está vazia', async () => {
  mockGet.mockResolvedValueOnce([]);
  const { container } = render(<RankingRow entry={entry} bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
  expect(container.querySelector('.recharts-responsive-container')).toBeFalsy();
});

it('quando posicaoRodada é fornecida, exibe "Nª (P Mª)"', () => {
  render(<RankingRow entry={entry} bolaoId="b1" posicaoRodada={1} publicacaoNumero={3} />);
  expect(screen.getByText('1º')).toBeInTheDocument();
  expect(screen.getByText('(P 4º)')).toBeInTheDocument();
});

it('com publicacaoNumero ao expandir, busca palpites em vez de evolução', async () => {
  mockGet.mockResolvedValueOnce([]); // resposta dos palpites
  render(<RankingRow entry={entry} bolaoId="b1" posicaoRodada={1} publicacaoNumero={3} />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => {
    expect(mockGet).toHaveBeenCalledWith(
      '/boloes/b1/ranking/publicacoes/3/usuarios/u1/apostas',
    );
  });
  expect(screen.queryByText('Placar exato')).not.toBeInTheDocument();
});

it('sem publicacaoNumero, expand mostra contadores (comportamento atual)', async () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Placar exato')).toBeInTheDocument();
});
