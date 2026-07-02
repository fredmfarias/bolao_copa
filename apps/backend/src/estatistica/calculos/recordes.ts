import {
  ApostaInput, JogoInput, RecordeRodada, Recordes, SnapshotInput, UserRef,
} from '../estatistica.types';
import { incrementar, round2, topEntries } from './util';

const ORDEM_FASES = [
  'GRUPOS', 'SEGUNDA_FASE', 'OITAVAS', 'QUARTAS', 'SEMIS', 'TERCEIRO_LUGAR', 'FINAL',
];

export function calcularRecordes(
  snapshots: SnapshotInput[],
  jogos: JogoInput[],
  apostas: ApostaInput[],
  membros: Map<string, UserRef>,
  pontosPlacarExato: number,
): Recordes {
  return {
    maiorPontuacaoRodada: maiorPontuacaoRodada(snapshots, membros),
    ...mediasPorRodada(snapshots),
    reiDoPlacarExato: reiDoPlacarExato(snapshots, membros),
    aproveitamentoPorFase: aproveitamentoPorFase(jogos, apostas, membros, pontosPlacarExato),
  };
}

function maiorPontuacaoRodada(
  snapshots: SnapshotInput[],
  membros: Map<string, UserRef>,
): RecordeRodada | null {
  const candidatos = snapshots.filter((s) => s.pontuacaoRodada > 0);
  if (candidatos.length === 0) return null;
  const valor = Math.max(...candidatos.map((s) => s.pontuacaoRodada));
  const registros = candidatos
    .filter((s) => s.pontuacaoRodada === valor)
    .flatMap((s) => {
      const usuario = membros.get(s.usuarioId);
      return usuario ? [{ usuario, publicacao: s.publicacaoNumero }] : [];
    });
  return registros.length > 0 ? { valor, registros } : null;
}

function mediasPorRodada(snapshots: SnapshotInput[]): {
  rodadaGenerosa: { publicacao: number; media: number } | null;
  rodadaAvara: { publicacao: number; media: number } | null;
} {
  const somas = new Map<number, { total: number; qtd: number }>();
  for (const s of snapshots) {
    const acc = somas.get(s.publicacaoNumero) ?? { total: 0, qtd: 0 };
    acc.total += s.pontuacaoRodada;
    acc.qtd += 1;
    somas.set(s.publicacaoNumero, acc);
  }
  const medias = [...somas.entries()].map(([publicacao, { total, qtd }]) => ({
    publicacao,
    media: round2(total / qtd),
  }));
  if (medias.length === 0) return { rodadaGenerosa: null, rodadaAvara: null };

  const generosa = medias.reduce((a, b) => (b.media > a.media ? b : a));
  const avara = medias.reduce((a, b) => (b.media < a.media ? b : a));
  return { rodadaGenerosa: generosa, rodadaAvara: avara };
}

function reiDoPlacarExato(snapshots: SnapshotInput[], membros: Map<string, UserRef>) {
  if (snapshots.length === 0) return [];
  const ultima = Math.max(...snapshots.map((s) => s.publicacaoNumero));
  const contagens = new Map<string, number>();
  for (const s of snapshots) {
    if (s.publicacaoNumero === ultima) contagens.set(s.usuarioId, s.acertosPlacarExato);
  }
  return topEntries(contagens, membros);
}

function aproveitamentoPorFase(
  jogos: JogoInput[],
  apostas: ApostaInput[],
  membros: Map<string, UserRef>,
  pontosPlacarExato: number,
) {
  if (pontosPlacarExato <= 0 || membros.size === 0) return [];
  const apostasPorJogo = new Map<string, ApostaInput[]>();
  for (const a of apostas) {
    const lista = apostasPorJogo.get(a.jogoId) ?? [];
    lista.push(a);
    apostasPorJogo.set(a.jogoId, lista);
  }

  const resultado = [];
  for (const fase of ORDEM_FASES) {
    const jogosFase = jogos.filter((j) => j.fase === fase);
    if (jogosFase.length === 0) continue;

    const maxPossivel =
      membros.size *
      jogosFase.reduce((acc, j) => acc + pontosPlacarExato * j.pesoPontuacao, 0);

    const pontosPorUsuario = new Map<string, number>();
    let obtidos = 0;
    for (const j of jogosFase) {
      for (const a of apostasPorJogo.get(j.id) ?? []) {
        obtidos += a.pontuacao ?? 0;
        incrementar(pontosPorUsuario, a.usuarioId, a.pontuacao ?? 0);
      }
    }

    const melhores = topEntries(pontosPorUsuario, membros, 1);
    resultado.push({
      fase,
      aproveitamento: Math.round((obtidos / maxPossivel) * 100),
      melhor: melhores.length > 0
        ? { usuarios: melhores[0].usuarios, pontos: melhores[0].valor }
        : null,
    });
  }
  return resultado;
}
