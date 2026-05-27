import { request, APIRequestContext } from '@playwright/test';
import { prisma } from '../support/db';
import { BOLAO_GLOBAL_ID } from '@bolao/shared';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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

// Registers a user, confirms e-mail directly (fast), returns an authed context.
export async function criarUsuarioAutenticado(user: {
  nome: string; email: string; senha: string;
}): Promise<{ ctx: APIRequestContext; user: TestUser }> {
  const anon = await request.newContext({ baseURL: BASE });
  const reg = await anon.post('/auth/registrar', {
    data: { nome: user.nome, email: user.email, senha: user.senha },
  });
  if (!reg.ok()) throw new Error(`registrar falhou: ${reg.status()} ${await reg.text()}`);
  await anon.dispose();

  const dbUser = await prisma.usuario.update({
    where: { email: user.email },
    data: { emailVerificado: true },
  });

  const ctx = await authedContext(user.email, user.senha);
  return { ctx, user: { id: dbUser.id, nome: user.nome, email: user.email, senha: user.senha } };
}

// Authenticated context for the seeded admin.
export async function adminContext(): Promise<APIRequestContext> {
  return authedContext('admin@bolao.com', 'admin123');
}

export { BOLAO_GLOBAL_ID, BASE };
