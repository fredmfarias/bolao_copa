import { test, expect } from '../../fixtures';
import { criarUsuarioAutenticado, BOLAO_GLOBAL_ID } from '../../api/client';
import { truncateDynamic, prisma } from '../../support/db';
import { newUser } from '../../data/factories';
import { jogoComApostasAbertas } from '../../support/time';

test.describe('Authz — apostas entre usuários (API)', () => {
  test.beforeAll(async () => { await truncateDynamic(); });

  test('palpites do jogo ocultos antes do prazo', async () => {
    const a = await criarUsuarioAutenticado(newUser('a'));
    const b = await criarUsuarioAutenticado(newUser('b'));
    const jogo = await jogoComApostasAbertas();
    await b.ctx.post('/apostas', { data: { jogoId: jogo.id, placarCasa: 3, placarVisitante: 0 } });

    // A tenta ver palpites do jogo no bolão global antes do prazo → 403
    const res = await a.ctx.get(`/boloes/${BOLAO_GLOBAL_ID}/apostas?jogoId=${jogo.id}`);
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.message).toBe('Palpites disponíveis apenas após o encerramento das apostas.');

    await a.ctx.dispose();
    await b.ctx.dispose();
  });

  test('GET /apostas retorna apenas as apostas do próprio usuário', async () => {
    const a = await criarUsuarioAutenticado(newUser('a2'));
    const b = await criarUsuarioAutenticado(newUser('b2'));
    const jogo = await jogoComApostasAbertas();
    await a.ctx.post('/apostas', { data: { jogoId: jogo.id, placarCasa: 1, placarVisitante: 1 } });
    await b.ctx.post('/apostas', { data: { jogoId: jogo.id, placarCasa: 2, placarVisitante: 2 } });

    const res = await a.ctx.get('/apostas');
    const apostas = await res.json();
    const usuarioIds: string[] = apostas.map((x: any) => x.usuarioId);
    expect(usuarioIds.every((id) => id === a.user.id)).toBeTruthy();
    expect(usuarioIds).not.toContain(b.user.id);

    await a.ctx.dispose();
    await b.ctx.dispose();
  });

  test('usuário inativo é bloqueado no login', async ({ anonApi }) => {
    const { user } = await criarUsuarioAutenticado(newUser('inativo'));
    await prisma.usuario.update({ where: { id: user.id }, data: { ativo: false } });
    const res = await anonApi.post('/auth/login', { data: { email: user.email, senha: 'senha12345' } });
    expect(res.status()).toBe(401); // auth.service.login lança "Sua conta está desativada."
    const body = await res.json();
    expect(body.message).toBe('Sua conta está desativada.');
  });
});
