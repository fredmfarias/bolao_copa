import { render, screen, fireEvent } from '@testing-library/react';
import { JogoCard } from '@/components/JogoCard';
import type { Jogo, Aposta } from '@/types/api';

const selecao = (nome: string) => ({
  id: nome, nome, codigo: nome.slice(0, 3).toUpperCase(), bandeiraSvg: '<svg></svg>',
});

const HORA_FUTURA = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
const HORA_PASSADA = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
const ATUALIZADO = new Date(2026, 5, 11, 13, 45, 25).toISOString();

const jogoBase: Jogo = {
  id: 'j1', rodada: 1, grupo: 'A', fase: 'GRUPOS',
  placarCasa: null, placarVisitante: null, pesoPontuacao: 1,
  selecaoCasa: selecao('Brasil'), selecaoVisitante: selecao('Argentina'),
  dataHora: HORA_FUTURA,
};

const apostaExemplo: Aposta = {
  id: 'a1', jogoId: 'j1',
  placarCasa: 2, placarVisitante: 1, pontuacao: null,
  atualizadoEm: ATUALIZADO, jogo: jogoBase,
};

it('aberto — mostra botão Apostar, palpite vazio, sem data', () => {
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA }} onApostar={jest.fn()} />);
  expect(screen.getByRole('button', { name: /apostar/i })).toBeInTheDocument();
  expect(screen.getByText('— : —')).toBeInTheDocument();
  expect(screen.queryByText('11/06/2026 13:45:25')).not.toBeInTheDocument();
  expect(screen.queryByText(/aposte agora/i)).not.toBeInTheDocument();
});

it('salvo — palpite central, data/hora da aposta e botão Editar', () => {
  render(
    <JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA }} aposta={apostaExemplo} onApostar={jest.fn()} />
  );
  expect(screen.getByText('Palpite')).toBeInTheDocument();
  expect(screen.getByText('2 : 1')).toBeInTheDocument();
  expect(screen.getByText('11/06/2026 13:45:25')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
});

it('incompleto — sem botão, sem texto "prazo encerrado"', () => {
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_PASSADA }} onApostar={jest.fn()} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByText(/prazo encerrado/i)).not.toBeInTheDocument();
  expect(screen.getByText('— : —')).toBeInTheDocument();
});

it('fechado com resultado — rodapé "Placar" com placar real e pontuação', () => {
  const jogoComPlacar = { ...jogoBase, dataHora: HORA_PASSADA, placarCasa: 1, placarVisitante: 1 };
  const apostaPontuada = { ...apostaExemplo, jogo: jogoComPlacar, pontuacao: 5 };
  render(<JogoCard jogo={jogoComPlacar} aposta={apostaPontuada} onApostar={jest.fn()} />);
  expect(screen.getByText('Placar:')).toBeInTheDocument();
  expect(screen.getByText('1 × 1')).toBeInTheDocument();
  expect(screen.getByText('+5 pts')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('sem resultado — não mostra rodapé "Placar"', () => {
  render(
    <JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA }} aposta={apostaExemplo} onApostar={jest.fn()} />
  );
  expect(screen.queryByText('Placar:')).not.toBeInTheDocument();
});

it('chama onApostar ao clicar no botão', () => {
  const onApostar = jest.fn();
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA }} onApostar={onApostar} />);
  fireEvent.click(screen.getByRole('button', { name: /apostar/i }));
  expect(onApostar).toHaveBeenCalledTimes(1);
});

it('exibe título com nomes completos das seleções', () => {
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA }} onApostar={jest.fn()} />);
  expect(screen.getByText('Brasil × Argentina')).toBeInTheDocument();
});

it('mantém as siglas sob os avatares', () => {
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA }} onApostar={jest.fn()} />);
  expect(screen.getByText('BRA')).toBeInTheDocument();
  expect(screen.getByText('ARG')).toBeInTheDocument();
});

it('peso 1 — badge ×1 discreto (muted, sem destaque dourado)', () => {
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA, pesoPontuacao: 1 }} onApostar={jest.fn()} />);
  const badge = screen.getByText('×1');
  expect(badge.className).toMatch(/trovao-muted/);
  expect(badge.className).not.toMatch(/trovao-gold/);
});

it('peso > 1 — badge ×2 com destaque dourado', () => {
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA, pesoPontuacao: 2 }} onApostar={jest.fn()} />);
  const badge = screen.getByText('×2');
  expect(badge.className).toMatch(/trovao-gold/);
});
