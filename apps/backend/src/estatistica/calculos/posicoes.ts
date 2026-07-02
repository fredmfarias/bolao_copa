import { Posicoes, RecordeRodada, SnapshotInput, UserRef } from '../estatistica.types';
import { desvioPadrao, incrementar, round2, topEntries } from './util';

export function calcularPosicoes(
  snapshots: SnapshotInput[],
  membros: Map<string, UserRef>,
): Posicoes {
  const lideres = new Map<string, number>();
  const lanternas = new Map<string, number>();
  const top5 = new Map<string, number>();
  const posicoesPorUsuario = new Map<string, number[]>();

  const porPublicacao = new Map<number, SnapshotInput[]>();
  for (const s of snapshots) {
    const lista = porPublicacao.get(s.publicacaoNumero) ?? [];
    lista.push(s);
    porPublicacao.set(s.publicacaoNumero, lista);
  }

  for (const snaps of porPublicacao.values()) {
    const maiorPosicao = Math.max(...snaps.map((s) => s.posicao));
    for (const s of snaps) {
      if (s.posicao === 1) incrementar(lideres, s.usuarioId);
      if (s.posicao === maiorPosicao) incrementar(lanternas, s.usuarioId);
      if (s.posicao <= 5) incrementar(top5, s.usuarioId);
      const posicoes = posicoesPorUsuario.get(s.usuarioId) ?? [];
      posicoes.push(s.posicao);
      posicoesPorUsuario.set(s.usuarioId, posicoes);
    }
  }

  return {
    reiDaLideranca: topEntries(lideres, membros),
    lanterna: topEntries(lanternas, membros),
    foguete: recordePosicoesGanhas(snapshots, membros, 'max'),
    quedaLivre: recordePosicoesGanhas(snapshots, membros, 'min'),
    maisRegular: maisRegular(posicoesPorUsuario, membros),
    top5: topEntries(top5, membros),
  };
}

function recordePosicoesGanhas(
  snapshots: SnapshotInput[],
  membros: Map<string, UserRef>,
  tipo: 'max' | 'min',
): RecordeRodada | null {
  const candidatos = snapshots.filter((s) =>
    tipo === 'max' ? s.posicoesGanhas > 0 : s.posicoesGanhas < 0,
  );
  if (candidatos.length === 0) return null;

  const valores = candidatos.map((s) => s.posicoesGanhas);
  const valor = tipo === 'max' ? Math.max(...valores) : Math.min(...valores);

  const registros = candidatos
    .filter((s) => s.posicoesGanhas === valor)
    .flatMap((s) => {
      const usuario = membros.get(s.usuarioId);
      return usuario ? [{ usuario, publicacao: s.publicacaoNumero }] : [];
    });
  return registros.length > 0 ? { valor, registros } : null;
}

function maisRegular(
  posicoesPorUsuario: Map<string, number[]>,
  membros: Map<string, UserRef>,
): { usuarios: UserRef[]; valor: number } | null {
  let menor: number | null = null;
  const desvios = new Map<string, number>();
  for (const [usuarioId, posicoes] of posicoesPorUsuario) {
    if (posicoes.length < 2 || !membros.has(usuarioId)) continue;
    const dv = round2(desvioPadrao(posicoes));
    desvios.set(usuarioId, dv);
    if (menor === null || dv < menor) menor = dv;
  }
  if (menor === null) return null;

  const usuarios = [...desvios.entries()]
    .filter(([, dv]) => dv === menor)
    .map(([usuarioId]) => membros.get(usuarioId)!)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return { usuarios, valor: menor };
}
