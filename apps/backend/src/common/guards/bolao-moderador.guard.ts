import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BolaoMembroPapel } from '@bolao/shared';

@Injectable()
export class BolaoModeradorGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId: string = request.user?.id;
    const bolaoId: string = request.params?.bolaoId ?? request.body?.bolaoId;

    if (!userId || !bolaoId) throw new ForbiddenException();

    const membro = await this.prisma.bolaoMembro.findUnique({
      where: { bolaoId_usuarioId: { bolaoId, usuarioId: userId } },
    });

    if (membro?.papel !== BolaoMembroPapel.MODERADOR) {
      throw new ForbiddenException('Apenas moderadores podem executar esta ação.');
    }
    return true;
  }
}
