import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SubscribeDto } from './dto/subscribe.dto';
import * as webpush from 'web-push';

@Injectable()
export class NotificacaoService {
  constructor(private prisma: PrismaService, private config: ConfigService) {
    webpush.setVapidDetails(
      config.get('VAPID_SUBJECT')!,
      config.get('VAPID_PUBLIC_KEY')!,
      config.get('VAPID_PRIVATE_KEY')!,
    );
  }

  async subscribe(usuarioId: string, dto: SubscribeDto) {
    await this.prisma.notificacaoSubscription.upsert({
      where: { endpoint: dto.endpoint } as any,
      update: { p256dh: dto.p256dh, auth: dto.auth },
      create: { usuarioId, endpoint: dto.endpoint, p256dh: dto.p256dh, auth: dto.auth },
    });
    return { message: 'Inscrito para notificações.' };
  }

  async unsubscribe(endpoint: string) {
    await this.prisma.notificacaoSubscription.deleteMany({ where: { endpoint } });
  }

  async enviarParaUsuario(usuarioId: string, payload: object) {
    const subs = await this.prisma.notificacaoSubscription.findMany({ where: { usuarioId } });
    await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        ),
      ),
    );
  }

  async enviarParaMembrosBolao(bolaoIds: string[], payload: object) {
    const membros = await this.prisma.bolaoMembro.findMany({
      where: { bolaoId: { in: bolaoIds } },
      select: { usuarioId: true },
      distinct: ['usuarioId'],
    });
    await Promise.all(membros.map((m) => this.enviarParaUsuario(m.usuarioId, payload)));
  }

  async processarLembrete(jogoId: string) {
    const jogo = await this.prisma.jogo.findUnique({
      where: { id: jogoId },
      include: { selecaoCasa: true, selecaoVisitante: true },
    });
    if (!jogo) return;

    const apostasExistentes = await this.prisma.aposta.findMany({
      where: { jogoId },
      select: { usuarioId: true, bolaoId: true },
    });
    const apostasSet = new Set(apostasExistentes.map((a) => `${a.usuarioId}:${a.bolaoId}`));

    const membros = await this.prisma.bolaoMembro.findMany({
      where: {
        bolao: {
          status: { in: ['ATIVO', 'PAGO'] },
          escopo: { in: ['AMBOS', jogo.fase === 'GRUPOS' ? 'GRUPOS' : 'ELIMINATORIAS'] },
        },
      },
      select: { usuarioId: true, bolaoId: true },
    });

    const usuariosUnicos = [
      ...new Set(
        membros
          .filter((m) => !apostasSet.has(`${m.usuarioId}:${m.bolaoId}`))
          .map((m) => m.usuarioId),
      ),
    ];

    await Promise.all(
      usuariosUnicos.map((uid) =>
        this.enviarParaUsuario(uid, {
          title: 'Lembrete de aposta!',
          body: `${(jogo.selecaoCasa as any).nome} x ${(jogo.selecaoVisitante as any).nome} começa em 2h. Faça sua aposta!`,
          jogoId,
        }),
      ),
    );
  }
}
