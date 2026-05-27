import { Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, senha: string) {
    await this.page.locator('input[type="email"]').fill(email);
    await this.page.locator('input[type="password"]').fill(senha);
    await this.page.getByRole('button', { name: 'Entrar' }).click();
  }

  async expectLoggedIn() {
    await expect(this.page).toHaveURL(/\/jogos/);
  }

  async expectError() {
    await expect(this.page.locator('p.text-red-400')).toBeVisible();
  }
}
