import { request, APIRequestContext } from '@playwright/test';
import { prisma } from '../support/db';
import { BOLAO_GLOBAL_ID } from '@bolao/shared';

const BASE = process.env.NEXT_PUBLIC_API_URL;
if (!BASE) throw new Error('NEXT_PUBLIC_API_URL não definido — verifique e2e/.env.e2e.');

export interface TestUser {
  id: string;
  nome: string;
  email: string;
  senha: string;
}

// Logs in and returns a context whose every request carries the Bearer token.
// IMPORTANT: protected routes use JwtAuthGuard (Authorization header), NOT the
// refresh cookie — so we must extract accessToken from the login body and set
// it as extraHTTPHeaders. A plain post-login context (cookie only) gets 401.
async function authedContext(email: string, senha: string): Promise<APIRequestContext> {
  const anon = await request.newContext({ baseURL: BASE });
  const login = await anon.post('/auth/login', { data: { email, senha } });
  if (!login.ok()) throw new Error(`login ${email} falhou: ${login.status()} ${await login.text()}`);
  const { accessToken } = (await login.json()) as { accessToken: string };
  await anon.dispose();
  return request.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
  });
}

// Creates a user via the admin endpoint (bypasses invite requirement and window check),
// then returns an authed context. Admin endpoint sets emailVerificado=true automatically.
export async function criarUsuarioAutenticado(user: {
  nome: string; email: string; senha: string; telefone?: string;
}): Promise<{ ctx: APIRequestContext; user: TestUser }> {
  const adminApi = await adminContext();
  const reg = await adminApi.post('/admin/usuarios', {
    data: { nome: user.nome, email: user.email, senhaTemp: user.senha },
  });
  if (!reg.ok()) throw new Error(`admin/usuarios falhou: ${reg.status()} ${await reg.text()}`);
  await adminApi.dispose();

  const dbUser = await prisma.usuario.findUniqueOrThrow({ where: { email: user.email } });
  const ctx = await authedContext(user.email, user.senha);
  return { ctx, user: { id: dbUser.id, nome: user.nome, email: user.email, senha: user.senha } };
}

// Authenticated context for the seeded admin.
export async function adminContext(): Promise<APIRequestContext> {
  return authedContext('admin@bolaotrovao.com', 'admin123');
}

export { BOLAO_GLOBAL_ID, BASE };
