import { test, expect } from '@playwright/test';
import { prisma } from '../../support/db';
import { BOLAO_GLOBAL_ID, adminContext } from '../../api/client';
import { newUser } from '../../data/factories';
import { LoginPage } from '../../pages/login.page';

const testeUser = newUser('ordenacao');

test.describe('Bolão detalhe — jogos encerrados em ordem decrescente', () => {
  let nomesEsperados: string[]; // do mais recente ao mais antigo

  test.beforeAll(async () => {
    const admin = await adminContext();
    await admin.post('/admin/usuarios', {
      data: { nome: testeUser.nome, email: testeUser.email, senhaTemp: testeUser.senha },
    });
    await admin.dispose();

    const now = Date.now();
    const jogos = await prisma.jogo.findMany({
      take: 3,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        selecaoCasa: { select: { nome: true } },
        selecaoVisitante: { select: { nome: true } },
      },
    });
    if (jogos.length < 3) throw new Error('Seed precisa de ao menos 3 jogos.');

    // jogos[0] = mais antigo, jogos[2] = mais recente (todos no passado = prazo encerrado)
    await prisma.jogo.update({ where: { id: jogos[0].id }, data: { dataHora: new Date(now - 3 * 3_600_000) } });
    await prisma.jogo.update({ where: { id: jogos[1].id }, data: { dataHora: new Date(now - 2 * 3_600_000) } });
    await prisma.jogo.update({ where: { id: jogos[2].id }, data: { dataHora: new Date(now - 1 * 3_600_000) } });

    // Ordem esperada na tela: mais recente primeiro → jogos[2], jogos[1], jogos[0]
    nomesEsperados = [jogos[2], jogos[1], jogos[0]].map(
      j => `${j.selecaoCasa.nome} × ${j.selecaoVisitante.nome}`.toUpperCase(),
    );
  });

  test('jogos mais recentes aparecem primeiro na tela de palpites', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(testeUser.email, testeUser.senha);
    await login.expectLoggedIn();

    await page.goto(`/boloes/${BOLAO_GLOBAL_ID}`);
    await page.waitForSelector('h2:has-text("Jogos")');

    const texto = await page.locator('body').innerText();
    const posicoes = nomesEsperados.map(nome => texto.indexOf(nome));

    for (const p of posicoes) {
      expect(p).toBeGreaterThanOrEqual(0);
    }
    // posicoes[0] = jogo mais recente (deve aparecer antes dos demais no texto)
    expect(posicoes[0]).toBeLessThan(posicoes[1]);
    expect(posicoes[1]).toBeLessThan(posicoes[2]);
  });
});
