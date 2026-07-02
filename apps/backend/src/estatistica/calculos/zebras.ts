// apps/backend/src/estatistica/calculos/zebras.ts
import { ApostaInput, JogoInput, UserRef, Zebras } from '../estatistica.types';

const MAX_SOLITARIOS = 10;

export function calcularZebras(
  jogos: JogoInput[],
  apostas: ApostaInput[],
  membros: Map<string, UserRef>,
): Zebras {
  const apostasPorJogo = new Map<string, ApostaInput[]>();
  for (const a of apostas) {
    if (!membros.has(a.usuarioId)) continue;
    const lista = apostasPorJogo.get(a.jogoId) ?? [];
    lista.push(a);
    apostasPorJogo.set(a.jogoId, lista);
  }

  const percentuais: Array<{ jogo: string; percentualPontuaram: number }> = [];
  const solitarios: Zebras['acertosSolitarios'] = [];

  // Mais recentes primeiro, para a lista de solitários já sair ordenada.
  const ordenados = [...jogos].sort((a, b) => b.dataHora.getTime() - a.dataHora.getTime());

  for (const j of ordenados) {
    const doJogo = apostasPorJogo.get(j.id) ?? [];
    if (doJogo.length === 0) continue;

    const pontuaram = doJogo.filter((a) => (a.pontuacao ?? 0) > 0).length;
    percentuais.push({
      jogo: j.descricao,
      percentualPontuaram: Math.round((pontuaram / doJogo.length) * 100),
    });

    const exatas = doJogo.filter(
      (a) => a.placarCasa === j.placarCasa && a.placarVisitante === j.placarVisitante,
    );
    if (exatas.length === 1 && solitarios.length < MAX_SOLITARIOS) {
      solitarios.push({
        jogo: j.descricao,
        usuario: membros.get(exatas[0].usuarioId)!,
        placar: `${j.placarCasa}x${j.placarVisitante}`,
      });
    }
  }

  if (percentuais.length === 0) {
    return { zebra: null, previsivel: null, acertosSolitarios: solitarios };
  }
  const zebra = percentuais.reduce((a, b) =>
    b.percentualPontuaram < a.percentualPontuaram ? b : a,
  );
  const previsivel = percentuais.reduce((a, b) =>
    b.percentualPontuaram > a.percentualPontuaram ? b : a,
  );
  return { zebra, previsivel, acertosSolitarios: solitarios };
}
