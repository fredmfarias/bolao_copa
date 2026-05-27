import { Page, expect } from '@playwright/test';

export class RegistroPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/registrar');
  }

  async register(nome: string, email: string, senha: string) {
    await this.page.locator('input[type="text"]').fill(nome);
    await this.page.locator('input[type="email"]').fill(email);
    await this.page.locator('input[type="password"]').fill(senha);
    await this.page.getByRole('button', { name: /cadastrar/i }).click();
  }

  async expectSuccess() {
    await expect(this.page.getByRole('link', { name: 'Ir para login' })).toBeVisible();
  }
}
