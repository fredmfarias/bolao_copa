import { render, screen } from '@testing-library/react';
import { RankingPodium } from '@/components/RankingPodium';
import type { RankingEntry } from '@/types/api';

const entry = (posicao: number, nome: string, pts: number, id = posicao.toString()): RankingEntry => ({
  id, usuarioId: id, posicao, posicoesGanhas: 0, pontuacaoTotal: pts, pontosMaximoPossiveis: 0,
  pontuacaoRodada: 0, pontosMaximoPossiveisRodada: 0,
  acertosPlacarExato: 0, acertosPlacarVencedor: 0, acertosPlacarPerdedor: 0,
  acertosEmpate: 0, acertosGanhador: 0, acertosNada: 0, apostasPostadas: 0,
  usuario: { id, nome, avatarUrl: null },
});

const ranking = [entry(1, 'Alice', 100, 'u1'), entry(2, 'Bob', 80, 'u2'), entry(3, 'Carol', 60, 'u3')];

it('exibe os três nomes do pódio', () => {
  render(<RankingPodium ranking={ranking} />);
  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.getByText('Bob')).toBeInTheDocument();
  expect(screen.getByText('Carol')).toBeInTheDocument();
});

it('exibe as pontuações', () => {
  render(<RankingPodium ranking={ranking} />);
  expect(screen.getByText('100')).toBeInTheDocument();
  expect(screen.getByText('80')).toBeInTheDocument();
  expect(screen.getByText('60')).toBeInTheDocument();
});

it('destaca o usuário logado com classe ouro', () => {
  render(<RankingPodium ranking={ranking} myId="u2" />);
  const el = screen.getByText('Bob').closest('[data-my]');
  expect(el).toBeInTheDocument();
});

it('não renderiza quando ranking está vazio', () => {
  const { container } = render(<RankingPodium ranking={[]} />);
  expect(container.firstChild).toBeNull();
});

it('aplica scale-110 apenas no 1º lugar', () => {
  const { container } = render(<RankingPodium ranking={ranking} />);
  const scaled = container.querySelectorAll('[class*="scale-110"]');
  expect(scaled).toHaveLength(1);
  expect(scaled[0]).toHaveTextContent('Alice');
});
