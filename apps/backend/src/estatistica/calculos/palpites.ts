import { MINUTOS_PRAZO_APOSTA } from '@bolao/shared';
import { ApostaInput, JogoInput, Palpites, UserRef } from '../estatistica.types';
import { incrementar, mediana, round2, topEntries } from './util';

const MIN_APOSTAS_MEDIA = 5;
const TOLERANCIA_REENVIO_MS = 2000;
const TOP_PLACARES = 8;

export function calcularPalpites(
  jogos: JogoInput[],
  apostas: ApostaInput[],
  membros: Map<string, UserRef>,
): Palpites {
  return {
    placaresMaisApostados: placaresMaisApostados(apostas),
    ...consensoDivisao(jogos, apostas),
    ...otimistaPessimista(apostas, membros),
    mediaRealGols:
      jogos.length > 0
        ? round2(jogos.reduce((acc, j) => acc + j.placarCasa + j.placarVisitante, 0) / jogos.length)
        : null,
    ...antecedencia(jogos, apostas, membros),
    reenvios: reenvios(apostas, membros),
    empates: empates(jogos, apostas),
    esquecidos: esquecidos(jogos, apostas, membros),
  };
}

function placaresMaisApostados(apostas: ApostaInput[]) {
  const contagens = new Map<string, number>();
  for (const a of apostas) incrementar(contagens, `${a.placarCasa}x${a.placarVisitante}`);
  return [...contagens.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_PLACARES)
    .map(([placar, quantidade]) => ({ placar, quantidade }));
}

function consensoDivisao(jogos: JogoInput[], apostas: ApostaInput[]) {
  type Info = {
    jogo: string; total: number; distintos: number;
    placarModal: string; percentualModal: number;
  };
  const infos: Info[] = [];
  for (const j of jogos) {
    const doJogo = apostas.filter((a) => a.jogoId === j.id);
    if (doJogo.length < 2) continue;
    const contagens = new Map<string, number>();
    for (const a of doJogo) incrementar(contagens, `${a.placarCasa}x${a.placarVisitante}`);
    const [placarModal, qtdModal] = [...contagens.entries()].sort((a, b) => b[1] - a[1])[0];
    infos.push({
      jogo: j.descricao,
      total: doJogo.length,
      distintos: contagens.size,
      placarModal,
      percentualModal: Math.round((qtdModal / doJogo.length) * 100),
    });
  }
  if (infos.length === 0) return { jogoConsensual: null, jogoDividido: null };

  const consensual = [...infos].sort(
    (a, b) => b.percentualModal - a.percentualModal || b.total - a.total,
  )[0];
  const dividido = [...infos].sort(
    (a, b) => b.distintos - a.distintos || a.percentualModal - b.percentualModal,
  )[0];
  return {
    jogoConsensual: {
      jogo: consensual.jogo, placar: consensual.placarModal, percentual: consensual.percentualModal,
    },
    jogoDividido: {
      jogo: dividido.jogo, placaresDistintos: dividido.distintos,
      percentualModal: dividido.percentualModal,
    },
  };
}

function otimistaPessimista(apostas: ApostaInput[], membros: Map<string, UserRef>) {
  const medias = mediasPorUsuario(
    apostas, membros, (a) => a.placarCasa + a.placarVisitante, (golsPorAposta) =>
      round2(golsPorAposta.reduce((x, y) => x + y, 0) / golsPorAposta.length),
  );
  if (medias.size === 0) return { otimista: null, pessimista: null };
  const otimista = extremo(medias, membros, 'max');
  const pessimista = extremo(medias, membros, 'min');
  return {
    otimista: { usuarios: otimista.usuarios, mediaGols: otimista.valor },
    pessimista: { usuarios: pessimista.usuarios, mediaGols: pessimista.valor },
  };
}

function antecedencia(
  jogos: JogoInput[], apostas: ApostaInput[], membros: Map<string, UserRef>,
) {
  const fechamentos = new Map(
    jogos.map((j) => [j.id, j.dataHora.getTime() - MINUTOS_PRAZO_APOSTA * 60 * 1000]),
  );
  const medianas = mediasPorUsuario(
    apostas, membros,
    (a) => ((fechamentos.get(a.jogoId) ?? 0) - a.palpiteAtualizadoEm.getTime()) / 60_000,
    (minutos) => Math.round(mediana(minutos)),
  );
  if (medianas.size === 0) return { ultimaHora: null, precavido: null };
  const ultima = extremo(medianas, membros, 'min');
  const precavido = extremo(medianas, membros, 'max');
  return {
    ultimaHora: { usuarios: ultima.usuarios, medianaMinutos: ultima.valor },
    precavido: { usuarios: precavido.usuarios, medianaMinutos: precavido.valor },
  };
}

/** Agrega um valor por aposta em uma medida por usuário, exigindo o mínimo de apostas. */
function mediasPorUsuario(
  apostas: ApostaInput[],
  membros: Map<string, UserRef>,
  valorDaAposta: (a: ApostaInput) => number,
  agregador: (valores: number[]) => number,
): Map<string, number> {
  const valoresPorUsuario = new Map<string, number[]>();
  for (const a of apostas) {
    if (!membros.has(a.usuarioId)) continue;
    const lista = valoresPorUsuario.get(a.usuarioId) ?? [];
    lista.push(valorDaAposta(a));
    valoresPorUsuario.set(a.usuarioId, lista);
  }
  const resultado = new Map<string, number>();
  for (const [usuarioId, valores] of valoresPorUsuario) {
    if (valores.length >= MIN_APOSTAS_MEDIA) resultado.set(usuarioId, agregador(valores));
  }
  return resultado;
}

function extremo(
  medidas: Map<string, number>, membros: Map<string, UserRef>, tipo: 'max' | 'min',
): { usuarios: UserRef[]; valor: number } {
  const valores = [...medidas.values()];
  const valor = tipo === 'max' ? Math.max(...valores) : Math.min(...valores);
  const usuarios = [...medidas.entries()]
    .filter(([, v]) => v === valor)
    .map(([id]) => membros.get(id)!)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return { usuarios, valor };
}

function reenvios(apostas: ApostaInput[], membros: Map<string, UserRef>) {
  const contagens = new Map<string, number>();
  for (const a of apostas) {
    const delta = a.palpiteAtualizadoEm.getTime() - a.criadoEm.getTime();
    if (delta > TOLERANCIA_REENVIO_MS) incrementar(contagens, a.usuarioId);
  }
  return topEntries(contagens, membros);
}

function empates(jogos: JogoInput[], apostas: ApostaInput[]) {
  if (apostas.length === 0 || jogos.length === 0) return null;
  const apostasEmpate = apostas.filter((a) => a.placarCasa === a.placarVisitante).length;
  const jogosEmpate = jogos.filter((j) => j.placarCasa === j.placarVisitante).length;
  return {
    percentualApostas: Math.round((apostasEmpate / apostas.length) * 100),
    percentualJogos: Math.round((jogosEmpate / jogos.length) * 100),
  };
}

function esquecidos(
  jogos: JogoInput[], apostas: ApostaInput[], membros: Map<string, UserRef>,
) {
  if (jogos.length === 0) return [];
  const apostasPorUsuario = new Map<string, number>();
  for (const a of apostas) incrementar(apostasPorUsuario, a.usuarioId);
  const faltas = new Map<string, number>();
  for (const usuarioId of membros.keys()) {
    faltas.set(usuarioId, jogos.length - (apostasPorUsuario.get(usuarioId) ?? 0));
  }
  return topEntries(faltas, membros);
}
