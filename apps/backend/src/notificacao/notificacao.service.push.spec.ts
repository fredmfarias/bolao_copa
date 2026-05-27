import { Test } from '@nestjs/testing';
import * as webpush from 'web-push';
import { NotificacaoService } from './notificacao.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

jest.mock('web-push');

describe('NotificacaoService — envio (mocked web-push)', () => {
  let service: NotificacaoService;
  const prisma = {
    notificacaoSubscription: {
      findMany: jest.fn().mockResolvedValue([
        { endpoint: 'https://push.example.com/1', p256dh: 'p', auth: 'a' },
      ]),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificacaoService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => 'fake' } },
      ],
    }).compile();
    service = moduleRef.get(NotificacaoService);
  });

  it('chama sendNotification com a subscription e payload serializado', async () => {
    (webpush.sendNotification as jest.Mock).mockResolvedValue({});
    const payload = { title: 'Jogo começou', body: 'x', jogoId: 'jogo-1' };

    await service.enviarParaUsuario('user-id', payload);

    expect(prisma.notificacaoSubscription.findMany).toHaveBeenCalledWith({ where: { usuarioId: 'user-id' } });
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint: 'https://push.example.com/1', keys: { p256dh: 'p', auth: 'a' } },
      JSON.stringify(payload),
    );
  });
});
