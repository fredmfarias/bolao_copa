import { test, expect } from '../../fixtures';
import { adminContext } from '../../api/client';
import { prisma, truncateDynamic } from '../../support/db';
import { newUser } from '../../data/factories';

// Define o primeiro jogo para uma hora futura distante (abre a janela)
async function abrirJanela() {
  await prisma.jogo.updateMany({ data: { dataHora: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
}

// Define o primeiro jogo pra T+30min (corte foi T-90min, agora já passou) — janela fechada
async function fecharJanela() {
  await prisma.jogo.updateMany({ data: { dataHora: new Date(Date.now() + 30 * 60 * 1000) } });
}

test.describe('Janela de inscrição (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('POST /auth/registrar 403 quando janela fechada', async ({ anonApi }) => {
    await fecharJanela();
    // Backend tem cache de 60s no InscricaoWindowService — espera 1.5s pra evitar valor stale
    // após truncateDynamic + o setBeforeAll alterando dados. Se ainda 201, faz retry após TTL.
    await new Promise((r) => setTimeout(r, 1500));

    const u = newUser('janela');
    const res = await anonApi.post('/auth/registrar', { data: { nome: u.nome, email: u.email, senha: u.senha } });

    if (res.status() === 201) {
      // Cache antigo. Espera TTL expirar e tenta com outro e-mail.
      await new Promise((r) => setTimeout(r, 65_000));
      const u2 = newUser('janela2');
      const res2 = await anonApi.post('/auth/registrar', { data: { nome: u2.nome, email: u2.email, senha: u2.senha } });
      expect(res2.status()).toBe(403);
    } else {
      expect(res.status()).toBe(403);
    }
  });

  test('admin cria usuário via POST /admin/usuarios mesmo com janela fechada', async () => {
    await fecharJanela();
    await new Promise((r) => setTimeout(r, 1500));

    const ctx = await adminContext();
    const u = newUser('admin-cria');
    const res = await ctx.post('/admin/usuarios', { data: { nome: u.nome, email: u.email, senhaTemp: u.senha } });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();

    // Usuário recém-criado autentica imediatamente (emailVerificado=true)
    const login = await ctx.post('/auth/login', { data: { email: u.email, senha: u.senha } });
    expect(login.ok()).toBeTruthy();

    await ctx.dispose();
  });
});
