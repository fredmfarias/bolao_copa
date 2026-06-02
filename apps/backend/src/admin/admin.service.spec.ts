import { Test } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { RankingService } from '../ranking/ranking.service';
import { PublicacaoService } from '../publicacao/publicacao.service';
import { NotificacaoService } from '../notificacao/notificacao.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { BolaoService } from '../bolao/bolao.service';
import { JogoService } from '../jogo/jogo.service';
import * as bcrypt from 'bcrypt';

const bolaoServiceMock = { adicionarMembro: jest.fn() };
const notificacaoMock = { enviarParaTodos: jest.fn().mockResolvedValue(undefined), enviarParaLista: jest.fn().mockResolvedValue(undefined) };
const jogoServiceMock = { verificarLembretes: jest.fn().mockResolvedValue([]), reagendarLembretes: jest.fn().mockResolvedValue({ total: 0, agendados: 0 }) };

const prismaMock = {
  bolao: { findUnique: jest.fn(), findMany: jest.fn() },
  ranking: { findMany: jest.fn(), create: jest.fn() },
  publicacao: { findFirst: jest.fn() },
  rankingSnapshot: { findMany: jest.fn() },
  usuario: { findMany: jest.fn(), update: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  bolaoMembro: { create: jest.fn(), findUnique: jest.fn() },
};
const rankingMock = { recalcularRankingBolao: jest.fn() };
const publicacaoMock = { listarJogosPendentes: jest.fn() };
const mailerMock = { sendMail: jest.fn() };

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RankingService, useValue: rankingMock },
        { provide: PublicacaoService, useValue: publicacaoMock },
        { provide: BolaoService, useValue: bolaoServiceMock },
        { provide: NotificacaoService, useValue: notificacaoMock },
        { provide: JogoService, useValue: jogoServiceMock },
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

  describe('listarPublicacaoPendente', () => {
    it('delega para publicacao.listarJogosPendentes', async () => {
      publicacaoMock.listarJogosPendentes.mockResolvedValue([{ id: 'j1' }]);
      const r = await service.listarPublicacaoPendente();
      expect(r).toEqual([{ id: 'j1' }]);
      expect(publicacaoMock.listarJogosPendentes).toHaveBeenCalled();
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

    it('retorna [] para query vazia', async () => {
      const r = await service.buscarUsuarios('');
      expect(r).toEqual([]);
      expect(prismaMock.usuario.findMany).not.toHaveBeenCalled();
    });
  });

  describe('criarUsuario', () => {
    beforeEach(() => {
      prismaMock.usuario.findUnique.mockResolvedValue(null);
      prismaMock.usuario.create.mockResolvedValue({ id: 'novo-1', nome: 'X', email: 'x@x.com' });
      prismaMock.bolaoMembro.create.mockResolvedValue({});
      prismaMock.ranking.create.mockResolvedValue({});
      bolaoServiceMock.adicionarMembro.mockResolvedValue({});
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hash' as never);
    });

    it('cria usuário com emailVerificado=true e entra no bolão global', async () => {
      await service.criarUsuario({ nome: 'X', email: 'x@x.com', senhaTemp: '12345678' });
      expect(prismaMock.usuario.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ nome: 'X', email: 'x@x.com', emailVerificado: true, senhaHash: 'hash' }),
      });
      expect(prismaMock.bolaoMembro.create).toHaveBeenCalledWith({
        data: { bolaoId: '00000000-0000-0000-0000-000000000001', usuarioId: 'novo-1' },
      });
    });

    it('lança ConflictException se e-mail já existe', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue({ id: 'existe' });
      await expect(
        service.criarUsuario({ nome: 'X', email: 'x@x.com', senhaTemp: '12345678' }),
      ).rejects.toThrow(ConflictException);
      expect(prismaMock.usuario.create).not.toHaveBeenCalled();
    });

    it('com bolaoId, chama adicionarMembro para o bolão extra', async () => {
      await service.criarUsuario({
        nome: 'X', email: 'x@x.com', senhaTemp: '12345678', bolaoId: 'bolao-extra',
      });
      expect(bolaoServiceMock.adicionarMembro).toHaveBeenCalledWith('bolao-extra', 'novo-1');
    });

    it('com bolaoId igual ao global, NÃO chama adicionarMembro (evita duplicação)', async () => {
      await service.criarUsuario({
        nome: 'X', email: 'x@x.com', senhaTemp: '12345678',
        bolaoId: '00000000-0000-0000-0000-000000000001',
      });
      expect(bolaoServiceMock.adicionarMembro).not.toHaveBeenCalled();
    });
  });

  describe('adicionarUsuarioBolao', () => {
    beforeEach(() => {
      prismaMock.usuario.findUnique.mockReset();
      prismaMock.bolaoMembro.findUnique.mockReset();
      bolaoServiceMock.adicionarMembro.mockClear();
    });

    it('lança NotFoundException se usuário não existe', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue(null);
      await expect(
        service.adicionarUsuarioBolao('b1', 'u-fantasma'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança ConflictException se já é membro', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue({ id: 'u1', ativo: true });
      prismaMock.bolaoMembro.findUnique.mockResolvedValue({ bolaoId: 'b1', usuarioId: 'u1' });
      await expect(
        service.adicionarUsuarioBolao('b1', 'u1'),
      ).rejects.toThrow(ConflictException);
    });

    it('chama bolao.adicionarMembro quando válido', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue({ id: 'u1', ativo: true });
      prismaMock.bolaoMembro.findUnique.mockResolvedValue(null);
      bolaoServiceMock.adicionarMembro.mockResolvedValue({});
      await service.adicionarUsuarioBolao('b1', 'u1');
      expect(bolaoServiceMock.adicionarMembro).toHaveBeenCalledWith('b1', 'u1');
    });
  });
});
