import { test, expect } from '@playwright/test';
import { BOLAO_GLOBAL_ID, adminContext } from '../../api/client';
import { newUser } from '../../data/factories';
import { LoginPage } from '../../pages/login.page';

const testeUser = newUser('ordenacao');

function makeJogo(id: string, casa: string, visitante: string, dataHora: string) {
  return {
    id,
    dataHora,
    rodada: 1,
    grupo: 'A',
    fase: 'GRUPOS',
    placarCasa: null,
    placarVisitante: null,
    pesoPontuacao: 1,
    publicacaoId: null,
    selecaoCasa:      { id: `${id}c`, nome: casa,      codigo: casa.slice(0, 3).toUpperCase(),      bandeiraSvg: '' },
    selecaoVisitante: { id: `${id}v`, nome: visitante, codigo: visitante.slice(0, 3).toUpperCase(), bandeiraSvg: '' },
  };
}

test.describe('Bolão detalhe — jogos encerrados em ordem decrescente', () => {
  test.beforeAll(async () => {
    const admin = await adminContext();
    await admin.post('/admin/usuarios', {
      data: { nome: testeUser.nome, email: testeUser.email, senhaTemp: testeUser.senha },
    });
    await admin.dispose();
  });

  test('jogos mais recentes aparecem primeiro na tela de palpites', async ({ page }) => {
    const now = Date.now();

    // Três jogos com datas passadas distintas (prazo encerrado em todos)
    // jogos ordenados do mais antigo para o mais recente intencionalmente
    const jogos = [
      makeJogo('j-antigo',  'Time Alfa',   'Time Beta',  new Date(now - 3 * 3_600_000).toISOString()),
      makeJogo('j-medio',   'Time Gama',   'Time Delta', new Date(now - 2 * 3_600_000).toISOString()),
      makeJogo('j-recente', 'Time Epsilon', 'Time Zeta', new Date(now - 1 * 3_600_000).toISOString()),
    ];

    // Intercepta /jogos para que a tela de palpites receba dados controlados,
    // independente do estado do banco ou fuso horário da pipeline
    await page.route(/\/jogos$/, route => route.fulfill({ json: jogos }));

    const login = new LoginPage(page);
    await login.goto();
    await login.login(testeUser.email, testeUser.senha);
    await login.expectLoggedIn();

    await page.goto(`/boloes/${BOLAO_GLOBAL_ID}`);
    await page.waitForSelector('h2:has-text("Jogos")');

    const texto = await page.locator('body').innerText();

    // Ordem esperada na tela: mais recente primeiro
    const nomesEsperados = [
      'TIME EPSILON × TIME ZETA',  // j-recente: -1h
      'TIME GAMA × TIME DELTA',    // j-medio:   -2h
      'TIME ALFA × TIME BETA',     // j-antigo:  -3h
    ];

    const posicoes = nomesEsperados.map(nome => texto.indexOf(nome));
    for (const p of posicoes) {
      expect(p, `Jogo não encontrado na página: "${nomesEsperados[posicoes.indexOf(p)]}"`).toBeGreaterThanOrEqual(0);
    }
    expect(posicoes[0]).toBeLessThan(posicoes[1]); // recente antes do médio
    expect(posicoes[1]).toBeLessThan(posicoes[2]); // médio antes do antigo
  });
});
