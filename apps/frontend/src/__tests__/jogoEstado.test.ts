import {
  getEstadoAposta,
  jogoNoFiltro,
  ordenarPorFiltro,
  formatDataAposta,
} from '@/lib/jogoEstado';
import type { Jogo, Aposta } from '@/types/api';

const selecao = (nome: string) => ({
  id: nome, nome, codigo: nome.slice(0, 3).toUpperCase(), bandeiraSvg: '<svg></svg>',
});

const HORA_FUTURA = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
const HORA_PASSADA = new Date(Date.now() - 2 * 3600 * 1000).toISOString();

const jogo = (id: string, dataHora: string): Jogo => ({
  id, rodada: 1, grupo: 'A', fase: 'GRUPOS',
  placarCasa: null, placarVisitante: null, pesoPontuacao: 1,
  selecaoCasa: selecao('Brasil'), selecaoVisitante: selecao('Argentina'),
  dataHora,
});

const aposta = (jogoId: string): Aposta => ({
  id: 'a-' + jogoId, jogoId, placarCasa: 2, placarVisitante: 1,
  pontuacao: null, atualizadoEm: HORA_PASSADA, jogo: jogo(jogoId, HORA_FUTURA),
});

describe('getEstadoAposta', () => {
  it('aberto: prazo futuro sem aposta', () => {
    expect(getEstadoAposta(jogo('j', HORA_FUTURA))).toBe('aberto');
  });
  it('salvo: prazo futuro com aposta', () => {
    expect(getEstadoAposta(jogo('j', HORA_FUTURA), aposta('j'))).toBe('salvo');
  });
  it('incompleto: prazo passado sem aposta', () => {
    expect(getEstadoAposta(jogo('j', HORA_PASSADA))).toBe('incompleto');
  });
  it('fechado: prazo passado com aposta', () => {
    expect(getEstadoAposta(jogo('j', HORA_PASSADA), aposta('j'))).toBe('fechado');
  });
});

describe('jogoNoFiltro', () => {
  it('Todos aceita qualquer estado', () => {
    expect(jogoNoFiltro('aberto', 'Todos')).toBe(true);
    expect(jogoNoFiltro('incompleto', 'Todos')).toBe(true);
  });
  it('Pendentes aceita só aberto', () => {
    expect(jogoNoFiltro('aberto', 'Pendentes')).toBe(true);
    expect(jogoNoFiltro('salvo', 'Pendentes')).toBe(false);
  });
  it('Apostados aceita só salvo', () => {
    expect(jogoNoFiltro('salvo', 'Apostados')).toBe(true);
    expect(jogoNoFiltro('aberto', 'Apostados')).toBe(false);
  });
  it('Encerrados aceita fechado e incompleto', () => {
    expect(jogoNoFiltro('fechado', 'Encerrados')).toBe(true);
    expect(jogoNoFiltro('incompleto', 'Encerrados')).toBe(true);
    expect(jogoNoFiltro('salvo', 'Encerrados')).toBe(false);
  });
});

describe('ordenarPorFiltro', () => {
  const cedo = jogo('cedo', '2026-06-10T16:00:00.000Z');
  const tarde = jogo('tarde', '2026-06-12T16:00:00.000Z');

  it('crescente para Pendentes', () => {
    const r = ordenarPorFiltro([tarde, cedo], 'Pendentes');
    expect(r.map(j => j.id)).toEqual(['cedo', 'tarde']);
  });
  it('decrescente para Encerrados', () => {
    const r = ordenarPorFiltro([cedo, tarde], 'Encerrados');
    expect(r.map(j => j.id)).toEqual(['tarde', 'cedo']);
  });
  it('não muta o array original', () => {
    const orig = [tarde, cedo];
    ordenarPorFiltro(orig, 'Pendentes');
    expect(orig.map(j => j.id)).toEqual(['tarde', 'cedo']);
  });
});

describe('formatDataAposta', () => {
  it('formata dd/MM/yyyy HH:mm:ss', () => {
    const iso = new Date(2026, 5, 11, 13, 45, 25).toISOString();
    expect(formatDataAposta(iso)).toBe('11/06/2026 13:45:25');
  });
  it('zero-padding em dia/mês/hora', () => {
    const iso = new Date(2026, 0, 3, 9, 5, 7).toISOString();
    expect(formatDataAposta(iso)).toBe('03/01/2026 09:05:07');
  });
});
