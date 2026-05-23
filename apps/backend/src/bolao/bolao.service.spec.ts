import { Test } from '@nestjs/testing';
import { BolaoService } from './bolao.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BolaoEscopo } from '@bolao/shared';

const prismaMock = {
  bolao: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  bolaoMembro: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), update: jest.fn(), count: jest.fn(), deleteMany: jest.fn() },
  bolaoConvite: { findUnique: jest.fn(), create: jest.fn() },
  ranking: { create: jest.fn(), deleteMany: jest.fn() },
};

describe('BolaoService', () => {
  let service: BolaoService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [BolaoService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(BolaoService);
    jest.clearAllMocks();
  });

  it('criar lança BadRequestException se maxParticipantes não é múltiplo de 10', async () => {
    await expect(
      service.criar('user-1', { nome: 'Test', escopo: BolaoEscopo.AMBOS, maxParticipantes: 15 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('criar calcula precoReais = maxParticipantes × 1', async () => {
    prismaMock.bolao.create.mockResolvedValue({ id: 'b1', maxParticipantes: 20, precoReais: 20 });
    prismaMock.bolaoMembro.create.mockResolvedValue({});
    prismaMock.ranking.create.mockResolvedValue({});
    await service.criar('user-1', { nome: 'Test', escopo: BolaoEscopo.AMBOS, maxParticipantes: 20 });
    expect(prismaMock.bolao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ precoReais: 20 }) }),
    );
  });

  it('entrarViaConvite lança BadRequestException se convite expirado', async () => {
    prismaMock.bolaoConvite.findUnique.mockResolvedValue({
      bolaoId: 'b1',
      expiraEm: new Date(Date.now() - 1000),
    });
    await expect(service.entrarViaConvite('user-1', 'token-expirado')).rejects.toThrow(
      BadRequestException,
    );
  });
});
