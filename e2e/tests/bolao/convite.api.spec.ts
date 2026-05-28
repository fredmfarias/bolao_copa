import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado, adminContext } from '../../api/client';
import { truncateDynamic } from '../../support/db';
import { newUser, newBolao } from '../../data/factories';
import { BolaoMembroPapel } from '@bolao/shared';

test.describe('Bolão + convite (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('criador vira MODERADOR e segundo usuário entra via convite', async () => {
    const dono = await criarUsuarioAutenticado(newUser('dono'));
    const admin = await adminContext();

    // Admin cria o bolão e designa dono como moderador
    const criar = await admin.post('/boloes', { data: { ...newBolao(), moderadorId: dono.user.id } });
    expect(criar.ok()).toBeTruthy();
    const bolao = await criar.json();
    await admin.dispose();

    // Gera convite (moderador)
    const conviteRes = await dono.ctx.post(`/boloes/${bolao.id}/convite`, { data: {} });
    expect(conviteRes.ok()).toBeTruthy();
    const convite = await conviteRes.json();
    expect(convite.token).toBeTruthy();

    // Lookup público do convite
    const lookup = await dono.ctx.get(`/convites/${convite.token}`);
    expect(lookup.ok()).toBeTruthy();

    // Segundo usuário entra via convite
    const membro = await criarUsuarioAutenticado(newUser('membro'));
    const entrar = await membro.ctx.post(`/boloes/entrar/${convite.token}`);
    expect(entrar.ok()).toBeTruthy();

    // Bolão lista os 2 membros
    const obter = await dono.ctx.get(`/boloes/${bolao.id}`);
    const detalhe = await obter.json();
    const papeis = detalhe.membros.map((m: any) => `${m.usuarioId}:${m.papel}`);
    expect(papeis).toContain(`${dono.user.id}:${BolaoMembroPapel.MODERADOR}`);
    expect(detalhe.membros.some((m: any) => m.usuarioId === membro.user.id)).toBeTruthy();

    await dono.ctx.dispose();
    await membro.ctx.dispose();
  });
});
