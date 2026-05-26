import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RankingService } from '../ranking/ranking.service';

@Injectable()
export class PublicacaoService {
  constructor(
    private prisma: PrismaService,
    private ranking: RankingService,
  ) {}

  async publicar(usuarioId: string) {
    const ultima = await this.prisma.publicacao.findFirst({
      orderBy: { numero: 'desc' },
    });
    const numero = (ultima?.numero ?? 0) + 1;

    const publicacao = await this.prisma.publicacao.create({
      data: { numero, publicadoPorId: usuarioId },
    });

    // Jogos encerrados (com placar) ainda não publicados entram nesta rodada.
    await this.prisma.jogo.updateMany({
      where: { placarCasa: { not: null }, publicacaoId: null },
      data: { publicacaoId: publicacao.id },
    });

    const jogosRodada = await this.prisma.jogo.findMany({
      where: { publicacaoId: publicacao.id },
      select: { id: true },
    });
    const jogoIds = jogosRodada.map((j) => j.id);

    // Pontos da rodada por usuário (apostas global, valem para todos os bolões).
    const apostasRodada = await this.prisma.aposta.findMany({
      where: { jogoId: { in: jogoIds }, pontuacao: { not: null } },
      select: { usuarioId: true, pontuacao: true },
    });
    const pontosRodadaPorUsuario = new Map<string, number>();
    for (const a of apostasRodada) {
      pontosRodadaPorUsuario.set(
        a.usuarioId,
        (pontosRodadaPorUsuario.get(a.usuarioId) ?? 0) + (a.pontuacao ?? 0),
      );
    }

    const boloes = await this.prisma.bolao.findMany({
      where: { status: 'PAGO' },
      select: { id: true },
    });

    for (const bolao of boloes) {
      await this.ranking.recalcularRankingBolao(bolao.id);

      const rankings = await this.prisma.ranking.findMany({
        where: { bolaoId: bolao.id },
        orderBy: { posicao: 'asc' },
      });

      // Posições da publicação anterior, para calcular variação.
      const anteriores = ultima
        ? await this.prisma.rankingSnapshot.findMany({
            where: { bolaoId: bolao.id, publicacaoId: ultima.id },
            select: { usuarioId: true, posicao: true },
          })
        : [];
      const posicaoAnterior = new Map<string, number>(
        anteriores.map((s) => [s.usuarioId, s.posicao]),
      );

      for (const r of rankings) {
        const anterior = posicaoAnterior.get(r.usuarioId);
        const posicoesGanhas = anterior !== undefined ? anterior - r.posicao : 0;

        await this.prisma.rankingSnapshot.create({
          data: {
            publicacaoId: publicacao.id,
            bolaoId: bolao.id,
            usuarioId: r.usuarioId,
            posicao: r.posicao,
            posicoesGanhas,
            pontuacaoTotal: r.pontuacaoTotal,
            pontuacaoRodada: pontosRodadaPorUsuario.get(r.usuarioId) ?? 0,
            acertosPlacarExato: r.acertosPlacarExato,
            acertosPlacarVencedor: r.acertosPlacarVencedor,
            acertosPlacarPerdedor: r.acertosPlacarPerdedor,
            acertosEmpate: r.acertosEmpate,
            acertosGanhador: r.acertosGanhador,
            acertosNada: r.acertosNada,
            apostasPostadas: r.apostasPostadas,
          },
        });
      }
    }

    return { numero: publicacao.numero, publicadoEm: publicacao.publicadoEm };
  }
}
