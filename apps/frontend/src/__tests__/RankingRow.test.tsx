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
  pontuacaoTotal: 55, pontosMaximoPossiveis: 100, pontuacaoRodada: 0, pontosMaximoPossiveisRodada: 0,
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

describe('destaque metálico do top 5', () => {
  const comPosicao = (posicao: number): RankingEntry => ({ ...entry, posicao });

  it.each([
    [1, 'gold'],
    [2, 'silver'],
    [3, 'bronze'],
  ])('posição %iº usa a cor %s na borda e no número', (posicao, metal) => {
    const { container } = render(<RankingRow entry={comPosicao(posicao)} bolaoId="b1" />);
    expect((container.firstChild as HTMLElement).className).toMatch(`border-trovao-${metal}`);
    expect(screen.getByText(`${posicao}º`).className).toMatch(`text-trovao-${metal}`);
  });

  it.each([4, 5])('posição %iº é um degradê esmaecido do bronze (cor com opacidade)', (posicao) => {
    const { container } = render(<RankingRow entry={comPosicao(posicao)} bolaoId="b1" />);
    expect((container.firstChild as HTMLElement).className).toMatch('border-trovao-bronze/');
    expect(screen.getByText(`${posicao}º`).className).toMatch('text-trovao-bronze/');
  });

  it('posição fora do top 5 não recebe cor metálica', () => {
    const { container } = render(<RankingRow entry={comPosicao(6)} bolaoId="b1" />);
    expect((container.firstChild as HTMLElement).className).toMatch('border-trovao-border');
    expect(screen.getByText('6º').className).toMatch('text-trovao-muted');
  });

  it('o usuário logado no top 5 ganha um ring sobre a cor da posição', () => {
    const { container } = render(<RankingRow entry={comPosicao(2)} myId="u1" bolaoId="b1" />);
    const root = (container.firstChild as HTMLElement).className;
    expect(root).toMatch('border-trovao-silver');
    expect(root).toMatch('ring-trovao-gold');
  });

  it('na rodada, o metal segue a posicaoRodada e não a posição geral', () => {
    // posição geral 4 (cobre), mas posicaoRodada 1 deve render ouro
    render(<RankingRow entry={comPosicao(4)} bolaoId="b1" posicaoRodada={1} publicacaoNumero={3} />);
    expect(screen.getByText('1º').className).toMatch('text-trovao-gold');
  });
});

it('exibe a quantidade de apostas realizadas ao expandir no modo geral', () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText(/Apostas realizadas:/)).toBeInTheDocument();
  expect(screen.getByText(/Apostas realizadas:/).parentElement).toHaveTextContent('11');
});

it('exibe link para os palpites do usuário no modo geral', () => {
  render(<RankingRow entry={entry} bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button'));
  const link = screen.getByRole('link', { name: /ver palpites/i });
  expect(link).toHaveAttribute('href', '/ranking/b1/usuarios/u1/palpites');
});

it('não exibe o link de palpites no modo rodada', () => {
  render(<RankingRow entry={entry} bolaoId="b1" posicaoRodada={1} publicacaoNumero={3} />);
  fireEvent.click(screen.getByRole('button'));
  expect(screen.queryByRole('link', { name: /ver palpites/i })).not.toBeInTheDocument();
});
