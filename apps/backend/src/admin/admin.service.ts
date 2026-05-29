import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RankingService } from '../ranking/ranking.service';
import { PublicacaoService } from '../publicacao/publicacao.service';
import { BolaoService } from '../bolao/bolao.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CreateUsuarioAdminDto } from './dto/create-usuario-admin.dto';
import { BOLAO_GLOBAL_ID } from '@bolao/shared';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private ranking: RankingService,
    private publicacao: PublicacaoService,
    private bolao: BolaoService,
    private jwt: JwtService,
    private config: ConfigService,
    @Inject('MAILER') private mailer: any,
  ) {}

  async listarBoloes() {
    return this.prisma.bolao.findMany({
      select: {
        id: true, nome: true, descricao: true, status: true,
        precoReais: true, maxParticipantes: true,
        _count: { select: { membros: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async getRankingDraft(bolaoId: string) {
    const bolao = await this.prisma.bolao.findUnique({ where: { id: bolaoId } });
    if (!bolao) throw new NotFoundException('Bolão não encontrado.');

    await this.ranking.recalcularRankingBolao(bolaoId);
    const rankings = await this.prisma.ranking.findMany({
      where: { bolaoId },
      include: { usuario: { select: { id: true, nome: true, avatarUrl: true } } },
      orderBy: { posicao: 'asc' },
    });

    const ultima = await this.prisma.publicacao.findFirst({ orderBy: { numero: 'desc' } });
    const anteriores = ultima
      ? await this.prisma.rankingSnapshot.findMany({
          where: { bolaoId, publicacaoId: ultima.id },
          select: { usuarioId: true, posicao: true },
        })
      : [];
    const posicaoAnterior = new Map<string, number>(
      anteriores.map((s) => [s.usuarioId, s.posicao]),
    );

    return rankings.map((r) => ({
      ...r,
      posicoesGanhas:
        posicaoAnterior.get(r.usuarioId) !== undefined
          ? (posicaoAnterior.get(r.usuarioId) as number) - r.posicao
          : 0,
    }));
  }

  async listarUsuarios() {
    return this.prisma.usuario.findMany({
      select: { id: true, nome: true, email: true, role: true, ativo: true, avatarUrl: true, criadoEm: true },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async atualizarUsuario(id: string, dto: { role?: 'ADMIN' | 'USER'; ativo?: boolean }) {
    return this.prisma.usuario.update({
      where: { id },
      data: dto,
      select: { id: true, nome: true, email: true, role: true, ativo: true },
    });
  }

  async buscarUsuarios(q: string) {
    if (!q.trim()) return [];
    return this.prisma.usuario.findMany({
      where: {
        OR: [
          { nome: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, nome: true, email: true, avatarUrl: true },
      take: 10,
    });
  }

  async listarPublicacaoPendente() {
    return this.publicacao.listarJogosPendentes();
  }

  async resetarSenha(id: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuário não encontrado.');

    const token = await this.jwt.signAsync(
      { sub: usuario.id, type: 'reset-password' },
      { secret: this.config.get('JWT_SECRET'), expiresIn: '1h' },
    );
    const url = `${this.config.get('APP_URL')}/auth/nova-senha?token=${token}`;
    await this.mailer.sendMail({
      to: usuario.email,
      subject: 'Redefinição de senha — Bolão Trovão',
      html: `<p>Um administrador solicitou a redefinição da sua senha. Clique: <a href="${url}">${url}</a></p>`,
    });
    return { message: 'E-mail de redefinição enviado.' };
  }

  async criarUsuario(dto: CreateUsuarioAdminDto) {
    const existe = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (existe) throw new ConflictException('E-mail já cadastrado.');

    const senhaHash = await bcrypt.hash(dto.senhaTemp, 12);
    const usuario = await this.prisma.usuario.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        senhaHash,
        emailVerificado: true,
      },
    });

    await this.prisma.bolaoMembro.create({
      data: { bolaoId: BOLAO_GLOBAL_ID, usuarioId: usuario.id },
    });
    await this.prisma.ranking.create({
      data: { bolaoId: BOLAO_GLOBAL_ID, usuarioId: usuario.id },
    });

    if (dto.bolaoId && dto.bolaoId !== BOLAO_GLOBAL_ID) {
      await this.bolao.adicionarMembro(dto.bolaoId, usuario.id);
    }

    return { id: usuario.id, nome: usuario.nome, email: usuario.email };
  }
}
