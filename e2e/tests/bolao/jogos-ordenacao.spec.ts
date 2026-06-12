import { test, expect } from '@playwright/test';
import { adminContext, BOLAO_GLOBAL_ID } from '../../api/client';
import { prisma } from '../../support/db';
import { newUser } from '../../data/factories';
import { LoginPage } from '../../pages/login.page';

// U+00D7 — mesmo caractere usado no JogoCard: {casa.nome} × {visitante.nome}
const SEP = '×';

const testeUser = newUser('ordenacao');

// Preenchido em beforeAll e lido no teste.
let jogoMaisRecente: { casa: string; visitante: string };
let jogoMedio:       { casa: string; visitante: string };
let jogoMaisAntigo:  { casa: string; visitante: string };
let jogosModificados: string[] = [];

test.describe('Bolão detalhe — jogos encerrados em ordem decrescente', () => {
  test.beforeAll(async () => {
    // Cria usuário (que entra automaticamente no bolão global).
    const admin = await adminContext();
    await admin.post('/admin/usuarios', {
      data: { nome: testeUser.nome, email: testeUser.email, senhaTemp: testeUser.senha },
    });
    await admin.dispose();

    // Pega os 3 jogos mais futuros do seed (Rodada 3) para minimizar conflito
    // com testes anteriores que possam ter movido jogos para o passado.
    const games = await prisma.jogo.findMany({
      take: 3,
      where: { fase: 'GRUPOS' },
      orderBy: { dataHora: 'desc' },
      include: {
        selecaoCasa:      { select: { nome: true } },
        selecaoVisitante: { select: { nome: true } },
      },
    });
    if (games.length < 3) throw new Error('Seed insuficiente: menos de 3 jogos de grupos.');

    const now = Date.now();
    // games[0] → mais recente (-1h), games[1] → médio (-2h), games[2] → mais antigo (-3h)
    await prisma.jogo.update({ where: { id: games[0].id }, data: { dataHora: new Date(now - 1 * 3_600_000) } });
    await prisma.jogo.update({ where: { id: games[1].id }, data: { dataHora: new Date(now - 2 * 3_600_000) } });
    await prisma.jogo.update({ where: { id: games[2].id }, data: { dataHora: new Date(now - 3 * 3_600_000) } });

    jogoMaisRecente = { casa: games[0].selecaoCasa.nome, visitante: games[0].selecaoVisitante.nome };
    jogoMedio       = { casa: games[1].selecaoCasa.nome, visitante: games[1].selecaoVisitante.nome };
    jogoMaisAntigo  = { casa: games[2].selecaoCasa.nome, visitante: games[2].selecaoVisitante.nome };
    jogosModificados = games.map(g => g.id);
  });

  test.afterAll(async () => {
    // Restaura os jogos para datas futuras para não interferir em testes posteriores.
    const now = Date.now();
    await Promise.all(
      jogosModificados.map((id, i) =>
        prisma.jogo.update({
          where: { id },
          data: { dataHora: new Date(now + (30 + i) * 24 * 3_600_000) },
        }),
      ),
    );
  });

  test('jogos mais recentes aparecem primeiro na tela de palpites', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(testeUser.email, testeUser.senha);
    await login.expectLoggedIn();

    await page.goto(`/boloes/${BOLAO_GLOBAL_ID}`);

    // Aguarda o jogo mais recente estar visível na tela.
    await expect(
      page.getByText(jogoMaisRecente.casa, { exact: false }).first(),
    ).toBeVisible();

    // Coleta todos os <p> com o separador × em ordem de DOM.
    // Usa textContent (não aplica CSS text-transform) para evitar dependência de uppercase.
    const nomes = await page.locator('p').filter({ hasText: SEP }).allTextContents();
    const nomesLower = nomes.map(n => n.toLowerCase().trim());

    // Busca por ambos os nomes (casa + visitante) para evitar colisões de substring.
    const findIdx = (casa: string, visitante: string) =>
      nomesLower.findIndex(
        n => n.includes(casa.toLowerCase()) && n.includes(visitante.toLowerCase()),
      );

    const idxRecente = findIdx(jogoMaisRecente.casa, jogoMaisRecente.visitante);
    const idxMedio   = findIdx(jogoMedio.casa,       jogoMedio.visitante);
    const idxAntigo  = findIdx(jogoMaisAntigo.casa,  jogoMaisAntigo.visitante);

    expect(idxRecente, `"${jogoMaisRecente.casa}" (mais recente) não encontrado`).toBeGreaterThanOrEqual(0);
    expect(idxMedio,   `"${jogoMedio.casa}" (médio) não encontrado`).toBeGreaterThanOrEqual(0);
    expect(idxAntigo,  `"${jogoMaisAntigo.casa}" (mais antigo) não encontrado`).toBeGreaterThanOrEqual(0);

    // Ordem decrescente: mais recente primeiro (índice DOM menor = aparece antes na tela).
    expect(idxRecente).toBeLessThan(idxMedio);
    expect(idxMedio).toBeLessThan(idxAntigo);
  });
});
