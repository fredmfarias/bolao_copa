import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado, BOLAO_GLOBAL_ID } from '../../api/client';
import { truncateDynamic, prisma } from '../../support/db';
import { newUser } from '../../data/factories';
import { jogoComApostasAbertas } from '../../support/time';
import { aguardarPontuacaoDraft } from '../../support/queue';

test.describe('Publicação de ranking (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('publicar grava RankingSnapshot e participante vê o congelado', async ({ adminApi }) => {
    const apostador = await criarUsuarioAutenticado(newUser('pub'));
    const jogo = await jogoComApostasAbertas();
    await apostador.ctx.post('/apostas', { data: { jogoId: jogo.id, placarCasa: 1, placarVisitante: 0 } });
    await adminApi.patch(`/jogos/${jogo.id}/placar`, { data: { placarCasa: 1, placarVisitante: 0 } });
    await aguardarPontuacaoDraft(adminApi, BOLAO_GLOBAL_ID, apostador.user.id);

    // Publica
    const pub = await adminApi.post('/admin/publicacoes');
    expect(pub.ok()).toBeTruthy();

    // Snapshot gravado
    const snap = await prisma.rankingSnapshot.findFirst({
      where: { bolaoId: BOLAO_GLOBAL_ID, usuarioId: apostador.user.id },
    });
    expect(snap).not.toBeNull();
    expect(snap!.pontuacaoTotal).toBeGreaterThan(0);

    // Participante lê o ranking publicado (snapshot congelado)
    const ranking = await apostador.ctx.get(`/boloes/${BOLAO_GLOBAL_ID}/ranking`);
    expect(ranking.ok()).toBeTruthy();
    const linhas = await ranking.json();
    expect(linhas.some((l: any) => l.usuarioId === apostador.user.id)).toBeTruthy();

    await apostador.ctx.dispose();
  });
});
