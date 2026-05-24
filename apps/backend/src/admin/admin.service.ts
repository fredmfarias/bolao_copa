import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getRankingDraft(bolaoId: string) {
    const bolao = await this.prisma.bolao.findUnique({ where: { id: bolaoId } });
    if (!bolao) throw new NotFoundException('Bolão não encontrado.');

    return this.prisma.ranking.findMany({
      where: { bolaoId },
      include: { usuario: { select: { id: true, nome: true, avatarUrl: true } } },
      orderBy: [{ posicao: 'asc' }],
    });
  }

  async publicarRanking(bolaoId: string) {
    const bolao = await this.prisma.bolao.findUnique({ where: { id: bolaoId } });
    if (!bolao) throw new NotFoundException('Bolão não encontrado.');

    await this.prisma.bolao.update({
      where: { id: bolaoId },
      data: { status: 'PAGO' },
    });

    return { publicadoEm: new Date().toISOString() };
  }

  async listarUsuarios() {
    return this.prisma.usuario.findMany({
      select: { id: true, nome: true, email: true, role: true, avatarUrl: true, criadoEm: true },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async atualizarUsuario(id: string, dto: { role?: 'ADMIN' | 'USER' }) {
    return this.prisma.usuario.update({
      where: { id },
      data: dto,
      select: { id: true, nome: true, email: true, role: true },
    });
  }
}
