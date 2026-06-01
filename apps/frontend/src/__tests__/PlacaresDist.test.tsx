import { render, screen, fireEvent } from '@testing-library/react';
import { PlacaresDist } from '@/components/PlacaresDist';
import type { Aposta, Jogo } from '@/types/api';

const selecao = (nome: string) => ({
  id: nome, nome, codigo: nome.slice(0, 3).toUpperCase(), bandeiraSvg: '<svg></svg>',
});

const HORA_FUTURA  = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
const HORA_PASSADA = new Date(Date.now() - 2 * 3600 * 1000).toISOString();

function makeJogo(overrides: Partial<Jogo> = {}): Jogo {
  return {
    id: 'j1', dataHora: HORA_FUTURA, rodada: 1, grupo: null, fase: 'GRUPOS',
    placarCasa: null, placarVisitante: null, pesoPontuacao: 1,
    selecaoCasa: selecao('Brasil'), selecaoVisitante: selecao('Argentina'),
    ...overrides,
  };
}

function makeAposta(overrides: Partial<Aposta> = {}): Aposta {
  return {
    id: 'a1', jogoId: 'j1', placarCasa: 1, placarVisitante: 0,
    pontuacao: null, atualizadoEm: new Date().toISOString(),
    jogo: makeJogo(),
    ...overrides,
  };
}

it('mostra EmptyState quando não há apostas em grupos', () => {
  render(<PlacaresDist apostas={[]} onApostar={jest.fn()} />);
  expect(screen.getAllByText(/nenhum palpite/i).length).toBeGreaterThan(0);
});

it('exibe seções Fase de Grupos e Fases Eliminatórias', () => {
  render(<PlacaresDist apostas={[]} onApostar={jest.fn()} />);
  expect(screen.getByText('Fase de Grupos')).toBeInTheDocument();
  expect(screen.getByText('Fases Eliminatórias')).toBeInTheDocument();
});

it('exibe o limite correto de cada fase', () => {
  render(<PlacaresDist apostas={[]} onApostar={jest.fn()} />);
  expect(screen.getByText(/limite: 18 apostas idênticas/i)).toBeInTheDocument();
  expect(screen.getByText(/limite: 8 apostas idênticas/i)).toBeInTheDocument();
});

it('aposta de GRUPOS aparece na seção de Grupos', () => {
  const aposta = makeAposta({ id: 'a1', placarCasa: 2, placarVisitante: 0 });
  render(<PlacaresDist apostas={[aposta]} onApostar={jest.fn()} />);
  expect(screen.getByText('2 × 0')).toBeInTheDocument();
  expect(screen.getByText('1/18')).toBeInTheDocument();
});

it('aposta de OITAVAS aparece na seção Eliminatórias', () => {
  const aposta = makeAposta({
    id: 'a2', placarCasa: 1, placarVisitante: 1,
    jogo: makeJogo({ fase: 'OITAVAS' }),
  });
  render(<PlacaresDist apostas={[aposta]} onApostar={jest.fn()} />);
  expect(screen.getByText('1 × 1')).toBeInTheDocument();
  expect(screen.getByText('1/8')).toBeInTheDocument();
});

it('duas apostas com mesmo placar agrupam e mostram contagem 2', () => {
  const a1 = makeAposta({ id: 'a1', jogoId: 'j1', jogo: makeJogo({ id: 'j1' }) });
  const a2 = makeAposta({ id: 'a2', jogoId: 'j2', jogo: makeJogo({ id: 'j2' }) });
  render(<PlacaresDist apostas={[a1, a2]} onApostar={jest.fn()} />);
  expect(screen.getByText('2/18')).toBeInTheDocument();
});

it('expande ao clicar no row e exibe os times', () => {
  const aposta = makeAposta();
  render(<PlacaresDist apostas={[aposta]} onApostar={jest.fn()} />);
  fireEvent.click(screen.getByText('1 × 0'));
  expect(screen.getByText('BRA')).toBeInTheDocument();
  expect(screen.getByText('ARG')).toBeInTheDocument();
});

it('aposta aberta exibe botão Editar', () => {
  const aposta = makeAposta({ jogo: makeJogo({ dataHora: HORA_FUTURA }) });
  render(<PlacaresDist apostas={[aposta]} onApostar={jest.fn()} />);
  fireEvent.click(screen.getByText('1 × 0'));
  expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
});

it('clicar em Editar chama onApostar com o jogo correto', () => {
  const onApostar = jest.fn();
  const jogo = makeJogo({ id: 'jX', dataHora: HORA_FUTURA });
  const aposta = makeAposta({ jogo });
  render(<PlacaresDist apostas={[aposta]} onApostar={onApostar} />);
  fireEvent.click(screen.getByText('1 × 0'));
  fireEvent.click(screen.getByRole('button', { name: /editar/i }));
  expect(onApostar).toHaveBeenCalledWith(jogo);
});

it('aposta encerrada com pontuacao exibe "+N pts"', () => {
  const aposta = makeAposta({
    pontuacao: 15,
    jogo: makeJogo({ dataHora: HORA_PASSADA }),
  });
  render(<PlacaresDist apostas={[aposta]} onApostar={jest.fn()} />);
  fireEvent.click(screen.getByText('1 × 0'));
  expect(screen.getByText('+15 pts')).toBeInTheDocument();
});

it('aposta encerrada sem pontuacao exibe "Aguardando"', () => {
  const aposta = makeAposta({
    pontuacao: null,
    jogo: makeJogo({ dataHora: HORA_PASSADA }),
  });
  render(<PlacaresDist apostas={[aposta]} onApostar={jest.fn()} />);
  fireEvent.click(screen.getByText('1 × 0'));
  expect(screen.getByText('Aguardando')).toBeInTheDocument();
});

it('0×2 e 2×0 são agrupados como o mesmo placar, exibido como 2×0', () => {
  const a1 = makeAposta({ id: 'a1', jogoId: 'j1', placarCasa: 2, placarVisitante: 0, jogo: makeJogo({ id: 'j1' }) });
  const a2 = makeAposta({ id: 'a2', jogoId: 'j2', placarCasa: 0, placarVisitante: 2, jogo: makeJogo({ id: 'j2' }) });
  render(<PlacaresDist apostas={[a1, a2]} onApostar={jest.fn()} />);
  expect(screen.getByText('2 × 0')).toBeInTheDocument();
  expect(screen.getByText('2/18')).toBeInTheDocument();
});

it('ordena por placarAlto crescente', () => {
  const a1 = makeAposta({ id: 'a1', jogoId: 'j1', placarCasa: 3, placarVisitante: 1, jogo: makeJogo({ id: 'j1' }) });
  const a2 = makeAposta({ id: 'a2', jogoId: 'j2', placarCasa: 1, placarVisitante: 0, jogo: makeJogo({ id: 'j2' }) });
  const a3 = makeAposta({ id: 'a3', jogoId: 'j3', placarCasa: 2, placarVisitante: 2, jogo: makeJogo({ id: 'j3' }) });
  const { container } = render(<PlacaresDist apostas={[a1, a2, a3]} onApostar={jest.fn()} />);
  const rowButtons = container.querySelectorAll('button');
  expect(rowButtons[0].textContent).toContain('1 × 0');
  expect(rowButtons[1].textContent).toContain('2 × 2');
  expect(rowButtons[2].textContent).toContain('3 × 1');
});
