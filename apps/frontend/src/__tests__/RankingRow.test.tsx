import { render, screen, fireEvent } from '@testing-library/react';
import { RankingRow } from '@/components/RankingRow';
import type { RankingEntry } from '@/types/api';

const entry: RankingEntry = {
  id: 'r1', usuarioId: 'u1', posicao: 4, posicoesGanhas: 0,
  pontuacaoTotal: 55, pontuacaoRodada: 0,
  acertosPlacarExato: 3, acertosPlacarVencedor: 5, acertosPlacarPerdedor: 0,
  acertosEmpate: 1, acertosGanhador: 2, acertosNada: 0, apostasPostadas: 11,
  usuario: { id: 'u1', nome: 'Diego', avatarUrl: null },
};

it('exibe posição, nome e pontuação', () => {
  render(<RankingRow entry={entry} />);
  expect(screen.getByText('4º')).toBeInTheDocument();
  expect(screen.getByText('Diego')).toBeInTheDocument();
  expect(screen.getByText('55')).toBeInTheDocument();
});

it('estatísticas ficam ocultas inicialmente', () => {
  render(<RankingRow entry={entry} />);
  expect(screen.queryByText('Placar exato')).not.toBeInTheDocument();
});

it('expande para mostrar estatísticas ao clicar', () => {
  render(<RankingRow entry={entry} />);
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Placar exato')).toBeInTheDocument();
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getByText('11')).toBeInTheDocument();
});

it('destaca o usuário atual com cor ouro', () => {
  render(<RankingRow entry={entry} myId="u1" />);
  expect(screen.getByText('Diego').className).toMatch(/trovao-gold/);
});
