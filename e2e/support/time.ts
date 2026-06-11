import { prisma } from './db';
import { adminContext } from '../api/client';

// Returns an existing GRUPOS jogo whose kickoff is > 60 min away (bets open).
export async function jogoComApostasAbertas() {
  const limite = new Date(Date.now() + 61 * 60 * 1000);
  const jogo = await prisma.jogo.findFirst({
    where: { fase: 'GRUPOS', dataHora: { gt: limite } },
    orderBy: { dataHora: 'asc' },
  });
  if (!jogo) throw new Error('Nenhum jogo com apostas abertas no seed; ajuste o seed ou a data.');
  return jogo;
}

// Forces a jogo's kickoff to the past so the betting deadline is closed.
export async function fecharPrazoDoJogo(jogoId: string) {
  await prisma.jogo.update({
    where: { id: jogoId },
    data: { dataHora: new Date(Date.now() - 60 * 60 * 1000) },
  });
}

// Pushes the first game 30 days into the future and clears the backend cache.
// Call in beforeAll for any test that needs an open inscription window
// (user registration or joining a bolão via invite).
export async function garantirJanelaAberta(): Promise<void> {
  const primeiroJogo = await prisma.jogo.findFirst({
    orderBy: { dataHora: 'asc' },
    select: { id: true },
  });
  if (!primeiroJogo) return;

  await prisma.jogo.update({
    where: { id: primeiroJogo.id },
    data: { dataHora: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });

  const ctx = await adminContext();
  await ctx.post('/admin/inscricoes/cache/clear');
  await ctx.dispose();
}
