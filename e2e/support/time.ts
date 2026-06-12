import { HORAS_CORTE_INSCRICAO } from '@bolao/shared';
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

// Ensures the inscription window is open and clears the backend cache.
// Call in beforeAll for any test that needs an open window (user registration
// or joining a bolão via invite).
//
// A janela fecha HORAS_CORTE_INSCRICAO antes do PRIMEIRO jogo do banco. Como o
// seed usa datas reais da Copa 2026 — e testes anteriores (fecharPrazoDoJogo)
// jogam partidas para o passado — empurrar só o primeiro jogo não basta: assim
// que o relógio cruza o kickoff do 2º jogo passam a existir vários jogos no
// passado. Empurramos TODOS os jogos dentro da janela de corte para 30+ dias à
// frente, preservando a ordem relativa, garantindo que o mais cedo fique no
// futuro.
export async function garantirJanelaAberta(): Promise<void> {
  const limite = new Date(Date.now() + (HORAS_CORTE_INSCRICAO + 1) * 60 * 60 * 1000);
  const jogos = await prisma.jogo.findMany({
    where: { dataHora: { lt: limite } },
    orderBy: { dataHora: 'asc' },
    select: { id: true },
  });

  const base = Date.now() + 30 * 24 * 60 * 60 * 1000;
  await Promise.all(
    jogos.map((jogo, i) =>
      prisma.jogo.update({
        where: { id: jogo.id },
        data: { dataHora: new Date(base + i * 60_000) },
      }),
    ),
  );

  const ctx = await adminContext();
  await ctx.post('/admin/inscricoes/cache/clear');
  await ctx.dispose();
}
