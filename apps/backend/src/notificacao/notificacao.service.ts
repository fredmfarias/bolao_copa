import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SubscribeDto } from './dto/subscribe.dto';
import * as webpush from 'web-push';

@Injectable()
export class NotificacaoService {
  private readonly logger = new Logger(NotificacaoService.name);
  private vapidConfigured: boolean;

  constructor(private prisma: PrismaService, private config: ConfigService) {
    const pub = config.get<string>('VAPID_PUBLIC_KEY');
    const priv = config.get<string>('VAPID_PRIVATE_KEY');
    this.vapidConfigured = !!(pub && priv);
    if (this.vapidConfigured) {
      try {
        webpush.setVapidDetails(
          config.get('VAPID_MAILTO') ?? 'mailto:admin@bolao.local',
          pub!,
          priv!,
        );
        this.logger.log('VAPID configurado com sucesso.');
      } catch (err) {
        this.logger.error('Falha ao configurar VAPID:', err);
        this.vapidConfigured = false;
      }
    } else {
      this.logger.warn('VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY não definidos — push desabilitado.');
    }
  }

  async subscribe(usuarioId: string, dto: SubscribeDto) {
    await this.prisma.notificacaoSubscription.upsert({
      where: { endpoint: dto.endpoint } as any,
      update: { p256dh: dto.p256dh, auth: dto.auth },
      create: { usuarioId, endpoint: dto.endpoint, p256dh: dto.p256dh, auth: dto.auth },
    });
    this.logger.log(`Subscription registrada: usuário=${usuarioId}`);
    return { message: 'Inscrito para notificações.' };
  }

  async unsubscribe(endpoint: string) {
    await this.prisma.notificacaoSubscription.deleteMany({ where: { endpoint } });
  }

  async enviarParaUsuario(usuarioId: string, payload: object) {
    if (!this.vapidConfigured) return;
    const subs = await this.prisma.notificacaoSubscription.findMany({ where: { usuarioId } });
    if (subs.length === 0) return;
    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        ),
      ),
    );
    const erros = results.filter((r) => r.status === 'rejected');
    if (erros.length) this.logger.warn(`${erros.length} push(es) falharam para usuário=${usuarioId}`);
  }

  async enviarParaMembrosBolao(bolaoIds: string[], payload: object) {
    const membros = await this.prisma.bolaoMembro.findMany({
      where: { bolaoId: { in: bolaoIds } },
      select: { usuarioId: true },
      distinct: ['usuarioId'],
    });
    await Promise.all(membros.map((m) => this.enviarParaUsuario(m.usuarioId, payload)));
  }

  async enviarParaTodos(payload: object) {
    if (!this.vapidConfigured) {
      this.logger.warn('enviarParaTodos: VAPID não configurado, abortando.');
      return;
    }
    const subs = await this.prisma.notificacaoSubscription.findMany({
      distinct: ['usuarioId'],
      select: { usuarioId: true },
    });
    this.logger.log(`enviarParaTodos: ${subs.length} assinante(s). Payload: ${JSON.stringify(payload)}`);
    await Promise.all(subs.map((s) => this.enviarParaUsuario(s.usuarioId, payload)));
  }

  async enviarParaLista(usuarioIds: string[], payload: object) {
    if (!this.vapidConfigured) {
      this.logger.warn('enviarParaLista: VAPID não configurado, abortando.');
      return;
    }
    this.logger.log(`enviarParaLista: ${usuarioIds.length} usuário(s). Payload: ${JSON.stringify(payload)}`);
    await Promise.all(usuarioIds.map((id) => this.enviarParaUsuario(id, payload)));
  }

  async processarLembrete(jogoId: string) {
    const jogo = await this.prisma.jogo.findUnique({
      where: { id: jogoId },
      include: { selecaoCasa: true, selecaoVisitante: true },
    });
    if (!jogo) return;

    const apostasExistentes = await this.prisma.aposta.findMany({
      where: { jogoId },
      select: { usuarioId: true },
    });
    const apostasSet = new Set(apostasExistentes.map((a) => a.usuarioId));

    const membros = await this.prisma.bolaoMembro.findMany({
      where: {
        bolao: { status: 'ATIVO' },
      },
      select: { usuarioId: true },
    });

    const usuariosUnicos = [
      ...new Set(
        membros
          .filter((m) => !apostasSet.has(m.usuarioId))
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
