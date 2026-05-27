import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado } from '../../api/client';
import { truncateDynamic, prisma } from '../../support/db';
import { newUser } from '../../data/factories';
import { jogoComApostasAbertas } from '../../support/time';

test.describe('Aposta upsert (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('reenvio substitui o palpite sem duplicar', async () => {
    const { user, ctx } = await criarUsuarioAutenticado(newUser('aposta'));
    const jogo = await jogoComApostasAbertas();

    const a1 = await ctx.post('/apostas', { data: { jogoId: jogo.id, placarCasa: 1, placarVisitante: 0 } });
    expect(a1.ok()).toBeTruthy();

    const a2 = await ctx.post('/apostas', { data: { jogoId: jogo.id, placarCasa: 2, placarVisitante: 2 } });
    expect(a2.ok()).toBeTruthy();

    const apostas = await prisma.aposta.findMany({ where: { usuarioId: user.id, jogoId: jogo.id } });
    expect(apostas).toHaveLength(1);
    expect(apostas[0].placarCasa).toBe(2);
    expect(apostas[0].placarVisitante).toBe(2);

    await ctx.dispose();
  });
});
