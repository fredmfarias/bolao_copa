import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado, BOLAO_GLOBAL_ID } from '../../api/client';
import { truncateDynamic, prisma } from '../../support/db';
import { newUser } from '../../data/factories';

test.describe('Bolão global (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('novo usuário confirmado já é membro do bolão global com Ranking', async () => {
    const { user, ctx } = await criarUsuarioAutenticado(newUser('global'));

    const membro = await prisma.bolaoMembro.findUnique({
      where: { bolaoId_usuarioId: { bolaoId: BOLAO_GLOBAL_ID, usuarioId: user.id } },
    });
    expect(membro).not.toBeNull();

    const ranking = await prisma.ranking.findUnique({
      where: { bolaoId_usuarioId: { bolaoId: BOLAO_GLOBAL_ID, usuarioId: user.id } },
    });
    expect(ranking).not.toBeNull();

    await ctx.dispose();
  });
});
