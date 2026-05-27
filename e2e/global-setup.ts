import { FullConfig } from '@playwright/test';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '.env.e2e') });

const BASE = process.env.NEXT_PUBLIC_API_URL;

// Espera o backend responder antes dos testes (rede de segurança além do webServer).
async function waitForBackend(timeoutMs = 120_000) {
  if (!BASE) throw new Error('NEXT_PUBLIC_API_URL não definido — verifique e2e/.env.e2e.');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/jogos`);
      if (res.ok) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Backend não respondeu em ${BASE}/jogos dentro de ${timeoutMs}ms`);
}

export default async function globalSetup(_config: FullConfig) {
  await waitForBackend();
}
