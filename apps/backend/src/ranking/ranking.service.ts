import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MINUTOS_PRAZO_APOSTA } from '@bolao/shared';

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

  async obterRanking(bolaoId: string, numero?: number) {
    const publicacao = numero
      ? await this.prisma.publicacao.findUnique({ where: { numero } })
      : await this.prisma.publicacao.findFirst({ orderBy: { numero: 'desc' } });
    if (!publicacao) return [];

    return this.prisma.rankingSnapshot.findMany({
      where: { bolaoId, publicacaoId: publicacao.id },
      include: { usuario: { select: { id: true, nome: true, avatarUrl: true } } },
      orderBy: { posicao: 'asc' },
    });
  }

  async listarPublicacoes(bolaoId: string) {
    const snapshots = await this.prisma.rankingSnapshot.findMany({
      where: { bolaoId },
      distinct: ['publicacaoId'],
      include: { publicacao: { select: { numero: true, publicadoEm: true } } },
      orderBy: { publicacao: { numero: 'desc' } },
    });
    return snapshots.map((s) => ({
      numero: s.publicacao.numero,
      publicadoEm: s.publicacao.publicadoEm,
    }));
  }

  async evolucao(bolaoId: string, usuarioId: string) {
    const snapshots = await this.prisma.rankingSnapshot.findMany({
      where: { bolaoId, usuarioId },
      include: { publicacao: { select: { numero: true } } },
      orderBy: { publicacao: { numero: 'asc' } },
    });
    return snapshots.map((s) => ({ numero: s.publicacao.numero, posicao: s.posicao }));
  }

  async palpitesDoUsuario(bolaoId: string, usuarioId: string) {
    const snapshots = await this.prisma.rankingSnapshot.findMany({
      where: { bolaoId },
      distinct: ['publicacaoId'],
      include: { publicacao: { select: { id: true, numero: true, publicadoEm: true } } },
      orderBy: { publicacao: { numero: 'desc' } },
    });

    const grupos = [];
    for (const s of snapshots) {
      const items = await this.montarPalpitesDaPublicacao(s.publicacao.id, usuarioId);
      if (items.length === 0) continue;
      grupos.push({
        publicacao: { numero: s.publicacao.numero, publicadoEm: s.publicacao.publicadoEm },
        items,
      });
    }
    return grupos;
  }

  async palpitesDaRodada(bolaoId: string, numero: number, usuarioId: string) {
    // bolaoId é mantido para autorização futura/symmetry; visibilidade segue padrão das apostas.
    const publicacao = await this.prisma.publicacao.findUnique({ where: { numero } });
    if (!publicacao) return [];
    return this.montarPalpitesDaPublicacao(publicacao.id, usuarioId);
  }

  private async montarPalpitesDaPublicacao(publicacaoId: string, usuarioId: string) {
    const jogos = await this.prisma.jogo.findMany({
      where: { publicacaoId },
      orderBy: { dataHora: 'asc' },
      select: {
        id: true, dataHora: true, pesoPontuacao: true,
        placarCasa: true, placarVisitante: true,
        selecaoCasa:      { select: { nome: true, codigo: true, bandeiraSvg: true } },
        selecaoVisitante: { select: { nome: true, codigo: true, bandeiraSvg: true } },
      },
    });

    // Segurança: só revela palpites de jogos cujas apostas já encerraram,
    // mesma regra de listarPalpitesPorJogo — publicação sozinha não garante prazo.
    const agora = Date.now();
    const visiveis = jogos.filter(
      (j) => agora >= j.dataHora.getTime() - MINUTOS_PRAZO_APOSTA * 60 * 1000,
    );
    if (visiveis.length === 0) return [];

    const apostas = await this.prisma.aposta.findMany({
      where: { usuarioId, jogoId: { in: visiveis.map((j) => j.id) } },
      select: { jogoId: true, placarCasa: true, placarVisitante: true, pontuacao: true },
    });
    const apostaPorJogo = new Map(apostas.map((a) => [a.jogoId, a]));

    return visiveis.map((jogo) => {
      const a = apostaPorJogo.get(jogo.id);
      return {
        jogo,
        palpite: a ? { placarCasa: a.placarCasa, placarVisitante: a.placarVisitante } : null,
        pontuacao: a?.pontuacao ?? 0,
      };
    });
  }

  async recalcularRankingBolao(bolaoId: string) {
    const membros = await this.prisma.bolaoMembro.findMany({
      where: { bolaoId, usuario: { ativo: true } },
      select: { usuarioId: true, usuario: { select: { nome: true } } },
    });
    const usuarioIds = membros.map((m) => m.usuarioId);

    const apostas = await this.prisma.aposta.findMany({
      where: { usuarioId: { in: usuarioIds }, pontuacao: { not: null } },
      include: { jogo: true },
    });

    const porUsuario = new Map<string, any>();

    // Semeia todos os membros ativos zerados, carregando o nome para o desempate.
    for (const m of membros) {
      porUsuario.set(m.usuarioId, {
        nome: m.usuario.nome,
        pontuacaoTotal: 0, acertosPlacarExato: 0, acertosPlacarVencedor: 0,
        acertosPlacarPerdedor: 0, acertosEmpate: 0, acertosGanhador: 0,
        acertosNada: 0, apostasPostadas: 0,
      });
    }

    for (const aposta of apostas) {
      const r = porUsuario.get(aposta.usuarioId);
      if (!r) continue;
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
      const { nome, ...dados } = r; // nome é só para o desempate, não é coluna do Ranking
      await this.prisma.ranking.upsert({
        where: { bolaoId_usuarioId: { bolaoId, usuarioId: r.usuarioId } },
        update: dados,
        create: { bolaoId, ...dados },
      });
    }

    // Remove linhas de membros não-ativos (ex.: desativados após o join).
    await this.prisma.ranking.deleteMany({
      where: { bolaoId, usuarioId: { notIn: usuarioIds } },
    });
  }

  private comparadorRanking(a: any, b: any): number {
    if (b.pontuacaoTotal !== a.pontuacaoTotal) return b.pontuacaoTotal - a.pontuacaoTotal;
    if (b.acertosPlacarExato !== a.acertosPlacarExato) return b.acertosPlacarExato - a.acertosPlacarExato;
    if (b.acertosPlacarVencedor !== a.acertosPlacarVencedor) return b.acertosPlacarVencedor - a.acertosPlacarVencedor;
    if (b.acertosEmpate !== a.acertosEmpate) return b.acertosEmpate - a.acertosEmpate;
    if (b.acertosPlacarPerdedor !== a.acertosPlacarPerdedor) return b.acertosPlacarPerdedor - a.acertosPlacarPerdedor;
    if (b.acertosGanhador !== a.acertosGanhador) return b.acertosGanhador - a.acertosGanhador;
    return (a.nome ?? '').localeCompare(b.nome ?? '');
  }
}
