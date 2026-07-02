// apps/backend/src/estatistica/calculos/zebras.spec.ts
import { calcularZebras } from './zebras';
import { ApostaInput, JogoInput, UserRef } from '../estatistica.types';

const u = (id: string, nome: string): UserRef => ({ id, nome, avatarUrl: null });
const membros = new Map<string, UserRef>([
  ['u1', u('u1', 'Ana')],
  ['u2', u('u2', 'Bruno')],
]);

const jogo = (
  id: string, placarCasa: number, placarVisitante: number, dia: number,
): JogoInput => ({
  id, placarCasa, placarVisitante,
  dataHora: new Date(`2026-06-${String(dia).padStart(2, '0')}T15:00:00Z`),
  fase: 'GRUPOS', pesoPontuacao: 1, descricao: `Jogo ${id}`,
});

const aposta = (
  usuarioId: string, jogoId: string, placarCasa: number, placarVisitante: number,
  pontuacao: number,
): ApostaInput => ({
  usuarioId, jogoId, placarCasa, placarVisitante, pontuacao,
  criadoEm: new Date('2026-06-01T10:00:00Z'),
  palpiteAtualizadoEm: new Date('2026-06-01T10:00:00Z'),
});

describe('calcularZebras', () => {
  const j1 = jogo('j1', 2, 1, 10); // Ana cravou, Bruno errou → 50% pontuaram
  const j2 = jogo('j2', 1, 1, 12); // ambos pontuaram → 100%
  const apostas = [
    aposta('u1', 'j1', 2, 1, 10), aposta('u2', 'j1', 0, 0, 0),
    aposta('u1', 'j2', 0, 0, 5), aposta('u2', 'j2', 1, 1, 10),
  ];

  it('zebra é o jogo com menor % de apostas pontuadas; previsível o maior', () => {
    const r = calcularZebras([j1, j2], apostas, membros);
    expect(r.zebra).toEqual({ jogo: 'Jogo j1', percentualPontuaram: 50 });
    expect(r.previsivel).toEqual({ jogo: 'Jogo j2', percentualPontuaram: 100 });
  });

  it('acertos solitários: exatamente 1 membro cravou o placar', () => {
    const r = calcularZebras([j1, j2], apostas, membros);
    // j2 (mais recente) primeiro: Bruno cravou 1x1 sozinho; em j1 Ana cravou 2x1 sozinha
    expect(r.acertosSolitarios).toEqual([
      { jogo: 'Jogo j2', usuario: u('u2', 'Bruno'), placar: '1x1' },
      { jogo: 'Jogo j1', usuario: u('u1', 'Ana'), placar: '2x1' },
    ]);
  });

  it('jogo onde 2 membros cravaram não gera acerto solitário', () => {
    const r = calcularZebras([j1], [
      aposta('u1', 'j1', 2, 1, 10), aposta('u2', 'j1', 2, 1, 10),
    ], membros);
    expect(r.acertosSolitarios).toEqual([]);
  });

  it('retorna nulls/vazios sem apostas', () => {
    const r = calcularZebras([j1], [], membros);
    expect(r.zebra).toBeNull();
    expect(r.previsivel).toBeNull();
    expect(r.acertosSolitarios).toEqual([]);
  });
});
