import { calcularPosicoes } from './posicoes';
import { SnapshotInput, UserRef } from '../estatistica.types';

const u = (id: string, nome: string): UserRef => ({ id, nome, avatarUrl: null });
const membros = new Map<string, UserRef>([
  ['u1', u('u1', 'Ana')],
  ['u2', u('u2', 'Bruno')],
  ['u3', u('u3', 'Carla')],
]);

const snap = (
  usuarioId: string, publicacaoNumero: number, posicao: number, posicoesGanhas = 0,
): SnapshotInput => ({
  usuarioId, publicacaoNumero, posicao, posicoesGanhas,
  pontuacaoRodada: 0, acertosPlacarExato: 0,
});

// pub1: Ana 1º, Bruno 2º, Carla 3º
// pub2: Ana 1º, Carla 2º (+1), Bruno 3º (-1)
// pub3: Bruno 1º (+2), Ana 2º (-1), Carla 3º (-1)
const snapshots: SnapshotInput[] = [
  snap('u1', 1, 1), snap('u2', 1, 2), snap('u3', 1, 3),
  snap('u1', 2, 1), snap('u3', 2, 2, 1), snap('u2', 2, 3, -1),
  snap('u2', 3, 1, 2), snap('u1', 3, 2, -1), snap('u3', 3, 3, -1),
];

describe('calcularPosicoes', () => {
  it('rei da liderança conta rodadas em 1º', () => {
    const r = calcularPosicoes(snapshots, membros);
    expect(r.reiDaLideranca).toEqual([
      { valor: 2, usuarios: [u('u1', 'Ana')] },
      { valor: 1, usuarios: [u('u2', 'Bruno')] },
    ]);
  });

  it('lanterna conta rodadas na última posição da publicação', () => {
    const r = calcularPosicoes(snapshots, membros);
    expect(r.lanterna).toEqual([
      { valor: 2, usuarios: [u('u3', 'Carla')] },
      { valor: 1, usuarios: [u('u2', 'Bruno')] },
    ]);
  });

  it('foguete é o maior posicoesGanhas positivo, com a rodada', () => {
    const r = calcularPosicoes(snapshots, membros);
    expect(r.foguete).toEqual({
      valor: 2,
      registros: [{ usuario: u('u2', 'Bruno'), publicacao: 3 }],
    });
  });

  it('queda livre agrupa empatados no menor posicoesGanhas', () => {
    const r = calcularPosicoes(snapshots, membros);
    expect(r.quedaLivre!.valor).toBe(-1);
    expect(r.quedaLivre!.registros).toHaveLength(3);
  });

  it('mais regular usa desvio padrão de posição e agrupa empatados', () => {
    const r = calcularPosicoes(snapshots, membros);
    // Ana [1,1,2] e Carla [3,2,3] têm o mesmo desvio (0.47)
    expect(r.maisRegular).toEqual({
      valor: 0.47,
      usuarios: [u('u1', 'Ana'), u('u3', 'Carla')],
    });
  });

  it('exige pelo menos 2 publicações para o mais regular', () => {
    const r = calcularPosicoes([snap('u1', 1, 1)], membros);
    expect(r.maisRegular).toBeNull();
  });

  it('top 5 conta presenças em posicao <= 5', () => {
    const r = calcularPosicoes(snapshots, membros);
    expect(r.top5).toEqual([
      { valor: 3, usuarios: [u('u1', 'Ana'), u('u2', 'Bruno'), u('u3', 'Carla')] },
    ]);
  });

  it('sem foguete/queda quando ninguém subiu ou caiu', () => {
    const r = calcularPosicoes([snap('u1', 1, 1), snap('u2', 1, 2)], membros);
    expect(r.foguete).toBeNull();
    expect(r.quedaLivre).toBeNull();
  });
});
