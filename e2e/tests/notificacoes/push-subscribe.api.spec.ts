import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado } from '../../api/client';
import { truncateDynamic, prisma } from '../../support/db';
import { newUser } from '../../data/factories';

test.describe('Push subscribe (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('subscribe cria subscription e unsubscribe remove', async () => {
    const { user, ctx } = await criarUsuarioAutenticado(newUser('push'));
    const endpoint = `https://push.example.com/${user.id}`;

    const sub = await ctx.post('/notificacoes/subscribe', {
      data: { endpoint, p256dh: 'chave-p256dh', auth: 'chave-auth' },
    });
    expect(sub.ok()).toBeTruthy();

    let row = await prisma.notificacaoSubscription.findUnique({ where: { endpoint } });
    expect(row).not.toBeNull();

    const unsub = await ctx.delete('/notificacoes/subscribe', { data: { endpoint } });
    expect(unsub.ok()).toBeTruthy();

    row = await prisma.notificacaoSubscription.findUnique({ where: { endpoint } });
    expect(row).toBeNull();

    await ctx.dispose();
  });

  test('subscribe sem token retorna 401', async ({ anonApi }) => {
    const res = await anonApi.post('/notificacoes/subscribe', {
      data: { endpoint: 'https://push.example.com/anon', p256dh: 'x', auth: 'y' },
    });
    expect(res.status()).toBe(401);
  });

  test('vapid-public-key é público', async ({ anonApi }) => {
    const res = await anonApi.get('/notificacoes/vapid-public-key');
    expect(res.ok()).toBeTruthy();
  });
});
