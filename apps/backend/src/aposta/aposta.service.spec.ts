import { Test } from '@nestjs/testing';
import { ApostaService } from './aposta.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JogoFase } from '@bolao/shared';

const jogoGrupos = {
  id: 'jogo-1',
  dataHora: new Date(Date.now() + 3 * 60 * 60 * 1000),
  fase: JogoFase.GRUPOS,
  placarCasa: null,
  placarVisitante: null,
};
const jogoElim = { ...jogoGrupos, fase: JogoFase.OITAVAS };
const jogoPassado = {
  ...jogoGrupos,
  dataHora: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h no passado
};

const prismaMock = {
  jogo: { findUnique: jest.fn() },
  bolaoMembro: { findMany: jest.fn() },
  aposta: { findUnique: jest.fn(), upsert: jest.fn(), count: jest.fn(), findMany: jest.fn() },
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

  describe('upsert', () => {
    it('lança ForbiddenException se aposta após prazo (< 1h antes)', async () => {
      prismaMock.jogo.findUnique.mockResolvedValue({
        ...jogoGrupos,
        dataHora: new Date(Date.now() + 30 * 60 * 1000),
      });
      await expect(
        service.upsert('user-1', { jogoId: 'jogo-1', placarCasa: 1, placarVisitante: 0 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lança BadRequestException ao exceder 18 apostas iguais na fase de grupos', async () => {
      prismaMock.jogo.findUnique.mockResolvedValue(jogoGrupos);
      prismaMock.aposta.findUnique.mockResolvedValue(null);
      prismaMock.aposta.count.mockResolvedValue(18);
      await expect(
        service.upsert('user-1', { jogoId: 'jogo-1', placarCasa: 1, placarVisitante: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException ao exceder 8 apostas iguais na fase eliminatória', async () => {
      prismaMock.jogo.findUnique.mockResolvedValue(jogoElim);
      prismaMock.aposta.findUnique.mockResolvedValue(null);
      prismaMock.aposta.count.mockResolvedValue(8);
      await expect(
        service.upsert('user-1', { jogoId: 'jogo-1', placarCasa: 2, placarVisitante: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('permite editar aposta existente com mesmo placar sem contar como nova', async () => {
      prismaMock.jogo.findUnique.mockResolvedValue(jogoGrupos);
      prismaMock.aposta.findUnique.mockResolvedValue({ id: 'a1', placarCasa: 1, placarVisitante: 0 });
      prismaMock.aposta.count.mockResolvedValue(18);
      prismaMock.aposta.upsert.mockResolvedValue({});
      await expect(
        service.upsert('user-1', { jogoId: 'jogo-1', placarCasa: 1, placarVisitante: 0 }),
      ).resolves.not.toThrow();
    });

    it('usa OR para contar placares invertidos como idênticos (2×0 = 0×2)', async () => {
      prismaMock.jogo.findUnique.mockResolvedValue(jogoGrupos);
      prismaMock.aposta.findUnique.mockResolvedValue(null);
      prismaMock.aposta.count.mockResolvedValue(0);
      prismaMock.aposta.upsert.mockResolvedValue({});
      await service.upsert('user-1', { jogoId: 'jogo-1', placarCasa: 2, placarVisitante: 0 });
      expect(prismaMock.aposta.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { placarCasa: 0, placarVisitante: 2 },
              { placarCasa: 2, placarVisitante: 0 },
            ],
          }),
        }),
      );
    });

    it('não chama bolaoMembro ao fazer aposta', async () => {
      prismaMock.jogo.findUnique.mockResolvedValue(jogoGrupos);
      prismaMock.aposta.findUnique.mockResolvedValue(null);
      prismaMock.aposta.count.mockResolvedValue(0);
      prismaMock.aposta.upsert.mockResolvedValue({});
      await service.upsert('user-1', { jogoId: 'jogo-1', placarCasa: 1, placarVisitante: 0 });
      expect(prismaMock.bolaoMembro.findMany).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('retorna apostas do usuário sem filtro de bolão', async () => {
      const apostas = [{ id: 'a1', jogoId: 'j1', usuarioId: 'user-1' }];
      prismaMock.aposta.findMany.mockResolvedValue(apostas);
      const result = await service.listar('user-1');
      expect(result).toEqual(apostas);
      expect(prismaMock.aposta.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { usuarioId: 'user-1' } }),
      );
    });
  });

  describe('listarPalpitesPorJogo', () => {
    it('lança ForbiddenException se apostas ainda abertas', async () => {
      prismaMock.jogo.findUnique.mockResolvedValue(jogoGrupos); // 3h no futuro
      await expect(
        service.listarPalpitesPorJogo('bolao-1', 'jogo-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lança NotFoundException se jogo não encontrado', async () => {
      prismaMock.jogo.findUnique.mockResolvedValue(null);
      await expect(
        service.listarPalpitesPorJogo('bolao-1', 'jogo-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('retorna palpites dos membros do bolão após prazo', async () => {
      prismaMock.jogo.findUnique.mockResolvedValue(jogoPassado);
      prismaMock.bolaoMembro.findMany.mockResolvedValue([
        { usuarioId: 'user-1' },
        { usuarioId: 'user-2' },
      ]);
      prismaMock.aposta.findMany.mockResolvedValue([
        { usuarioId: 'user-1', placarCasa: 2, placarVisitante: 1, pontuacao: null,
          usuario: { id: 'user-1', nome: 'Alice', avatarUrl: null } },
      ]);
      const result = await service.listarPalpitesPorJogo('bolao-1', 'jogo-1');
      expect(result).toHaveLength(1);
      expect(result[0].nome).toBe('Alice');
      expect(prismaMock.aposta.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { jogoId: 'jogo-1', usuarioId: { in: ['user-1', 'user-2'] } },
        }),
      );
    });
  });
});
