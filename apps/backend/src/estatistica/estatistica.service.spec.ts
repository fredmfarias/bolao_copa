// apps/backend/src/estatistica/estatistica.service.spec.ts
import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EstatisticaService } from './estatistica.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  bolao: { findUnique: jest.fn() },
  bolaoMembro: { findUnique: jest.fn(), findMany: jest.fn() },
  publicacao: { findFirst: jest.fn() },
  rankingSnapshot: { findMany: jest.fn() },
  jogo: { findMany: jest.fn() },
  aposta: { findMany: jest.fn() },
  configuracaoPontuacao: { findFirst: jest.fn() },
};

const publicacao1 = { id: 'pub-1', numero: 1, publicadoEm: new Date('2026-06-20T12:00:00Z') };

function mockDatasetsVazios() {
  prismaMock.bolaoMembro.findMany.mockResolvedValue([
    { usuario: { id: 'u1', nome: 'Ana', avatarUrl: null } },
  ]);
  prismaMock.rankingSnapshot.findMany.mockResolvedValue([
    {
      usuarioId: 'u1', posicao: 1, posicoesGanhas: 0, pontuacaoRodada: 10,
      acertosPlacarExato: 1, publicacao: { numero: 1 },
    },
  ]);
  prismaMock.jogo.findMany.mockResolvedValue([]);
  prismaMock.aposta.findMany.mockResolvedValue([]);
  prismaMock.configuracaoPontuacao.findFirst.mockResolvedValue({ nivel: 1, pontos: 10 });
}

describe('EstatisticaService', () => {
  let service: EstatisticaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [EstatisticaService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(EstatisticaService);
    jest.clearAllMocks();
    prismaMock.bolao.findUnique.mockResolvedValue({ id: 'bolao-1' });
    prismaMock.bolaoMembro.findUnique.mockResolvedValue({ id: 'membro-1' });
    prismaMock.publicacao.findFirst.mockResolvedValue(publicacao1);
  });

  it('lança NotFoundException para bolão inexistente', async () => {
    prismaMock.bolao.findUnique.mockResolvedValue(null);
    await expect(service.obter('nao-existe', 'u1')).rejects.toThrow(NotFoundException);
  });

  it('lança ForbiddenException para não-membro', async () => {
    prismaMock.bolaoMembro.findUnique.mockResolvedValue(null);
    await expect(service.obter('bolao-1', 'u1')).rejects.toThrow(ForbiddenException);
  });

  it('retorna temDados false sem publicação', async () => {
    prismaMock.publicacao.findFirst.mockResolvedValue(null);
    expect(await service.obter('bolao-1', 'u1')).toEqual({ temDados: false });
  });

  it('retorna temDados false quando o bolão não tem snapshots', async () => {
    mockDatasetsVazios();
    prismaMock.rankingSnapshot.findMany.mockResolvedValue([]);
    expect(await service.obter('bolao-1', 'u1')).toEqual({ temDados: false });
  });

  it('monta o payload completo e informa a última publicação', async () => {
    mockDatasetsVazios();
    const r = await service.obter('bolao-1', 'u1');
    expect(r.temDados).toBe(true);
    if (r.temDados) {
      expect(r.ultimaPublicacao).toEqual({ numero: 1, publicadoEm: publicacao1.publicadoEm });
      expect(r.posicoes.reiDaLideranca).toEqual([
        { valor: 1, usuarios: [{ id: 'u1', nome: 'Ana', avatarUrl: null }] },
      ]);
      expect(r.recordes.maiorPontuacaoRodada!.valor).toBe(10);
    }
  });

  it('cacheia por publicação: segunda chamada não recalcula', async () => {
    mockDatasetsVazios();
    await service.obter('bolao-1', 'u1');
    await service.obter('bolao-1', 'u1');
    expect(prismaMock.rankingSnapshot.findMany).toHaveBeenCalledTimes(1);
  });

  it('nova publicação invalida o cache', async () => {
    mockDatasetsVazios();
    await service.obter('bolao-1', 'u1');
    prismaMock.publicacao.findFirst.mockResolvedValue({ ...publicacao1, id: 'pub-2', numero: 2 });
    await service.obter('bolao-1', 'u1');
    expect(prismaMock.rankingSnapshot.findMany).toHaveBeenCalledTimes(2);
  });
});
