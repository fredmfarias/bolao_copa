import { test, expect } from '../../fixtures';
import { adminContext } from '../../api/client';
import { prisma, truncateDynamic } from '../../support/db';
import { newUser } from '../../data/factories';

// Data far enough in the future that inscricao window is guaranteed open
// (HORAS_CORTE_INSCRICAO = 2h; we use 30 days to be safe)
const DATA_JANELA_ABERTA = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

async function primeiroJogoId(): Promise<string> {
  const j = await prisma.jogo.findFirstOrThrow({
    orderBy: { dataHora: 'asc' },
    select: { id: true },
  });
  return j.id;
}

async function setDataPrimeiroJogo(id: string, dataHora: Date) {
  await prisma.jogo.update({ where: { id }, data: { dataHora } });
}

// Invalida o cache do backend (TTL 60s normalmente)
async function clearCache(adminApi: any) {
  const r = await adminApi.post('/admin/inscricoes/cache/clear');
  if (!r.ok()) throw new Error(`clearCache falhou: ${r.status()}`);
}

// Clear the backend cache using a fresh admin session (for use in beforeAll/afterAll)
async function clearCacheStandalone() {
  const ctx = await adminContext();
  try {
    await clearCache(ctx);
  } finally {
    await ctx.dispose();
  }
}

test.describe('Janela de inscrição (API)', () => {
  let jogoId: string;

  test.beforeAll(async () => {
    await truncateDynamic();
    jogoId = await primeiroJogoId();
    // Garante jogo em data futura distante para que a janela esteja aberta no início
    await setDataPrimeiroJogo(jogoId, DATA_JANELA_ABERTA);
    await clearCacheStandalone();
  });

  test.afterAll(async () => {
    // Restaura jogo pra data futura distante (janela aberta) pra não vazar pra outros testes
    await setDataPrimeiroJogo(jogoId, DATA_JANELA_ABERTA);
    await clearCacheStandalone();
  });

  test('POST /auth/registrar 403 quando janela fechada', async ({ anonApi, adminApi }) => {
    // Fecha janela: primeiro jogo em T+30min (corte foi T-90min)
    await setDataPrimeiroJogo(jogoId, new Date(Date.now() + 30 * 60 * 1000));
    await clearCache(adminApi);

    const u = newUser('janela');
    const res = await anonApi.post('/auth/registrar', { data: { nome: u.nome, email: u.email, senha: u.senha } });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.message).toContain('Inscrições encerradas');
  });

  test('admin cria usuário via POST /admin/usuarios mesmo com janela fechada', async ({ adminApi }) => {
    await setDataPrimeiroJogo(jogoId, new Date(Date.now() + 30 * 60 * 1000));
    await clearCache(adminApi);

    const u = newUser('admin-cria');
    const res = await adminApi.post('/admin/usuarios', { data: { nome: u.nome, email: u.email, senhaTemp: u.senha } });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();

    // Usuário recém-criado autentica imediatamente (emailVerificado=true)
    const login = await adminApi.post('/auth/login', { data: { email: u.email, senha: u.senha } });
    expect(login.ok()).toBeTruthy();
  });
});
