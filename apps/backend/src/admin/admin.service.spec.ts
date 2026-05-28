import { Test } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { RankingService } from '../ranking/ranking.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';

const prismaMock = {
  bolao: { findUnique: jest.fn(), findMany: jest.fn() },
  ranking: { findMany: jest.fn() },
  publicacao: { findFirst: jest.fn() },
  rankingSnapshot: { findMany: jest.fn() },
  usuario: { findMany: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
};
const rankingMock = { recalcularRankingBolao: jest.fn() };
const mailerMock = { sendMail: jest.fn() };

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RankingService, useValue: rankingMock },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('token') } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('x') } },
        { provide: 'MAILER', useValue: mailerMock },
      ],
    }).compile();
    service = module.get(AdminService);
    jest.clearAllMocks();
  });

  describe('getRankingDraft', () => {
    it('lança NotFound se bolão não existe', async () => {
      prismaMock.bolao.findUnique.mockResolvedValue(null);
      await expect(service.getRankingDraft('b1')).rejects.toThrow(NotFoundException);
    });

    it('recalcula e anota variação projetada vs último snapshot', async () => {
      prismaMock.bolao.findUnique.mockResolvedValue({ id: 'b1' });
      rankingMock.recalcularRankingBolao.mockResolvedValue(undefined);
      prismaMock.ranking.findMany.mockResolvedValue([
        { usuarioId: 'u1', posicao: 1, pontuacaoTotal: 30,
          usuario: { id: 'u1', nome: 'Alice', avatarUrl: null } },
      ]);
      prismaMock.publicacao.findFirst.mockResolvedValue({ id: 'pub-2' });
      prismaMock.rankingSnapshot.findMany.mockResolvedValue([{ usuarioId: 'u1', posicao: 3 }]);
      const r = await service.getRankingDraft('b1');
      expect(rankingMock.recalcularRankingBolao).toHaveBeenCalledWith('b1');
      expect(r[0].posicoesGanhas).toBe(2); // 3 - 1
    });

    it('variação 0 quando não há publicação anterior', async () => {
      prismaMock.bolao.findUnique.mockResolvedValue({ id: 'b1' });
      prismaMock.ranking.findMany.mockResolvedValue([
        { usuarioId: 'u1', posicao: 1, pontuacaoTotal: 30,
          usuario: { id: 'u1', nome: 'Alice', avatarUrl: null } },
      ]);
      prismaMock.publicacao.findFirst.mockResolvedValue(null);
      const r = await service.getRankingDraft('b1');
      expect(r[0].posicoesGanhas).toBe(0);
    });
  });

  describe('atualizarUsuario', () => {
    it('atualiza ativo e role', async () => {
      prismaMock.usuario.update.mockResolvedValue({ id: 'u1', ativo: false, role: 'USER' });
      await service.atualizarUsuario('u1', { ativo: false });
      expect(prismaMock.usuario.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { ativo: false },
        select: { id: true, nome: true, email: true, role: true, ativo: true },
      });
    });
  });

  describe('resetarSenha', () => {
    it('lança NotFound se usuário não existe', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue(null);
      await expect(service.resetarSenha('u1')).rejects.toThrow(NotFoundException);
    });

    it('dispara e-mail de reset', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue({ id: 'u1', email: 'a@a.com' });
      const r = await service.resetarSenha('u1');
      expect(mailerMock.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'a@a.com' }),
      );
      expect(r).toEqual({ message: 'E-mail de redefinição enviado.' });
    });
  });

  describe('buscarUsuarios', () => {
    it('retorna usuários cujo nome ou email contém o termo (máx 10)', async () => {
      prismaMock.usuario.findMany.mockResolvedValue([
        { id: 'u1', nome: 'Alice', email: 'alice@x.com', avatarUrl: null },
      ]);
      const r = await service.buscarUsuarios('ali');
      expect(prismaMock.usuario.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { nome: { contains: 'ali', mode: 'insensitive' } },
            { email: { contains: 'ali', mode: 'insensitive' } },
          ],
        },
        select: { id: true, nome: true, email: true, avatarUrl: true },
        take: 10,
      });
      expect(r).toHaveLength(1);
      expect(r[0].nome).toBe('Alice');
    });
  });
});
