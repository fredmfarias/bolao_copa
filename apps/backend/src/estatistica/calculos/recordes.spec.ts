import { calcularRecordes } from './recordes';
import { ApostaInput, JogoInput, SnapshotInput, UserRef } from '../estatistica.types';

const u = (id: string, nome: string): UserRef => ({ id, nome, avatarUrl: null });
const membros = new Map<string, UserRef>([
  ['u1', u('u1', 'Ana')],
  ['u2', u('u2', 'Bruno')],
]);

const snap = (
  usuarioId: string, publicacaoNumero: number, pontuacaoRodada: number, acertosPlacarExato = 0,
): SnapshotInput => ({
  usuarioId, publicacaoNumero, posicao: 1, posicoesGanhas: 0,
  pontuacaoRodada, acertosPlacarExato,
});

const jogo = (id: string, fase: string, pesoPontuacao: number): JogoInput => ({
  id, fase, pesoPontuacao,
  dataHora: new Date('2026-06-15T15:00:00Z'),
  placarCasa: 1, placarVisitante: 0, descricao: 'A x B',
});

const aposta = (usuarioId: string, jogoId: string, pontuacao: number): ApostaInput => ({
  usuarioId, jogoId, pontuacao,
  placarCasa: 1, placarVisitante: 0,
  criadoEm: new Date('2026-06-10T10:00:00Z'),
  palpiteAtualizadoEm: new Date('2026-06-10T10:00:00Z'),
});

const snapshots: SnapshotInput[] = [
  snap('u1', 1, 10, 2), snap('u2', 1, 5, 0),
  snap('u1', 2, 3, 4), snap('u2', 2, 25, 1),
];

describe('calcularRecordes', () => {
  it('maior pontuação numa rodada, com a publicação', () => {
    const r = calcularRecordes(snapshots, [], [], membros, 10);
    expect(r.maiorPontuacaoRodada).toEqual({
      valor: 25,
      registros: [{ usuario: u('u2', 'Bruno'), publicacao: 2 }],
    });
  });

  it('rodada generosa e avara pela média de pontuacaoRodada', () => {
    const r = calcularRecordes(snapshots, [], [], membros, 10);
    expect(r.rodadaGenerosa).toEqual({ publicacao: 2, media: 14 }); // (3+25)/2
    expect(r.rodadaAvara).toEqual({ publicacao: 1, media: 7.5 }); // (10+5)/2
  });

  it('rei do placar exato usa o snapshot da última publicação', () => {
    const r = calcularRecordes(snapshots, [], [], membros, 10);
    expect(r.reiDoPlacarExato).toEqual([
      { valor: 4, usuarios: [u('u1', 'Ana')] },
      { valor: 1, usuarios: [u('u2', 'Bruno')] },
    ]);
  });

  it('aproveitamento por fase: pontos obtidos / máximo possível', () => {
    const jogos = [jogo('j1', 'GRUPOS', 1), jogo('j2', 'OITAVAS', 2)];
    const apostas = [
      aposta('u1', 'j1', 10), aposta('u2', 'j1', 0),
      aposta('u1', 'j2', 5), aposta('u2', 'j2', 20),
    ];
    // pontosExato=10 → máx GRUPOS = 2 membros × 10×1 = 20; obtidos 10 → 50%
    // máx OITAVAS = 2 × 10×2 = 40; obtidos 25 → 63%
    const r = calcularRecordes([], jogos, apostas, membros, 10);
    expect(r.aproveitamentoPorFase).toEqual([
      { fase: 'GRUPOS', aproveitamento: 50, melhor: { usuarios: [u('u1', 'Ana')], pontos: 10 } },
      { fase: 'OITAVAS', aproveitamento: 63, melhor: { usuarios: [u('u2', 'Bruno')], pontos: 20 } },
    ]);
  });

  it('retorna nulls/vazios sem dados', () => {
    const r = calcularRecordes([], [], [], membros, 10);
    expect(r.maiorPontuacaoRodada).toBeNull();
    expect(r.rodadaGenerosa).toBeNull();
    expect(r.rodadaAvara).toBeNull();
    expect(r.reiDoPlacarExato).toEqual([]);
    expect(r.aproveitamentoPorFase).toEqual([]);
  });
});
