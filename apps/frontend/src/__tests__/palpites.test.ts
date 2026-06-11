import { placarKey, contarPlacares, ordenarPorClassificacao } from '@/lib/palpites';
import type { Palpite } from '@/types/api';

const mk = (over: Partial<Palpite>): Palpite => ({
  usuarioId: 'u', nome: 'X', avatarUrl: null,
  placarCasa: 0, placarVisitante: 0, pontuacao: null,
  atualizadoEm: '2026-06-11T12:00:00.000Z', ...over,
});

describe('placarKey', () => {
  it('monta a chave casaxvisitante', () => {
    expect(placarKey(mk({ placarCasa: 2, placarVisitante: 1 }))).toBe('2x1');
  });
});

describe('contarPlacares', () => {
  it('agrupa placares distintos e ordena por contagem desc', () => {
    const r = contarPlacares([
      mk({ placarCasa: 2, placarVisitante: 1 }),
      mk({ placarCasa: 2, placarVisitante: 1 }),
      mk({ placarCasa: 1, placarVisitante: 0 }),
    ]);
    expect(r).toEqual([
      { key: '2x1', casa: 2, visitante: 1, count: 2 },
      { key: '1x0', casa: 1, visitante: 0, count: 1 },
    ]);
  });

  it('lista vazia retorna []', () => {
    expect(contarPlacares([])).toEqual([]);
  });
});

describe('ordenarPorClassificacao', () => {
  it('ordena por posição e joga não ranqueados pro fim mantendo a ordem original', () => {
    const a = mk({ usuarioId: 'a' });
    const b = mk({ usuarioId: 'b' });
    const c = mk({ usuarioId: 'c' });
    const posicoes = new Map([['b', 1], ['a', 3]]);
    const r = ordenarPorClassificacao([a, b, c], posicoes);
    expect(r.map((x) => x.palpite.usuarioId)).toEqual(['b', 'a', 'c']);
    expect(r.map((x) => x.posicao)).toEqual([1, 3, undefined]);
  });

  it('sem ranking, preserva a ordem original e posicao undefined', () => {
    const a = mk({ usuarioId: 'a' });
    const b = mk({ usuarioId: 'b' });
    const r = ordenarPorClassificacao([a, b], new Map());
    expect(r.map((x) => x.palpite.usuarioId)).toEqual(['a', 'b']);
    expect(r.map((x) => x.posicao)).toEqual([undefined, undefined]);
  });
});
