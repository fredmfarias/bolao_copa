import { render, screen, fireEvent } from '@testing-library/react';
import { JogoCard } from '@/components/JogoCard';
import type { Jogo, Aposta } from '@/types/api';

const selecao = (nome: string) => ({
  id: nome, nome, codigo: nome.slice(0, 3).toUpperCase(), bandeiraSvg: '<svg></svg>',
});

const HORA_FUTURA = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
const HORA_PASSADA = new Date(Date.now() - 2 * 3600 * 1000).toISOString();

const jogoBase: Jogo = {
  id: 'j1', rodada: 1, grupo: 'A', fase: 'GRUPOS',
  placarCasa: null, placarVisitante: null, pesoPontuacao: 1,
  selecaoCasa: selecao('Brasil'), selecaoVisitante: selecao('Argentina'),
  dataHora: HORA_FUTURA,
};

const apostaExemplo: Aposta = {
  id: 'a1', jogoId: 'j1',
  placarCasa: 2, placarVisitante: 1, pontuacao: null,
  jogo: jogoBase,
};

it('estado aberto — mostra botão Apostar, sem palpite', () => {
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA }} onApostar={jest.fn()} />);
  expect(screen.getByRole('button', { name: /apostar/i })).toBeInTheDocument();
  expect(screen.queryByText(/seu palpite/i)).not.toBeInTheDocument();
});

it('estado salvo — mostra palpite e botão Editar', () => {
  render(
    <JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA }} aposta={apostaExemplo} onApostar={jest.fn()} />
  );
  expect(screen.getByText('Seu palpite:')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
});

it('estado incompleto — mostra prazo encerrado, sem botão', () => {
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_PASSADA }} onApostar={jest.fn()} />);
  expect(screen.getByText(/prazo encerrado/i)).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('estado fechado — mostra palpite, sem botão', () => {
  render(
    <JogoCard jogo={{ ...jogoBase, dataHora: HORA_PASSADA }} aposta={apostaExemplo} onApostar={jest.fn()} />
  );
  expect(screen.getByText('Seu palpite:')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('chama onApostar ao clicar no botão', () => {
  const onApostar = jest.fn();
  render(<JogoCard jogo={{ ...jogoBase, dataHora: HORA_FUTURA }} onApostar={onApostar} />);
  fireEvent.click(screen.getByRole('button', { name: /apostar/i }));
  expect(onApostar).toHaveBeenCalledTimes(1);
});
