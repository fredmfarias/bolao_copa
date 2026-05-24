import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertApostaDto } from './dto/upsert-aposta.dto';
import {
  FASES_ELIMINATORIAS, MAX_APOSTAS_IGUAIS_GRUPOS,
  MAX_APOSTAS_IGUAIS_ELIMINATORIAS, MINUTOS_PRAZO_APOSTA,
} from '@bolao/shared';

@Injectable()
export class ApostaService {
  constructor(private prisma: PrismaService) {}

  async upsert(usuarioId: string, dto: UpsertApostaDto) {
    const jogo = await this.prisma.jogo.findUnique({ where: { id: dto.jogoId } });
    if (!jogo) throw new NotFoundException('Jogo não encontrado.');

    const prazo = new Date(jogo.dataHora.getTime() - MINUTOS_PRAZO_APOSTA * 60 * 1000);
    if (new Date() >= prazo) throw new ForbiddenException('Prazo para apostas encerrado.');

    const membro = await this.prisma.bolaoMembro.findUnique({
      where: { bolaoId_usuarioId: { bolaoId: dto.bolaoId, usuarioId } },
    });
    if (!membro) throw new ForbiddenException('Você não é membro deste bolão.');

    const apostaExistente = await this.prisma.aposta.findUnique({
      where: { usuarioId_jogoId_bolaoId: { usuarioId, jogoId: dto.jogoId, bolaoId: dto.bolaoId } },
    });

    const placarMudou =
      !apostaExistente ||
      apostaExistente.placarCasa !== dto.placarCasa ||
      apostaExistente.placarVisitante !== dto.placarVisitante;

    if (placarMudou) {
      const isElim = FASES_ELIMINATORIAS.includes(jogo.fase as any);
      const limite = isElim ? MAX_APOSTAS_IGUAIS_ELIMINATORIAS : MAX_APOSTAS_IGUAIS_GRUPOS;

      const totalIguais = await this.prisma.aposta.count({
        where: {
          usuarioId,
          bolaoId: dto.bolaoId,
          placarCasa: dto.placarCasa,
          placarVisitante: dto.placarVisitante,
          jogo: { fase: isElim ? { in: FASES_ELIMINATORIAS as any } : { equals: 'GRUPOS' as any } },
        },
      });

      if (totalIguais >= limite) {
        throw new BadRequestException(
          `Limite de ${limite} apostas idênticas atingido para a fase ${isElim ? 'eliminatória' : 'de grupos'}.`,
        );
      }
    }

    return this.prisma.aposta.upsert({
      where: { usuarioId_jogoId_bolaoId: { usuarioId, jogoId: dto.jogoId, bolaoId: dto.bolaoId } },
      update: { placarCasa: dto.placarCasa, placarVisitante: dto.placarVisitante, pontuacao: null },
      create: { usuarioId, jogoId: dto.jogoId, bolaoId: dto.bolaoId, placarCasa: dto.placarCasa, placarVisitante: dto.placarVisitante },
    });
  }

  async listarPorBolao(bolaoId: string, usuarioId: string) {
    return this.prisma.aposta.findMany({
      where: { bolaoId, usuarioId },
      include: { jogo: { include: { selecaoCasa: true, selecaoVisitante: true } } },
      orderBy: { jogo: { dataHora: 'asc' } },
    });
  }

  async listarPalpitesPorJogo(bolaoId: string, jogoId: string) {
    const apostas = await this.prisma.aposta.findMany({
      where: { bolaoId, jogoId },
      include: { usuario: { select: { id: true, nome: true, avatarUrl: true } } },
      orderBy: [{ pontuacao: 'desc' }, { usuario: { nome: 'asc' } }],
    });
    return apostas.map(a => ({
      usuarioId: a.usuarioId,
      nome: a.usuario.nome,
      avatarUrl: a.usuario.avatarUrl,
      placarCasa: a.placarCasa,
      placarVisitante: a.placarVisitante,
      pontuacao: a.pontuacao,
    }));
  }
}
