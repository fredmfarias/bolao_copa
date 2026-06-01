import { Page, expect } from '@playwright/test';

export class RegistroPage {
  constructor(private page: Page) {}

  async goto(conviteToken?: string) {
    const url = conviteToken ? `/registrar?convite=${conviteToken}` : '/registrar';
    await this.page.goto(url);
  }

  async register(nome: string, email: string, senha: string, telefone = '(11) 91234-5678') {
    await this.page.locator('input[type="text"]').fill(nome);
    await this.page.locator('input[type="email"]').fill(email);
    await this.page.locator('input[type="tel"]').fill(telefone);
    await this.page.locator('input[type="password"]').fill(senha);
    await this.page.getByRole('button', { name: /cadastrar/i }).click();
  }

  async expectSuccess() {
    await expect(this.page.getByRole('link', { name: 'Ir para login' })).toBeVisible();
  }
}
