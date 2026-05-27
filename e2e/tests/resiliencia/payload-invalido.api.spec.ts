import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado } from '../../api/client';
import { truncateDynamic } from '../../support/db';
import { newUser } from '../../data/factories';

test.describe('Payload inválido (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('registrar com e-mail inválido e senha curta retorna 400', async ({ anonApi }) => {
    const res = await anonApi.post('/auth/registrar', {
      data: { nome: 'x', email: 'nao-eh-email', senha: '123' },
    });
    expect(res.status()).toBe(400);
    const body = await res.text();
    expect(body).not.toContain('at Object'); // sem stack trace vazado
  });

  test('apostar com placar negativo retorna 400', async () => {
    const { ctx } = await criarUsuarioAutenticado(newUser('inval'));
    const res = await ctx.post('/apostas', {
      data: { jogoId: 'qualquer', placarCasa: -1, placarVisitante: 0 },
    });
    expect(res.status()).toBe(400);
    await ctx.dispose();
  });
});
