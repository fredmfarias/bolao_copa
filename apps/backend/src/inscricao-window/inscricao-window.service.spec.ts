import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { InscricaoWindowService } from './inscricao-window.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = { jogo: { findFirst: jest.fn() } };

describe('InscricaoWindowService', () => {
  let service: InscricaoWindowService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InscricaoWindowService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(InscricaoWindowService);
    jest.clearAllMocks();
  });

  it('abertas=true quando agora < dataCorte (jogo no futuro)', async () => {
    const futuro = new Date(Date.now() + 5 * 60 * 60 * 1000); // T+5h
    prismaMock.jogo.findFirst.mockResolvedValue({ dataHora: futuro });
    const status = await service.getStatus();
    expect(status.abertas).toBe(true);
    expect(status.dataCorte).toBeInstanceOf(Date);
  });

  it('abertas=false quando agora >= dataCorte', async () => {
    const proximo = new Date(Date.now() + 60 * 60 * 1000); // T+1h (corte foi T-1h)
    prismaMock.jogo.findFirst.mockResolvedValue({ dataHora: proximo });
    const status = await service.getStatus();
    expect(status.abertas).toBe(false);
  });

  it('abertas=true e dataCorte=null se não há jogo cadastrado', async () => {
    prismaMock.jogo.findFirst.mockResolvedValue(null);
    const status = await service.getStatus();
    expect(status).toEqual({ abertas: true, dataPrimeiroJogo: null, dataCorte: null });
  });

  it('cache evita consulta repetida ao DB dentro do TTL', async () => {
    prismaMock.jogo.findFirst.mockResolvedValue({ dataHora: new Date(Date.now() + 5 * 60 * 60 * 1000) });
    await service.getStatus();
    await service.getStatus();
    await service.getStatus();
    expect(prismaMock.jogo.findFirst).toHaveBeenCalledTimes(1);
  });

  it('assertAberta(undefined) lança quando fechado', async () => {
    prismaMock.jogo.findFirst.mockResolvedValue({ dataHora: new Date(Date.now() + 60 * 60 * 1000) });
    await expect(service.assertAberta()).rejects.toThrow(ForbiddenException);
  });

  it('assertAberta(ADMIN) não lança mesmo fechado', async () => {
    prismaMock.jogo.findFirst.mockResolvedValue({ dataHora: new Date(Date.now() + 60 * 60 * 1000) });
    await expect(service.assertAberta({ role: 'ADMIN' })).resolves.toBeUndefined();
  });

  it('assertAberta(USER) não lança quando aberto', async () => {
    prismaMock.jogo.findFirst.mockResolvedValue({ dataHora: new Date(Date.now() + 5 * 60 * 60 * 1000) });
    await expect(service.assertAberta({ role: 'USER' })).resolves.toBeUndefined();
  });
});
