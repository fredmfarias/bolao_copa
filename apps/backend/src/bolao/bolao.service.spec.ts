import { Test } from '@nestjs/testing';
import { BolaoService } from './bolao.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BolaoMembroPapel } from '@bolao/shared';
import { InscricaoWindowService } from '../inscricao-window/inscricao-window.service';

const prismaMock = {
  bolao: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  bolaoMembro: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), update: jest.fn(), count: jest.fn(), deleteMany: jest.fn() },
  bolaoConvite: { findUnique: jest.fn(), create: jest.fn() },
  ranking: { create: jest.fn(), deleteMany: jest.fn() },
  usuario: { findUnique: jest.fn() },
};

const inscricaoMock = { assertAberta: jest.fn() };

describe('BolaoService', () => {
  let service: BolaoService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BolaoService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: InscricaoWindowService, useValue: inscricaoMock },
      ],
    }).compile();
    service = module.get(BolaoService);
    jest.clearAllMocks();
    inscricaoMock.assertAberta.mockResolvedValue(undefined);
  });

  it('criar lança BadRequestException se maxParticipantes não é múltiplo de 10', async () => {
    await expect(
      service.criar('admin-1', { nome: 'Test', maxParticipantes: 15, moderadorId: 'mod-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('criar calcula precoReais = maxParticipantes × 1', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 'mod-1' });
    prismaMock.bolao.create.mockResolvedValue({ id: 'b1', maxParticipantes: 20, precoReais: 20 });
    prismaMock.bolaoMembro.create.mockResolvedValue({});
    prismaMock.ranking.create.mockResolvedValue({});
    await service.criar('admin-1', { nome: 'Test', maxParticipantes: 20, moderadorId: 'mod-1' });
    expect(prismaMock.bolao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ precoReais: 20 }) }),
    );
  });

  it('criar usa moderadorId como membro MODERADOR, não adminId', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 'mod-1' });
    prismaMock.bolao.create.mockResolvedValue({ id: 'b1', maxParticipantes: 10, precoReais: 10 });
    prismaMock.bolaoMembro.create.mockResolvedValue({});
    prismaMock.ranking.create.mockResolvedValue({});
    await service.criar('admin-1', { nome: 'Test', maxParticipantes: 10, moderadorId: 'mod-1' });
    expect(prismaMock.bolaoMembro.create).toHaveBeenCalledWith({
      data: { bolaoId: 'b1', usuarioId: 'mod-1', papel: BolaoMembroPapel.MODERADOR },
    });
    expect(prismaMock.ranking.create).toHaveBeenCalledWith({
      data: { bolaoId: 'b1', usuarioId: 'mod-1' },
    });
  });

  it('criar não insere admin como membro nem no ranking', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 'mod-1' });
    prismaMock.bolao.create.mockResolvedValue({ id: 'b1', maxParticipantes: 10, precoReais: 10 });
    prismaMock.bolaoMembro.create.mockResolvedValue({});
    prismaMock.ranking.create.mockResolvedValue({});
    await service.criar('admin-1', { nome: 'Test', maxParticipantes: 10, moderadorId: 'mod-1' });
    expect(prismaMock.bolaoMembro.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.ranking.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.bolaoMembro.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ usuarioId: 'admin-1' }) }),
    );
  });

  it('criar lança NotFoundException se moderadorId não existe', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    await expect(
      service.criar('admin-1', { nome: 'Test', maxParticipantes: 10, moderadorId: 'non-existent' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('entrarViaConvite lança BadRequestException se convite expirado', async () => {
    prismaMock.bolaoConvite.findUnique.mockResolvedValue({
      bolaoId: 'b1',
      expiraEm: new Date(Date.now() - 1000),
    });
    await expect(
      service.entrarViaConvite({ id: 'user-1', role: 'USER' }, 'token-expirado'),
    ).rejects.toThrow(BadRequestException);
  });

  it('entrarViaConvite lança ForbiddenException quando janela fechada', async () => {
    inscricaoMock.assertAberta.mockRejectedValueOnce(new ForbiddenException('Inscrições encerradas.'));
    await expect(
      service.entrarViaConvite({ id: 'u1', role: 'USER' }, 'token-valido'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('entrarViaConvite passa quando admin', async () => {
    prismaMock.bolaoConvite.findUnique.mockResolvedValue({ bolaoId: 'b1', expiraEm: null });
    prismaMock.bolaoMembro.findUnique.mockResolvedValue(null);
    prismaMock.bolao.findUnique.mockResolvedValue({ id: 'b1', maxParticipantes: 10 });
    prismaMock.bolaoMembro.count.mockResolvedValue(0);
    prismaMock.bolaoMembro.create.mockResolvedValue({});
    prismaMock.ranking.create.mockResolvedValue({});
    await service.entrarViaConvite({ id: 'admin-1', role: 'ADMIN' }, 'token-valido');
    expect(inscricaoMock.assertAberta).toHaveBeenCalledWith({ id: 'admin-1', role: 'ADMIN' });
  });

  it('entrarViaConvite retorna associação existente quando já é membro (idempotente)', async () => {
    const membroExistente = { bolaoId: 'b1', usuarioId: 'user-1' };
    prismaMock.bolaoConvite.findUnique.mockResolvedValue({ bolaoId: 'b1', expiraEm: null });
    prismaMock.bolaoMembro.findUnique.mockResolvedValue(membroExistente);

    const resultado = await service.entrarViaConvite({ id: 'user-1', role: 'USER' }, 'token-valido');

    expect(resultado).toBe(membroExistente);
    expect(inscricaoMock.assertAberta).toHaveBeenCalledWith({ id: 'user-1', role: 'USER' });
    expect(prismaMock.bolaoMembro.create).not.toHaveBeenCalled();
    expect(prismaMock.ranking.create).not.toHaveBeenCalled();
    expect(prismaMock.bolaoMembro.count).not.toHaveBeenCalled();
  });

  it('aprovarMembro lança ForbiddenException quando janela fechada', async () => {
    inscricaoMock.assertAberta.mockRejectedValueOnce(new ForbiddenException('Inscrições encerradas.'));
    await expect(
      service.aprovarMembro({ id: 'mod-1', role: 'USER' }, 'b1', 'u1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('atualizarPagamento chama update com status correto', async () => {
    prismaMock.bolaoMembro.update.mockResolvedValue({});
    await service.atualizarPagamento('b1', 'u1', 'PAGO' as any);
    expect(prismaMock.bolaoMembro.update).toHaveBeenCalledWith({
      where: { bolaoId_usuarioId: { bolaoId: 'b1', usuarioId: 'u1' } },
      data: { statusPagamento: 'PAGO' },
    });
  });
});
