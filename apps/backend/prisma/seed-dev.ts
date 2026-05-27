import { PrismaClient, BolaoStatus, BolaoEscopo, Role, BolaoMembroPapel } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMIN_ID = '00000000-0000-0000-0000-000000000000';
const BOLAO_GLOBAL_ID = '00000000-0000-0000-0000-000000000001';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rand(max: number): number {
  return Math.floor(Math.random() * (max + 1));
}

async function cleanup(): Promise<void> {
  await prisma.aposta.deleteMany();
  await prisma.rankingSnapshot.deleteMany();
  await prisma.ranking.deleteMany();
  await prisma.bolaoConvite.deleteMany();
  await prisma.bolaoMembro.deleteMany();
  await prisma.bolao.deleteMany({ where: { id: { not: BOLAO_GLOBAL_ID } } });
  await prisma.usuario.deleteMany({ where: { id: { not: ADMIN_ID } } });
  console.log('✓ Limpeza concluída');
}

async function adjustGameDates(): Promise<string[]> {
  const now = Date.now();
  const s  = (n: number) => n * 1000;
  const min = (n: number) => s(n * 60);
  const h   = (n: number) => min(n * 60);
  const d   = (n: number) => h(n * 24);

  const offsets = [
    -d(3), -d(2), -d(1), -h(6), -h(1),
    min(10), min(20), min(135),
  ];

  const games = await prisma.jogo.findMany({
    orderBy: { dataHora: 'asc' },
    take: 8,
    select: { id: true },
  });

  for (let i = 0; i < games.length; i++) {
    await prisma.jogo.update({
      where: { id: games[i].id },
      data: { dataHora: new Date(now + offsets[i]) },
    });
  }

  console.log('✓ 8 jogos com datas ajustadas');
  return games.map(g => g.id);
}

async function createUsers(): Promise<string[]> {
  const senhaHash = await bcrypt.hash('Test@123', 12);

  const data = [
    ...Array.from({ length: 4 }, (_, i) => ({
      nome: `Admin Dev ${i + 1}`,
      email: `admin.dev${i + 1}@bolao.dev`,
      senhaHash,
      role: Role.ADMIN,
      emailVerificado: true,
      ativo: true,
    })),
    ...Array.from({ length: 48 }, (_, i) => ({
      nome: `Usuário Teste ${i + 1}`,
      email: `usuario${i + 1}@bolao.dev`,
      senhaHash,
      role: Role.USER,
      emailVerificado: true,
      ativo: true,
    })),
  ];

  await prisma.usuario.createMany({ data });

  const created = await prisma.usuario.findMany({
    where: { email: { endsWith: '@bolao.dev' } },
    select: { id: true },
  });

  console.log('✓ 52 usuários criados');
  return created.map(u => u.id);
}

async function createBoloes(): Promise<string[]> {
  await prisma.bolao.createMany({
    data: [
      {
        nome: 'Bolão dos Grupos A',
        descricao: 'Fase de grupos — Chave A',
        escopo: BolaoEscopo.GRUPOS,
        maxParticipantes: 20,
        precoReais: 10,
        status: BolaoStatus.ATIVO,
        criadoPorId: ADMIN_ID,
      },
      {
        nome: 'Bolão dos Grupos B',
        descricao: 'Fase de grupos — Chave B',
        escopo: BolaoEscopo.GRUPOS,
        maxParticipantes: 20,
        precoReais: 20,
        status: BolaoStatus.ATIVO,
        criadoPorId: ADMIN_ID,
      },
      {
        nome: 'Bolão Eliminatórias 1',
        descricao: 'Fase eliminatória, grupo 1',
        escopo: BolaoEscopo.ELIMINATORIAS,
        maxParticipantes: 15,
        precoReais: 30,
        status: BolaoStatus.ATIVO,
        criadoPorId: ADMIN_ID,
      },
      {
        nome: 'Bolão Eliminatórias 2',
        descricao: 'Fase eliminatória, grupo 2',
        escopo: BolaoEscopo.ELIMINATORIAS,
        maxParticipantes: 15,
        precoReais: 50,
        status: BolaoStatus.ATIVO,
        criadoPorId: ADMIN_ID,
      },
      {
        nome: 'Bolão Completo Alpha',
        descricao: 'Copa inteira — sem taxa de entrada',
        escopo: BolaoEscopo.AMBOS,
        maxParticipantes: 25,
        precoReais: 0,
        status: BolaoStatus.ATIVO,
        criadoPorId: ADMIN_ID,
      },
      {
        nome: 'Bolão Completo Beta',
        descricao: 'Copa inteira — taxa reduzida',
        escopo: BolaoEscopo.AMBOS,
        maxParticipantes: 25,
        precoReais: 15,
        status: BolaoStatus.ATIVO,
        criadoPorId: ADMIN_ID,
      },
    ],
  });

  const created = await prisma.bolao.findMany({
    where: { id: { not: BOLAO_GLOBAL_ID } },
    select: { id: true },
    orderBy: { criadoEm: 'asc' },
  });

  console.log('✓ 6 bolões criados');
  return created.map(b => b.id);
}

async function distributeMembers(bolaoIds: string[], userIds: string[]): Promise<void> {
  let total = 0;

  for (const bolaoId of bolaoIds) {
    const selected = shuffle(userIds).slice(0, 12);
    const result = await prisma.bolaoMembro.createMany({
      data: selected.map((usuarioId, idx) => ({
        bolaoId,
        usuarioId,
        papel: idx === 0 ? BolaoMembroPapel.MODERADOR : BolaoMembroPapel.PARTICIPANTE,
      })),
      skipDuplicates: true,
    });
    total += result.count;
  }

  console.log(`✓ ${total} membros distribuídos (6 moderadores + participantes com sobreposição)`);
}

async function createApostas(adjustedGameIds: string[], userIds: string[]): Promise<void> {
  const futureGames = await prisma.jogo.findMany({
    where: { id: { notIn: adjustedGameIds }, dataHora: { gt: new Date() } },
    orderBy: { dataHora: 'asc' },
    take: 12,
    select: { id: true },
  });

  const targetIds = [...adjustedGameIds, ...futureGames.map(g => g.id)];

  for (let i = 0; i < userIds.length; i += 10) {
    const batch = userIds.slice(i, i + 10);
    await Promise.all(
      batch.map(usuarioId =>
        prisma.aposta.createMany({
          data: targetIds.map(jogoId => ({
            usuarioId,
            jogoId,
            placarCasa: rand(4),
            placarVisitante: rand(4),
          })),
          skipDuplicates: true,
        }),
      ),
    );
  }

  console.log(
    `✓ ${userIds.length * targetIds.length} apostas criadas (${userIds.length} usuários × ${targetIds.length} jogos)`,
  );
}

async function main(): Promise<void> {
  await cleanup();
  const adjustedGameIds = await adjustGameDates();
  const userIds = await createUsers();
  const bolaoIds = await createBoloes();
  await distributeMembers(bolaoIds, userIds);
  await createApostas(adjustedGameIds, userIds);
  console.log('Seed dev concluído.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
