import { getEstadoAposta, jogoNoFiltro } from '@/lib/jogoEstado';
import type { Jogo, Aposta } from '@/types/api';

const HORA_FUTURA = new Date(Date.now() + 2 * 3600_000).toISOString();
const HORA_PASSADA = new Date(Date.now() - 3600_000).toISOString();

const baseJogo: Jogo = {
  id: 'j1', dataHora: HORA_FUTURA, rodada: 1, grupo: null, fase: 'GRUPOS',
  placarCasa: null, placarVisitante: null, pesoPontuacao: 1,
  selecaoCasa: { id: 'b', nome: 'B', codigo: 'BRA', bandeiraSvg: '' },
  selecaoVisitante: { id: 'a', nome: 'A', codigo: 'ARG', bandeiraSvg: '' },
};

const baseAposta: Aposta = {
  id: 'a1', jogoId: 'j1', placarCasa: 2, placarVisitante: 1,
  pontuacao: null, atualizadoEm: new Date().toISOString(), jogo: baseJogo,
};

it('aberto: prazo aberto, sem aposta', () => {
  expect(getEstadoAposta(baseJogo)).toBe('aberto');
});

it('salvo: prazo aberto, com aposta', () => {
  expect(getEstadoAposta(baseJogo, baseAposta)).toBe('salvo');
});

it('sem-palpite: prazo encerrado, sem aposta', () => {
  expect(getEstadoAposta({ ...baseJogo, dataHora: HORA_PASSADA })).toBe('sem-palpite');
});

it('finalizado: prazo encerrado, com placar, com aposta', () => {
  const j = { ...baseJogo, dataHora: HORA_PASSADA, placarCasa: 1, placarVisitante: 0 };
  expect(getEstadoAposta(j, { ...baseAposta, jogo: j })).toBe('finalizado');
});

it('aguardando: prazo encerrado, sem placar, com aposta', () => {
  const j = { ...baseJogo, dataHora: HORA_PASSADA };
  expect(getEstadoAposta(j, baseAposta)).toBe('aguardando');
});

it('filtro Encerrados inclui aguardando, finalizado, sem-palpite', () => {
  expect(jogoNoFiltro('aguardando', 'Encerrados')).toBe(true);
  expect(jogoNoFiltro('finalizado', 'Encerrados')).toBe(true);
  expect(jogoNoFiltro('sem-palpite', 'Encerrados')).toBe(true);
  expect(jogoNoFiltro('aberto', 'Encerrados')).toBe(false);
  expect(jogoNoFiltro('salvo', 'Encerrados')).toBe(false);
});

it('filtro Placares retorna false para qualquer estado', () => {
  expect(jogoNoFiltro('aberto',      'Placares')).toBe(false);
  expect(jogoNoFiltro('salvo',       'Placares')).toBe(false);
  expect(jogoNoFiltro('aguardando',  'Placares')).toBe(false);
  expect(jogoNoFiltro('finalizado',  'Placares')).toBe(false);
  expect(jogoNoFiltro('sem-palpite', 'Placares')).toBe(false);
});
