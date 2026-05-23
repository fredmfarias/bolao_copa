import { Test } from '@nestjs/testing';
import { ApostaService } from './aposta.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { JogoFase } from '@bolao/shared';

const jogoGrupos = {
  id: 'jogo-1',
  dataHora: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3h no futuro
  fase: JogoFase.GRUPOS,
  placarCasa: null,
  placarVisitante: null,
};
const jogoElim = { ...jogoGrupos, fase: JogoFase.OITAVAS };

const prismaMock = {
  jogo: { findUnique: jest.fn() },
  bolaoMembro: { findUnique: jest.fn() },
  aposta: { findUnique: jest.fn(), upsert: jest.fn(), count: jest.fn() },
};

describe('ApostaService', () => {
  let service: ApostaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ApostaService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(ApostaService);
    jest.clearAllMocks();
  });

  it('lança ForbiddenException se aposta após prazo (< 1h antes)', async () => {
    prismaMock.jogo.findUnique.mockResolvedValue({
      ...jogoGrupos,
      dataHora: new Date(Date.now() + 30 * 60 * 1000),
    });
    prismaMock.bolaoMembro.findUnique.mockResolvedValue({ papel: 'PARTICIPANTE' });
    await expect(
      service.upsert('user-1', { jogoId: 'jogo-1', bolaoId: 'b1', placarCasa: 1, placarVisitante: 0 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lança BadRequestException ao exceder 25 apostas iguais na fase de grupos', async () => {
    prismaMock.jogo.findUnique.mockResolvedValue(jogoGrupos);
    prismaMock.bolaoMembro.findUnique.mockResolvedValue({ papel: 'PARTICIPANTE' });
    prismaMock.aposta.findUnique.mockResolvedValue(null);
    prismaMock.aposta.count.mockResolvedValue(25);
    await expect(
      service.upsert('user-1', { jogoId: 'jogo-1', bolaoId: 'b1', placarCasa: 1, placarVisitante: 0 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lança BadRequestException ao exceder 8 apostas iguais na fase eliminatória', async () => {
    prismaMock.jogo.findUnique.mockResolvedValue(jogoElim);
    prismaMock.bolaoMembro.findUnique.mockResolvedValue({ papel: 'PARTICIPANTE' });
    prismaMock.aposta.findUnique.mockResolvedValue(null);
    prismaMock.aposta.count.mockResolvedValue(8);
    await expect(
      service.upsert('user-1', { jogoId: 'jogo-1', bolaoId: 'b1', placarCasa: 2, placarVisitante: 1 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('permite editar aposta existente com mesmo placar sem contar como nova', async () => {
    prismaMock.jogo.findUnique.mockResolvedValue(jogoGrupos);
    prismaMock.bolaoMembro.findUnique.mockResolvedValue({ papel: 'PARTICIPANTE' });
    prismaMock.aposta.findUnique.mockResolvedValue({ id: 'a1', placarCasa: 1, placarVisitante: 0 });
    prismaMock.aposta.count.mockResolvedValue(25);
    prismaMock.aposta.upsert.mockResolvedValue({});
    await expect(
      service.upsert('user-1', { jogoId: 'jogo-1', bolaoId: 'b1', placarCasa: 1, placarVisitante: 0 }),
    ).resolves.not.toThrow();
  });
});
