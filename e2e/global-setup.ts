import { chromium, request, FullConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '.env.e2e') });

import { prisma } from './support/db';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Poll the backend until it answers, so this setup doesn't depend on whether
// Playwright starts webServer before or after globalSetup.
async function waitForBackend(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/jogos`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Backend não respondeu em ${BASE}/jogos dentro de ${timeoutMs}ms`);
}

async function saveSession(email: string, senha: string, file: string) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const res = await context.request.post(`${BASE}/auth/login`, { data: { email, senha } });
  if (!res.ok()) throw new Error(`login ${email} falhou: ${res.status()}`);
  await context.storageState({ path: file });
  await browser.close();
}

export default async function globalSetup(_config: FullConfig) {
  // 1. Wait for the backend (DB already reset by the pretest script).
  await waitForBackend();

  // 2. Create a non-admin participante (confirmed) for ui tests.
  const ctx = await request.newContext({ baseURL: BASE });
  await ctx.post('/auth/registrar', {
    data: { nome: 'Participante E2E', email: 'participante@test.local', senha: 'senha12345' },
  });
  await ctx.dispose();
  // Mark e-mail confirmed directly (skips the Mailpit round-trip for setup).
  await prisma.usuario.update({ where: { email: 'participante@test.local' }, data: { emailVerificado: true } });

  // 3. Capture sessions.
  mkdirSync(resolve(__dirname, '.auth'), { recursive: true });
  await saveSession('admin@bolao.com', 'admin123', resolve(__dirname, '.auth/admin.json'));
  await saveSession('participante@test.local', 'senha12345', resolve(__dirname, '.auth/participante.json'));
}
