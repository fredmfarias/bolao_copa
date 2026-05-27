import { prisma } from './db';

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
