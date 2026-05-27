import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado } from '../../api/client';
import { truncateDynamic } from '../../support/db';
import { newUser } from '../../data/factories';

test.describe('Authz — endpoints de admin (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  const rotasAdmin: { method: 'get' | 'post' | 'patch'; path: string; data?: any }[] = [
    { method: 'get', path: '/admin/boloes' },
    { method: 'get', path: '/admin/usuarios' },
    { method: 'post', path: '/admin/publicacoes' },
  ];

  test('USER recebe 403 em rotas /admin/*', async () => {
    const { ctx } = await criarUsuarioAutenticado(newUser('naoadmin'));
    for (const rota of rotasAdmin) {
      const res = rota.method === 'get'
        ? await ctx.get(rota.path)
        : rota.method === 'post'
          ? await ctx.post(rota.path, { data: rota.data ?? {} })
          : await ctx.patch(rota.path, { data: rota.data ?? {} });
      expect(res.status(), `${rota.method} ${rota.path}`).toBe(403);
    }
    await ctx.dispose();
  });

  test('anônimo recebe 401 em rotas /admin/*', async ({ anonApi }) => {
    const res = await anonApi.get('/admin/usuarios');
    expect(res.status()).toBe(401);
  });
});
