import { prisma } from './support/db';

export default async function globalTeardown() {
  await prisma.$disconnect();
}
