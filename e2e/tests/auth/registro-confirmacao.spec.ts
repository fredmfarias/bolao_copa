import { test, expect } from '@playwright/test';
import { mailpit } from '../../support/mailpit';
import { truncateDynamic, prisma } from '../../support/db';
import { newUser } from '../../data/factories';
import { RegistroPage } from '../../pages/registro.page';
import { LoginPage } from '../../pages/login.page';

test.describe('Registro → confirmação → login', () => {
  let conviteToken: string;

  test.beforeAll(async () => {
    await truncateDynamic();

    // Create a private bolão and convite so the /registrar form is accessible
    const adminUser = await prisma.usuario.findFirstOrThrow({ where: { email: 'admin@bolaotrovao.com' } });
    const bolao = await prisma.bolao.create({
      data: { nome: 'Bolão E2E Convite', maxParticipantes: 100, precoReais: 0, criadoPorId: adminUser.id },
    });
    const convite = await prisma.bolaoConvite.create({
      data: { bolaoId: bolao.id, criadoPorId: adminUser.id },
    });
    conviteToken = convite.token;
  });

  test.beforeEach(async () => { await mailpit.clear(); });

  test('usuário se registra, confirma e-mail e faz login', async ({ page }) => {
    const user = newUser();

    // 1. Registro pela UI (convite na URL)
    const registro = new RegistroPage(page);
    await registro.goto(conviteToken);
    await registro.register(user.nome, user.email, user.senha);
    await registro.expectSuccess();

    // 2. E-mail de confirmação chega no Mailpit
    //    (template = "Confirme seu e-mail — Bolão Trovão"; corpo contém só o link,
    //     não o nome do usuário — não asserir nome aqui)
    const msg = await mailpit.waitForMessageTo(user.email);
    expect(msg.Subject).toMatch(/confirme seu e-mail/i);
    const body = await mailpit.getBody(msg.ID);
    expect(body).toContain('/auth/confirmar-email?token=');
    const token = mailpit.extractConfirmToken(body);

    // 3. Navega no link → app confirma e redireciona ao login com aviso verde
    await page.goto(`/auth/confirmar-email?token=${token}`);
    await expect(page).toHaveURL(/\/login\?emailConfirmado=true/);
    await expect(page.getByText('E-mail verificado com sucesso! Faça login para continuar.')).toBeVisible();

    // 4. Login completa o fluxo
    const login = new LoginPage(page);
    await login.login(user.email, user.senha);
    await login.expectLoggedIn();
  });
});
