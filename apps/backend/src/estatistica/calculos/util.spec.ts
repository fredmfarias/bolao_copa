import { mediana, desvioPadrao, topEntries, incrementar } from './util';
import { UserRef } from '../estatistica.types';

const u = (id: string, nome: string): UserRef => ({ id, nome, avatarUrl: null });
const membros = new Map<string, UserRef>([
  ['u1', u('u1', 'Ana')],
  ['u2', u('u2', 'Bruno')],
  ['u3', u('u3', 'Carla')],
]);

describe('util', () => {
  it('mediana de lista ímpar e par', () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 2, 3])).toBe(2.5);
  });

  it('desvio padrão populacional', () => {
    expect(desvioPadrao([2, 2, 2])).toBe(0);
    expect(desvioPadrao([1, 3])).toBe(1);
  });

  it('incrementar soma contagens num Map', () => {
    const m = new Map<string, number>();
    incrementar(m, 'a');
    incrementar(m, 'a');
    expect(m.get('a')).toBe(2);
  });

  it('topEntries agrupa empatados, ordena desc e corta em N', () => {
    const contagens = new Map([['u1', 2], ['u2', 5], ['u3', 2]]);
    const top = topEntries(contagens, membros, 3);
    expect(top).toEqual([
      { valor: 5, usuarios: [u('u2', 'Bruno')] },
      { valor: 2, usuarios: [u('u1', 'Ana'), u('u3', 'Carla')] },
    ]);
  });

  it('topEntries descarta valores <= 0 e usuários fora do bolão', () => {
    const contagens = new Map([['u1', 0], ['desconhecido', 9]]);
    expect(topEntries(contagens, membros, 3)).toEqual([]);
  });
});
