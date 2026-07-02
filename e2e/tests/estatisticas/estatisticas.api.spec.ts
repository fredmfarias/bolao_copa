// e2e/tests/estatisticas/estatisticas.api.spec.ts
import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado, BOLAO_GLOBAL_ID } from '../../api/client';
import { truncateDynamic } from '../../support/db';
import { newUser } from '../../data/factories';
import { jogoComApostasAbertas } from '../../support/time';
import { aguardarPontuacaoDraft } from '../../support/queue';

test.describe('Estatísticas do bolão (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('membro vê estatísticas após publicação; sem publicação retorna temDados false', async ({ adminApi }) => {
    const apostador = await criarUsuarioAutenticado(newUser('estat'));

    // Antes de qualquer publicação
    const antes = await apostador.ctx.get(`/boloes/${BOLAO_GLOBAL_ID}/estatisticas`);
    expect(antes.ok()).toBeTruthy();
    expect((await antes.json()).temDados).toBe(false);

    // Aposta + placar + publicação
    const jogo = await jogoComApostasAbertas();
    await apostador.ctx.post('/apostas', { data: { jogoId: jogo.id, placarCasa: 2, placarVisitante: 1 } });
    await adminApi.patch(`/jogos/${jogo.id}/placar`, { data: { placarCasa: 2, placarVisitante: 1 } });
    await aguardarPontuacaoDraft(adminApi, BOLAO_GLOBAL_ID, apostador.user.id);
    const pub = await adminApi.post('/admin/publicacoes');
    expect(pub.ok()).toBeTruthy();

    const res = await apostador.ctx.get(`/boloes/${BOLAO_GLOBAL_ID}/estatisticas`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.temDados).toBe(true);
    expect(body.ultimaPublicacao.numero).toBeGreaterThanOrEqual(1);
    expect(body.palpites.placaresMaisApostados[0].placar).toBe('2x1');
    expect(
      body.posicoes.reiDaLideranca.some((e: any) =>
        e.usuarios.some((u: any) => u.id === apostador.user.id),
      ),
    ).toBeTruthy();

    await apostador.ctx.dispose();
  });

  test('não-membro recebe 403', async ({ adminApi }) => {
    const intruso = await criarUsuarioAutenticado(newUser('intruso'));
    // O moderador vira membro automaticamente — precisa ser um usuário DIFERENTE do intruso.
    const moderador = await criarUsuarioAutenticado(newUser('moderador'));
    const criado = await adminApi.post('/boloes', {
      data: {
        nome: 'Bolão Privado Estatísticas',
        maxParticipantes: 10,
        moderadorId: moderador.user.id,
      },
    });
    expect(criado.ok()).toBeTruthy();
    const bolao = await criado.json();

    const res = await intruso.ctx.get(`/boloes/${bolao.id}/estatisticas`);
    expect(res.status()).toBe(403);

    await intruso.ctx.dispose();
    await moderador.ctx.dispose();
  });
});
