import { test, expect } from '@playwright/test';
import { BOLAO_GLOBAL_ID, adminContext } from '../../api/client';
import { newUser } from '../../data/factories';
import { LoginPage } from '../../pages/login.page';

// U+00D7 — mesmo caractere usado no JogoCard: {casa.nome} × {visitante.nome}
const SEP = '×';

const testeUser = newUser('ordenacao');

function makeJogo(id: string, casa: string, visitante: string, dataHora: string) {
  return {
    id, dataHora, rodada: 1, grupo: 'A', fase: 'GRUPOS',
    placarCasa: null, placarVisitante: null, pesoPontuacao: 1, publicacaoId: null,
    selecaoCasa:      { id: `${id}c`, nome: casa,      codigo: 'TST', bandeiraSvg: '' },
    selecaoVisitante: { id: `${id}v`, nome: visitante, codigo: 'TST', bandeiraSvg: '' },
  };
}

test.describe('Bolão detalhe — jogos encerrados em ordem decrescente', () => {
  // O app usa next-pwa com aggressiveFrontEndNavCaching, cujo Service Worker
  // intercepta os fetch requests antes do Playwright. Bloqueamos o SW para que
  // page.route() consiga interceptar /jogos e retornar dados controlados.
  test.use({ serviceWorkers: 'block' });
  test.beforeAll(async () => {
    // Cria usuário (que entra automaticamente no bolão global)
    const admin = await adminContext();
    await admin.post('/admin/usuarios', {
      data: { nome: testeUser.nome, email: testeUser.email, senhaTemp: testeUser.senha },
    });
    await admin.dispose();
  });

  test('jogos mais recentes aparecem primeiro na tela de palpites', async ({ page }) => {
    const now = Date.now();

    // Três jogos com datas passadas distintas — o prazo está encerrado em todos.
    // Ordem intencional: j1 = mais antigo, j3 = mais recente.
    const jogos = [
      makeJogo('j1', 'Time Alfa',    'Time Beta',  new Date(now - 3 * 3_600_000).toISOString()),
      makeJogo('j2', 'Time Gama',    'Time Delta', new Date(now - 2 * 3_600_000).toISOString()),
      makeJogo('j3', 'Time Epsilon', 'Time Zeta',  new Date(now - 1 * 3_600_000).toISOString()),
    ];

    // Intercepta os três endpoints que BolaoDetalhePage consome para que o teste
    // seja completamente independente do banco e dos horários reais dos jogos.
    await page.route(/\/jogos$/, route => route.fulfill({ json: jogos }));
    await page.route(
      new RegExp(`/boloes/${BOLAO_GLOBAL_ID}$`),
      route => route.fulfill({
        json: {
          id: BOLAO_GLOBAL_ID, nome: 'Bolão Global', descricao: null,
          status: 'ATIVO', maxParticipantes: 100, precoReais: '0', membros: [],
        },
      }),
    );
    await page.route(/\/apostas$/, route => route.fulfill({ json: [] }));

    const login = new LoginPage(page);
    await login.goto();
    await login.login(testeUser.email, testeUser.senha);
    await login.expectLoggedIn();

    await page.goto(`/boloes/${BOLAO_GLOBAL_ID}`);

    // Aguarda os cards de jogo estarem no DOM
    await expect(page.getByText('Time Epsilon', { exact: false }).first()).toBeVisible();

    // Coleta todos os <p> com o separador × em ordem de DOM.
    // Usa textContent (não aplica CSS text-transform) para evitar dependência de uppercase.
    const nomes = await page.locator('p').filter({ hasText: SEP }).allTextContents();
    const nomesLower = nomes.map(n => n.toLowerCase().trim());

    const idxRecente = nomesLower.findIndex(n => n.includes('time epsilon')); // j3 -1h
    const idxMedio   = nomesLower.findIndex(n => n.includes('time gama'));    // j2 -2h
    const idxAntigo  = nomesLower.findIndex(n => n.includes('time alfa'));    // j1 -3h

    expect(idxRecente, '"Time Epsilon" (mais recente) não encontrado').toBeGreaterThanOrEqual(0);
    expect(idxMedio,   '"Time Gama" (médio) não encontrado').toBeGreaterThanOrEqual(0);
    expect(idxAntigo,  '"Time Alfa" (mais antigo) não encontrado').toBeGreaterThanOrEqual(0);

    // Ordem decrescente: mais recente (menor índice DOM = aparece primeiro na tela)
    expect(idxRecente).toBeLessThan(idxMedio);
    expect(idxMedio).toBeLessThan(idxAntigo);
  });
});
