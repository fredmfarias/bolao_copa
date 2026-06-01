import { test, expect } from '../../fixtures';
import { mailpit } from '../../support/mailpit';
import { truncateDynamic } from '../../support/db';
import { newUser } from '../../data/factories';
import { LoginPage } from '../../pages/login.page';

test.describe('Recuperação de senha', () => {
  test.beforeAll(async () => { await truncateDynamic(); });
  test.beforeEach(async () => { await mailpit.clear(); });

  test('usuário solicita reset, define nova senha e loga', async ({ page, anonApi, adminApi }) => {
    const user = newUser();
    await adminApi.post('/admin/usuarios', { data: { nome: user.nome, email: user.email, senhaTemp: user.senha } });

    // Solicita reset
    const esqueceu = await anonApi.post('/auth/esqueceu-senha', { data: { email: user.email } });
    expect(esqueceu.ok()).toBeTruthy();

    // Extrai token do e-mail e define nova senha via API
    const msg = await mailpit.waitForMessageTo(user.email);
    const token = mailpit.extractResetToken(await mailpit.getBody(msg.ID));
    const novaSenha = 'novaSenha123';
    const nova = await anonApi.post('/auth/nova-senha', { data: { token, senha: novaSenha } });
    expect(nova.ok()).toBeTruthy();

    // Loga com a nova senha pela UI
    const login = new LoginPage(page);
    await login.goto();
    await login.login(user.email, novaSenha);
    await login.expectLoggedIn();
  });
});
