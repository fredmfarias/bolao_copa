import { test, expect } from '@playwright/test';
import { truncateDynamic } from '../../support/db';
import { LoginPage } from '../../pages/login.page';

test.beforeAll(async () => { await truncateDynamic(); });

test('falha de rede no login exibe mensagem de erro, não tela branca', async ({ page }) => {
  await page.route('**/auth/login', (route) => route.abort());
  const login = new LoginPage(page);
  await login.goto();
  await login.login('qualquer@test.local', 'senha12345');
  await login.expectError();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});
