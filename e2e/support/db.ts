import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '..', '.env.e2e') });

export const prisma = new PrismaClient();

const GLOBAL_ID = '00000000-0000-0000-0000-000000000001';
// Fixture account that must survive truncation: the seeded admin.
const KEEP_EMAILS = ['admin@bolao.com'];

// Wipes dynamic data while keeping reference data (selecao, estadio, jogo,
// bolao global, configuracao_pontuacao) and the fixture accounts.
//
// Uses ordered deleteMany (NOT `TRUNCATE ... CASCADE`): cascading from
// `publicacao` would also truncate `jogo` (FK jogo.publicacaoId), destroying
// reference data. We instead detach FKs first, then delete child→parent.
export async function truncateDynamic(): Promise<void> {
  // 1. Detach reference rows that point at dynamic data.
  await prisma.jogo.updateMany({ data: { publicacaoId: null, placarCasa: null, placarVisitante: null } });
  await prisma.usuario.updateMany({ data: { bolaoFavoritoId: null } });
  await prisma.configuracaoPontuacao.updateMany({ data: { atualizadoPorId: null } });

  // 2. Delete dynamic rows in FK-safe order (children first).
  await prisma.rankingSnapshot.deleteMany();
  await prisma.ranking.deleteMany();
  await prisma.aposta.deleteMany();
  await prisma.bolaoConvite.deleteMany();
  await prisma.bolaoMembro.deleteMany();
  await prisma.publicacao.deleteMany();
  await prisma.notificacaoSubscription.deleteMany();
  await prisma.bolao.deleteMany({ where: { id: { not: GLOBAL_ID } } });
  await prisma.usuario.deleteMany({ where: { email: { notIn: KEEP_EMAILS } } });
}
