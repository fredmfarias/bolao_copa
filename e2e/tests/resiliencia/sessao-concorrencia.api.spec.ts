import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado } from '../../api/client';
import { truncateDynamic, prisma } from '../../support/db';
import { newUser } from '../../data/factories';
import { jogoComApostasAbertas } from '../../support/time';

test.describe('Sessão e concorrência (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('refresh sem cookie válido retorna 401', async ({ anonApi }) => {
    const res = await anonApi.post('/auth/refresh');
    expect(res.status()).toBe(401);
  });

  test('duplo POST simultâneo de aposta não duplica registro', async () => {
    const { user, ctx } = await criarUsuarioAutenticado(newUser('conc'));
    const jogo = await jogoComApostasAbertas();
    const payload = { data: { jogoId: jogo.id, placarCasa: 1, placarVisitante: 1 } };

    const [r1, r2] = await Promise.all([
      ctx.post('/apostas', payload),
      ctx.post('/apostas', payload),
    ]);
    expect(r1.status()).toBeLessThan(500);
    expect(r2.status()).toBeLessThan(500);

    const count = await prisma.aposta.count({ where: { usuarioId: user.id, jogoId: jogo.id } });
    expect(count).toBe(1);

    await ctx.dispose();
  });
});
