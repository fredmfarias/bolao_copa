import { test, expect } from '@playwright/test';

test('home redirects to login', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});
