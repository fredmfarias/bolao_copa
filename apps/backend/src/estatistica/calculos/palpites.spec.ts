import { calcularPalpites } from './palpites';
import { ApostaInput, JogoInput, UserRef } from '../estatistica.types';

const u = (id: string, nome: string): UserRef => ({ id, nome, avatarUrl: null });
const membros = new Map<string, UserRef>([
  ['u1', u('u1', 'Ana')],
  ['u2', u('u2', 'Bruno')],
  ['u3', u('u3', 'Carla')],
]);

const jogo = (id: string, placarCasa: number, placarVisitante: number, hora = '15:00'): JogoInput => ({
  id, placarCasa, placarVisitante,
  dataHora: new Date(`2026-06-15T${hora}:00Z`),
  fase: 'GRUPOS', pesoPontuacao: 1, descricao: `Jogo ${id}`,
});

// Aposta enviada `minutosAntesFechamento` antes do fechamento (dataHora - 60min).
function aposta(
  usuarioId: string, j: JogoInput, placarCasa: number, placarVisitante: number,
  opts: { minutosAntesFechamento?: number; reenviada?: boolean; pontuacao?: number } = {},
): ApostaInput {
  const fechamento = j.dataHora.getTime() - 60 * 60 * 1000;
  const enviadaEm = new Date(fechamento - (opts.minutosAntesFechamento ?? 120) * 60 * 1000);
  return {
    usuarioId, jogoId: j.id, placarCasa, placarVisitante,
    pontuacao: opts.pontuacao ?? 0,
    criadoEm: enviadaEm,
    palpiteAtualizadoEm: opts.reenviada
      ? new Date(enviadaEm.getTime() + 10_000)
      : enviadaEm,
  };
}

describe('calcularPalpites', () => {
  const j1 = jogo('j1', 2, 1);
  const j2 = jogo('j2', 1, 1, '18:00');

  it('placares mais apostados agrupa por par ordenado', () => {
    const r = calcularPalpites([j1, j2], [
      aposta('u1', j1, 2, 1), aposta('u2', j1, 2, 1), aposta('u3', j1, 0, 0),
      aposta('u1', j2, 2, 1),
    ], membros);
    expect(r.placaresMaisApostados[0]).toEqual({ placar: '2x1', quantidade: 3 });
    expect(r.placaresMaisApostados[1]).toEqual({ placar: '0x0', quantidade: 1 });
  });

  it('consensual e dividido por percentual do placar modal', () => {
    const r = calcularPalpites([j1, j2], [
      // j1: 3 apostas iguais → 100% modal
      aposta('u1', j1, 1, 0), aposta('u2', j1, 1, 0), aposta('u3', j1, 1, 0),
      // j2: 3 placares distintos → 33% modal
      aposta('u1', j2, 1, 0), aposta('u2', j2, 2, 0), aposta('u3', j2, 0, 0),
    ], membros);
    expect(r.jogoConsensual).toEqual({ jogo: 'Jogo j1', placar: '1x0', percentual: 100 });
    expect(r.jogoDividido).toEqual({ jogo: 'Jogo j2', placaresDistintos: 3, percentualModal: 33 });
  });

  it('otimista/pessimista exigem mínimo de 5 apostas', () => {
    const jogos = [1, 2, 3, 4, 5].map((n) => jogo(`g${n}`, 1, 0));
    const apostas = jogos.flatMap((j) => [
      aposta('u1', j, 3, 2), // 5 gols/jogo
      aposta('u2', j, 0, 0), // 0 gols/jogo
    ]);
    apostas.push(aposta('u3', jogos[0], 9, 9)); // só 1 aposta — fora
    const r = calcularPalpites(jogos, apostas, membros);
    expect(r.otimista).toEqual({ usuarios: [u('u1', 'Ana')], mediaGols: 5 });
    expect(r.pessimista).toEqual({ usuarios: [u('u2', 'Bruno')], mediaGols: 0 });
    expect(r.mediaRealGols).toBe(1);
  });

  it('última hora e precavido pela mediana de antecedência (min 5 apostas)', () => {
    const jogos = [1, 2, 3, 4, 5].map((n) => jogo(`g${n}`, 1, 0));
    const apostas = jogos.flatMap((j) => [
      aposta('u1', j, 1, 0, { minutosAntesFechamento: 5 }),
      aposta('u2', j, 1, 0, { minutosAntesFechamento: 2000 }),
    ]);
    const r = calcularPalpites(jogos, apostas, membros);
    expect(r.ultimaHora).toEqual({ usuarios: [u('u1', 'Ana')], medianaMinutos: 5 });
    expect(r.precavido).toEqual({ usuarios: [u('u2', 'Bruno')], medianaMinutos: 2000 });
  });

  it('reenvios conta apostas com palpiteAtualizadoEm > criadoEm + 2s', () => {
    const r = calcularPalpites([j1, j2], [
      aposta('u1', j1, 1, 0, { reenviada: true }),
      aposta('u1', j2, 1, 0, { reenviada: true }),
      aposta('u2', j1, 1, 0),
    ], membros);
    expect(r.reenvios).toEqual([{ valor: 2, usuarios: [u('u1', 'Ana')] }]);
  });

  it('percentual de empates apostados vs reais', () => {
    const r = calcularPalpites([j1, j2], [
      aposta('u1', j1, 1, 1), aposta('u2', j1, 2, 1),
      aposta('u1', j2, 0, 0), aposta('u2', j2, 2, 0),
    ], membros);
    // 2 de 4 apostas em empate = 50%; 1 de 2 jogos empatou (j2 1x1) = 50%
    expect(r.empates).toEqual({ percentualApostas: 50, percentualJogos: 50 });
  });

  it('esquecidos conta jogos publicados sem aposta do membro', () => {
    const r = calcularPalpites([j1, j2], [
      aposta('u1', j1, 1, 0), aposta('u1', j2, 1, 0),
      aposta('u2', j1, 1, 0),
    ], membros);
    expect(r.esquecidos).toEqual([
      { valor: 2, usuarios: [u('u3', 'Carla')] },
      { valor: 1, usuarios: [u('u2', 'Bruno')] },
    ]);
  });

  it('retorna nulls/vazios sem jogos publicados', () => {
    const r = calcularPalpites([], [], membros);
    expect(r.placaresMaisApostados).toEqual([]);
    expect(r.jogoConsensual).toBeNull();
    expect(r.mediaRealGols).toBeNull();
    expect(r.empates).toBeNull();
    expect(r.esquecidos).toEqual([]);
  });
});
