import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@Injectable()
export class UsuarioService {
  constructor(private prisma: PrismaService) {}

  async perfil(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nome: true,
        email: true,
        avatarUrl: true,
        role: true,
        criadoEm: true,
        bolaoFavoritoId: true,
      },
    });
    if (!usuario) throw new NotFoundException();
    return usuario;
  }

  async atualizar(usuarioId: string, dto: UpdateUsuarioDto) {
    return this.prisma.usuario.update({
      where: { id: usuarioId },
      data: dto,
      select: { id: true, nome: true, email: true, avatarUrl: true },
    });
  }

  async atualizarFavorito(usuarioId: string, bolaoId: string | null) {
    if (bolaoId !== null) {
      const membro = await this.prisma.bolaoMembro.findUnique({
        where: { bolaoId_usuarioId: { bolaoId, usuarioId } },
      });
      if (!membro) throw new ForbiddenException('Você não é membro deste bolão.');
    }
    return this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { bolaoFavoritoId: bolaoId },
      select: {
        id: true,
        nome: true,
        email: true,
        avatarUrl: true,
        role: true,
        bolaoFavoritoId: true,
      },
    });
  }
}
