import {
  Injectable, BadRequestException, NotFoundException,
  ForbiddenException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InscricaoWindowService } from '../inscricao-window/inscricao-window.service';
import { CreateBolaoDto } from './dto/create-bolao.dto';
import { UpdateBolaoStatusDto } from './dto/update-bolao-status.dto';
import { BolaoMembroPapel, BolaoStatus, BOLAO_GLOBAL_ID, StatusPagamento } from '@bolao/shared';

@Injectable()
export class BolaoService {
  constructor(
    private prisma: PrismaService,
    private inscricaoWindow: InscricaoWindowService,
  ) {}

  async criar(adminId: string, dto: CreateBolaoDto) {
    if (dto.maxParticipantes % 10 !== 0) {
      throw new BadRequestException('maxParticipantes deve ser múltiplo de 10.');
    }
    const precoReais = dto.maxParticipantes * 1;
    const { moderadorId, ...bolaoData } = dto;

    const moderador = await this.prisma.usuario.findUnique({ where: { id: moderadorId } });
    if (!moderador) throw new NotFoundException('Moderador não encontrado.');

    const bolao = await this.prisma.bolao.create({
      data: { ...bolaoData, precoReais, criadoPorId: adminId },
    });
    await this.prisma.bolaoMembro.create({
      data: { bolaoId: bolao.id, usuarioId: moderadorId, papel: BolaoMembroPapel.MODERADOR },
    });
    await this.prisma.ranking.create({ data: { bolaoId: bolao.id, usuarioId: moderadorId } });
    return bolao;
  }

  async listarMeus(usuarioId: string) {
    return this.prisma.bolao.findMany({
      where: { membros: { some: { usuarioId } } },
      include: { _count: { select: { membros: true } } },
      orderBy: { criadoEm: 'asc' },
    });
  }

  async buscarPorNome(nome: string) {
    return this.prisma.bolao.findMany({
      where: { nome: { contains: nome, mode: 'insensitive' }, status: BolaoStatus.ATIVO },
      select: { id: true, nome: true, descricao: true, _count: { select: { membros: true } } },
    });
  }

  async obter(bolaoId: string) {
    const bolao = await this.prisma.bolao.findUnique({
      where: { id: bolaoId },
      include: {
        membros: { include: { usuario: { select: { id: true, nome: true, avatarUrl: true } } } },
      },
    });
    if (!bolao) throw new NotFoundException('Bolão não encontrado.');
    return bolao;
  }

  async gerarConvite(bolaoId: string, criadoPorId: string, expiraEm?: Date) {
    return this.prisma.bolaoConvite.create({ data: { bolaoId, criadoPorId, expiraEm } });
  }

  async entrarViaConvite(user: { id: string; role: string }, token: string) {
    await this.inscricaoWindow.assertAberta(user);
    const convite = await this.prisma.bolaoConvite.findUnique({ where: { token } });
    if (!convite) throw new BadRequestException('Convite inválido.');
    if (convite.expiraEm && convite.expiraEm < new Date()) {
      throw new BadRequestException('Convite expirado.');
    }
    return this.adicionarMembro(convite.bolaoId, user.id);
  }

  async solicitarEntrada(bolaoId: string, usuarioId: string) {
    const existe = await this.prisma.bolaoMembro.findUnique({
      where: { bolaoId_usuarioId: { bolaoId, usuarioId } },
    });
    if (existe) throw new ConflictException('Você já é membro deste bolão.');
    return { message: 'Solicitação registrada. Aguarde aprovação do moderador.' };
  }

  async aprovarMembro(user: { id: string; role: string }, bolaoId: string, usuarioId: string) {
    await this.inscricaoWindow.assertAberta(user);
    return this.adicionarMembro(bolaoId, usuarioId);
  }

  async removerMembro(bolaoId: string, usuarioId: string) {
    if (bolaoId === BOLAO_GLOBAL_ID) {
      throw new ForbiddenException('Não é possível remover membros do bolão global.');
    }
    await this.prisma.bolaoMembro.delete({
      where: { bolaoId_usuarioId: { bolaoId, usuarioId } },
    });
    await this.prisma.ranking.deleteMany({ where: { bolaoId, usuarioId } });
  }

  async elegerModerador(bolaoId: string, usuarioId: string) {
    await this.prisma.bolaoMembro.update({
      where: { bolaoId_usuarioId: { bolaoId, usuarioId } },
      data: { papel: BolaoMembroPapel.MODERADOR },
    });
  }

  async atualizarStatus(bolaoId: string, dto: UpdateBolaoStatusDto) {
    return this.prisma.bolao.update({ where: { id: bolaoId }, data: { status: dto.status } });
  }

  async atualizarPagamento(bolaoId: string, usuarioId: string, status: StatusPagamento) {
    return this.prisma.bolaoMembro.update({
      where: { bolaoId_usuarioId: { bolaoId, usuarioId } },
      data: { statusPagamento: status },
    });
  }

  async lookupConvite(token: string) {
    const convite = await this.prisma.bolaoConvite.findUnique({
      where: { token },
      include: { bolao: true, criadoPor: { select: { nome: true } } },
    });
    if (!convite) return { valido: false, bolaoId: null, bolaoNome: null, descricao: null, criadorNome: null, expiraEm: null };
    const valido = !convite.expiraEm || convite.expiraEm > new Date();
    return {
      valido,
      bolaoId: convite.bolaoId,
      bolaoNome: convite.bolao.nome,
      descricao: convite.bolao.descricao,
      criadorNome: convite.criadoPor.nome,
      expiraEm: convite.expiraEm?.toISOString() ?? null,
    };
  }

  async adicionarMembro(bolaoId: string, usuarioId: string) {
    const bolao = await this.prisma.bolao.findUnique({ where: { id: bolaoId } });
    if (!bolao) throw new NotFoundException('Bolão não encontrado.');

    const jaEMembro = await this.prisma.bolaoMembro.findUnique({
      where: { bolaoId_usuarioId: { bolaoId, usuarioId } },
    });
    if (jaEMembro) throw new ConflictException('Você já é membro deste bolão.');

    const totalMembros = await this.prisma.bolaoMembro.count({ where: { bolaoId } });
    if (totalMembros >= bolao.maxParticipantes) {
      throw new BadRequestException('Bolão lotado.');
    }

    const membro = await this.prisma.bolaoMembro.create({ data: { bolaoId, usuarioId } });
    await this.prisma.ranking.create({ data: { bolaoId, usuarioId } });
    return membro;
  }
}
