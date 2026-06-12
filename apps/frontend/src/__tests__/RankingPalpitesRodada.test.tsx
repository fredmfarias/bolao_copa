import { render, screen } from '@testing-library/react';
import { RankingPalpitesRodada } from '@/components/RankingPalpitesRodada';
import type { RodadaPalpiteItem } from '@/types/api';

const items: RodadaPalpiteItem[] = [
  {
    jogo: {
      id: 'j1', dataHora: new Date().toISOString(),
      pesoPontuacao: 2, placarCasa: 2, placarVisitante: 1,
      selecaoCasa:      { nome: 'Brasil',    codigo: 'BRA', bandeiraSvg: '<svg></svg>' },
      selecaoVisitante: { nome: 'Argentina', codigo: 'ARG', bandeiraSvg: '<svg></svg>' },
    },
    palpite: { placarCasa: 2, placarVisitante: 1 },
    pontuacao: 12,
  },
  {
    jogo: {
      id: 'j2', dataHora: new Date().toISOString(),
      pesoPontuacao: 1, placarCasa: 0, placarVisitante: 0,
      selecaoCasa:      { nome: 'Espanha', codigo: 'ESP', bandeiraSvg: '<svg></svg>' },
      selecaoVisitante: { nome: 'Portugal', codigo: 'POR', bandeiraSvg: '<svg></svg>' },
    },
    palpite: null,
    pontuacao: 0,
  },
];

it('renderiza siglas, palpite e pontuação por item', () => {
  render(<RankingPalpitesRodada items={items} />);
  expect(screen.getByText('BRA')).toBeInTheDocument();
  expect(screen.getByText('ARG')).toBeInTheDocument();
  expect(screen.getByText('2 × 1')).toBeInTheDocument();
  expect(screen.getByText(/Placar: 2 × 1/)).toBeInTheDocument();
  expect(screen.getByText('+12 pts')).toBeInTheDocument();
});

it('exibe "Sem palpite" e omite pontuação no item sem palpite', () => {
  render(<RankingPalpitesRodada items={items} />);
  expect(screen.getByText(/Sem palpite/)).toBeInTheDocument();
  expect(screen.queryByText('+0 pts')).not.toBeInTheDocument();
});

it('mostra peso ×N apenas quando ≠1', () => {
  render(<RankingPalpitesRodada items={items} />);
  expect(screen.getByText('×2')).toBeInTheDocument();
  expect(screen.queryByText('×1')).not.toBeInTheDocument();
});

it('renderiza mensagem quando lista vazia', () => {
  render(<RankingPalpitesRodada items={[]} />);
  expect(screen.getByText(/esta rodada não tem jogos/i)).toBeInTheDocument();
});
