import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado, BOLAO_GLOBAL_ID } from '../../api/client';
import { truncateDynamic } from '../../support/db';
import { newUser } from '../../data/factories';
import { jogoComApostasAbertas } from '../../support/time';
import { aguardarPontuacaoDraft } from '../../support/queue';

test.describe('Cálculo de ranking draft (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('placar registrado dispara cálculo e popula o draft', async ({ adminApi }) => {
    const apostador = await criarUsuarioAutenticado(newUser('calc'));
    const jogo = await jogoComApostasAbertas();

    // Palpite exato 2x1
    await apostador.ctx.post('/apostas', { data: { jogoId: jogo.id, placarCasa: 2, placarVisitante: 1 } });

    // Admin registra o mesmo placar → enfileira job
    const placar = await adminApi.patch(`/jogos/${jogo.id}/placar`, { data: { placarCasa: 2, placarVisitante: 1 } });
    expect(placar.ok()).toBeTruthy();

    // Aguarda Bull concluir e checa pontuação > 0 no draft do bolão global
    await aguardarPontuacaoDraft(adminApi, BOLAO_GLOBAL_ID, apostador.user.id);

    const draft = await adminApi.get(`/admin/ranking/${BOLAO_GLOBAL_ID}/draft`);
    const linhas = await draft.json();
    const linha = linhas.find((l: any) => l.usuarioId === apostador.user.id);
    expect(linha.pontuacaoTotal).toBeGreaterThan(0);

    await apostador.ctx.dispose();
  });
});
