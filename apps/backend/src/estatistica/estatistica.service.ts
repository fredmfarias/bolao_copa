// apps/backend/src/estatistica/estatistica.service.ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstatisticasBolao, UserRef } from './estatistica.types';
import { calcularPosicoes } from './calculos/posicoes';
import { calcularRecordes } from './calculos/recordes';
import { calcularPalpites } from './calculos/palpites';
import { calcularZebras } from './calculos/zebras';

type Publicacao = { id: string; numero: number; publicadoEm: Date };

@Injectable()
export class EstatisticaService {
  /** Uma entrada por bolão; a chave de validade é o id da última publicação. */
  private cache = new Map<string, { publicacaoId: string; data: EstatisticasBolao }>();

  constructor(private prisma: PrismaService) {}

  async obter(bolaoId: string, usuarioId: string): Promise<EstatisticasBolao> {
    const bolao = await this.prisma.bolao.findUnique({ where: { id: bolaoId } });
    if (!bolao) throw new NotFoundException('Bolão não encontrado.');

    const membro = await this.prisma.bolaoMembro.findUnique({
      where: { bolaoId_usuarioId: { bolaoId, usuarioId } },
    });
    if (!membro) throw new ForbiddenException('Você não é membro deste bolão.');

    const ultima = await this.prisma.publicacao.findFirst({
      orderBy: { numero: 'desc' },
      select: { id: true, numero: true, publicadoEm: true },
    });
    if (!ultima) return { temDados: false };

    const cached = this.cache.get(bolaoId);
    if (cached?.publicacaoId === ultima.id) return cached.data;

    const data = await this.calcular(bolaoId, ultima);
    this.cache.set(bolaoId, { publicacaoId: ultima.id, data });
    return data;
  }

  private async calcular(bolaoId: string, ultima: Publicacao): Promise<EstatisticasBolao> {
    const membrosDb = await this.prisma.bolaoMembro.findMany({
      where: { bolaoId, usuario: { ativo: true } },
      select: { usuario: { select: { id: true, nome: true, avatarUrl: true } } },
    });
    const membros = new Map<string, UserRef>(membrosDb.map((m) => [m.usuario.id, m.usuario]));

    const snapshotsDb = await this.prisma.rankingSnapshot.findMany({
      where: { bolaoId, usuario: { ativo: true } },
      select: {
        usuarioId: true, posicao: true, posicoesGanhas: true,
        pontuacaoRodada: true, acertosPlacarExato: true,
        publicacao: { select: { numero: true } },
      },
    });
    if (snapshotsDb.length === 0) return { temDados: false };
    const snapshots = snapshotsDb.map((s) => ({
      usuarioId: s.usuarioId,
      publicacaoNumero: s.publicacao.numero,
      posicao: s.posicao,
      posicoesGanhas: s.posicoesGanhas,
      pontuacaoRodada: s.pontuacaoRodada,
      acertosPlacarExato: s.acertosPlacarExato,
    }));

    const jogosDb = await this.prisma.jogo.findMany({
      where: {
        publicacaoId: { not: null },
        placarCasa: { not: null },
        placarVisitante: { not: null },
      },
      select: {
        id: true, dataHora: true, fase: true, pesoPontuacao: true,
        placarCasa: true, placarVisitante: true,
        selecaoCasa: { select: { nome: true } },
        selecaoVisitante: { select: { nome: true } },
      },
    });
    const jogos = jogosDb.map((j) => ({
      id: j.id,
      dataHora: j.dataHora,
      fase: j.fase as string,
      pesoPontuacao: j.pesoPontuacao,
      placarCasa: j.placarCasa!,
      placarVisitante: j.placarVisitante!,
      descricao: `${j.selecaoCasa.nome} x ${j.selecaoVisitante.nome}`,
    }));

    const apostas = await this.prisma.aposta.findMany({
      where: {
        usuarioId: { in: [...membros.keys()] },
        jogoId: { in: jogos.map((j) => j.id) },
      },
      select: {
        usuarioId: true, jogoId: true, placarCasa: true, placarVisitante: true,
        pontuacao: true, criadoEm: true, palpiteAtualizadoEm: true,
      },
    });

    const config = await this.prisma.configuracaoPontuacao.findFirst({ where: { nivel: 1 } });
    const pontosPlacarExato = config?.pontos ?? 0;

    return {
      temDados: true,
      ultimaPublicacao: { numero: ultima.numero, publicadoEm: ultima.publicadoEm },
      posicoes: calcularPosicoes(snapshots, membros),
      recordes: calcularRecordes(snapshots, jogos, apostas, membros, pontosPlacarExato),
      palpites: calcularPalpites(jogos, apostas, membros),
      zebras: calcularZebras(jogos, apostas, membros),
    };
  }
}
