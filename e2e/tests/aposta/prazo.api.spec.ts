import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado } from '../../api/client';
import { truncateDynamic, prisma } from '../../support/db';
import { newUser } from '../../data/factories';
import { jogoComApostasAbertas, fecharPrazoDoJogo } from '../../support/time';

test.describe('Aposta prazo (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('apostar após o prazo retorna 403 e não cria aposta', async () => {
    const { user, ctx } = await criarUsuarioAutenticado(newUser('prazo'));
    const jogo = await jogoComApostasAbertas();
    await fecharPrazoDoJogo(jogo.id);

    const res = await ctx.post('/apostas', { data: { jogoId: jogo.id, placarCasa: 1, placarVisitante: 1 } });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.message).toBe('Prazo para apostas encerrado.');

    const count = await prisma.aposta.count({ where: { usuarioId: user.id, jogoId: jogo.id } });
    expect(count).toBe(0);

    await ctx.dispose();
  });
});
