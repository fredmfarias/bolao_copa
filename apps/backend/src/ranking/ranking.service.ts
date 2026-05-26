import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Placar = { placarCasa: number; placarVisitante: number };

@Injectable()
export class RankingService {
  constructor(private prisma: PrismaService) {}

  calcularNivel(aposta: Placar, jogo: Placar): 0 | 1 | 2 | 3 | 4 | 5 {
    const { placarCasa: ac, placarVisitante: av } = aposta;
    const { placarCasa: jc, placarVisitante: jv } = jogo;

    if (ac === jc && av === jv) return 1;

    const resJogo   = jc > jv ? 'casa' : jv > jc ? 'visitante' : 'empate';
    const resAposta = ac > av ? 'casa' : av > ac ? 'visitante' : 'empate';

    if (resAposta !== resJogo) return 0;
    if (resJogo === 'empate') return 3;

    const acertouVencedor = resJogo === 'casa' ? ac === jc : av === jv;
    const acertouPerdedor = resJogo === 'casa' ? av === jv : ac === jc;

    if (acertouVencedor) return 2;
    if (acertouPerdedor) return 4;
    return 5;
  }

  async recalcularParaJogo(jogoId: string) {
    const jogo = await this.prisma.jogo.findUnique({ where: { id: jogoId } });
    if (!jogo || jogo.placarCasa === null || jogo.placarVisitante === null) return;

    const configs = await this.prisma.configuracaoPontuacao.findMany();
    const pontosNivel = Object.fromEntries(configs.map((c) => [c.nivel, c.pontos]));

    const apostas = await this.prisma.aposta.findMany({ where: { jogoId } });

    for (const aposta of apostas) {
      const nivel = this.calcularNivel(
        { placarCasa: aposta.placarCasa, placarVisitante: aposta.placarVisitante },
        { placarCasa: jogo.placarCasa!, placarVisitante: jogo.placarVisitante! },
      );
      const pontuacao = nivel === 0 ? 0 : (pontosNivel[nivel] ?? 0) * jogo.pesoPontuacao;
      await this.prisma.aposta.update({ where: { id: aposta.id }, data: { pontuacao } });
    }

    const usuarioIds = apostas.map(a => a.usuarioId);
    const membros = await this.prisma.bolaoMembro.findMany({
      where: { usuarioId: { in: usuarioIds } },
      select: { bolaoId: true },
    });
    const bolaoIds = [...new Set(membros.map(m => m.bolaoId))];
    for (const bolaoId of bolaoIds) {
      await this.recalcularRankingBolao(bolaoId);
    }
  }

  async obterRanking(bolaoId: string) {
    return this.prisma.ranking.findMany({
      where: { bolaoId, bolao: { status: 'PAGO' } },
      include: { usuario: { select: { id: true, nome: true, avatarUrl: true } } },
      orderBy: [{ posicao: 'asc' }],
    });
  }

  async recalcularRankingBolao(bolaoId: string) {
    const membros = await this.prisma.bolaoMembro.findMany({
      where: { bolaoId },
      select: { usuarioId: true },
    });
    const usuarioIds = membros.map(m => m.usuarioId);

    const apostas = await this.prisma.aposta.findMany({
      where: { usuarioId: { in: usuarioIds }, pontuacao: { not: null } },
      include: { jogo: true },
    });

    const porUsuario = new Map<string, any>();

    for (const aposta of apostas) {
      if (!porUsuario.has(aposta.usuarioId)) {
        porUsuario.set(aposta.usuarioId, {
          pontuacaoTotal: 0, acertosPlacarExato: 0, acertosPlacarVencedor: 0,
          acertosPlacarPerdedor: 0, acertosEmpate: 0, acertosGanhador: 0,
          acertosNada: 0, apostasPostadas: 0,
        });
      }
      const r = porUsuario.get(aposta.usuarioId);
      r.apostasPostadas += 1;
      r.pontuacaoTotal += aposta.pontuacao ?? 0;

      if (aposta.jogo.placarCasa !== null && aposta.jogo.placarVisitante !== null) {
        const nivel = this.calcularNivel(
          { placarCasa: aposta.placarCasa, placarVisitante: aposta.placarVisitante },
          { placarCasa: aposta.jogo.placarCasa, placarVisitante: aposta.jogo.placarVisitante },
        );
        if (nivel === 1) r.acertosPlacarExato += 1;
        else if (nivel === 2) r.acertosPlacarVencedor += 1;
        else if (nivel === 3) r.acertosEmpate += 1;
        else if (nivel === 4) r.acertosPlacarPerdedor += 1;
        else if (nivel === 5) r.acertosGanhador += 1;
        else r.acertosNada += 1;
      }
    }

    const rankings = Array.from(porUsuario.entries())
      .map(([usuarioId, dados]) => ({ usuarioId, ...dados }));

    rankings.sort(this.comparadorRanking);
    rankings.forEach((r, idx) => (r.posicao = idx + 1));

    for (const r of rankings) {
      await this.prisma.ranking.upsert({
        where: { bolaoId_usuarioId: { bolaoId, usuarioId: r.usuarioId } },
        update: r,
        create: { bolaoId, ...r },
      });
    }
  }

  private comparadorRanking(a: any, b: any): number {
    if (b.pontuacaoTotal !== a.pontuacaoTotal) return b.pontuacaoTotal - a.pontuacaoTotal;
    if (b.acertosPlacarExato !== a.acertosPlacarExato) return b.acertosPlacarExato - a.acertosPlacarExato;
    if (b.acertosPlacarVencedor !== a.acertosPlacarVencedor) return b.acertosPlacarVencedor - a.acertosPlacarVencedor;
    if (b.acertosEmpate !== a.acertosEmpate) return b.acertosEmpate - a.acertosEmpate;
    if (b.acertosPlacarPerdedor !== a.acertosPlacarPerdedor) return b.acertosPlacarPerdedor - a.acertosPlacarPerdedor;
    if (b.acertosGanhador !== a.acertosGanhador) return b.acertosGanhador - a.acertosGanhador;
    return 0;
  }
}
