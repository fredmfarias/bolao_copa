import { nanoid } from 'nanoid';

export function newUser(prefix = 'user') {
  const id = nanoid(8).toLowerCase();
  const worker = process.env.TEST_WORKER_INDEX ?? '0';
  return {
    nome: `Teste ${id}`,
    email: `${prefix}-${worker}-${id}@test.local`,
    senha: 'senha12345',
  };
}

export function newBolao() {
  const id = nanoid(6);
  return { nome: `Bolão ${id}`, escopo: 'AMBOS' as const, maxParticipantes: 10 };
}
