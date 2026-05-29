import { Test } from '@nestjs/testing';
import { PublicacaoService } from './publicacao.service';
import { PrismaService } from '../prisma/prisma.service';
import { RankingService } from '../ranking/ranking.service';

const prismaMock = {
  publicacao: { findFirst: jest.fn(), create: jest.fn() },
  jogo: { updateMany: jest.fn(), findMany: jest.fn() },
  bolao: { findMany: jest.fn() },
  bolaoMembro: { findMany: jest.fn() },
  ranking: { findMany: jest.fn() },
  aposta: { findMany: jest.fn() },
  rankingSnapshot: { findMany: jest.fn(), create: jest.fn() },
};
const rankingMock = { recalcularRankingBolao: jest.fn() };

describe('PublicacaoService.listarJogosPendentes', () => {
  let service: PublicacaoService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PublicacaoService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RankingService, useValue: rankingMock },
      ],
    }).compile();
    service = module.get(PublicacaoService);
    jest.clearAllMocks();
  });

  it('retorna jogos com placar e sem publicacao, ordenados por dataHora', async () => {
    prismaMock.jogo.findMany.mockResolvedValue([{ id: 'j1' }]);
    const r = await service.listarJogosPendentes();
    expect(r).toEqual([{ id: 'j1' }]);
    expect(prismaMock.jogo.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { placarCasa: { not: null }, publicacaoId: null },
      orderBy: { dataHora: 'asc' },
    }));
  });
});

describe('PublicacaoService.publicar', () => {
  let service: PublicacaoService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PublicacaoService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RankingService, useValue: rankingMock },
      ],
    }).compile();
    service = module.get(PublicacaoService);
    jest.clearAllMocks();
  });

  function setupBase() {
    prismaMock.publicacao.findFirst.mockResolvedValue({ numero: 2 }); // anterior = 2
    prismaMock.publicacao.create.mockResolvedValue({ id: 'pub-3', numero: 3, publicadoEm: new Date('2026-05-26T00:00:00Z') });
    prismaMock.jogo.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.jogo.findMany.mockResolvedValue([{ id: 'j1' }]); // jogos desta publicacao
    prismaMock.bolao.findMany.mockResolvedValue([{ id: 'b1' }]); // bolões habilitados
    prismaMock.bolaoMembro.findMany.mockResolvedValue([{ usuarioId: 'u1' }]);
    rankingMock.recalcularRankingBolao.mockResolvedValue(undefined);
    prismaMock.ranking.findMany.mockResolvedValue([
      { bolaoId: 'b1', usuarioId: 'u1', posicao: 1, pontuacaoTotal: 30,
        acertosPlacarExato: 2, acertosPlacarVencedor: 1, acertosPlacarPerdedor: 0,
        acertosEmpate: 0, acertosGanhador: 1, acertosNada: 0, apostasPostadas: 4 },
    ]);
    prismaMock.aposta.findMany.mockResolvedValue([{ usuarioId: 'u1', pontuacao: 10 }]); // pontos da rodada
    prismaMock.rankingSnapshot.create.mockResolvedValue({});
  }

  it('cria a publicacao com numero sequencial e marca jogos sem publicacao', async () => {
    setupBase();
    prismaMock.rankingSnapshot.findMany.mockResolvedValue([]); // sem snapshot anterior
    await service.publicar('admin-1');
    expect(prismaMock.publicacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { numero: 3, publicadoPorId: 'admin-1' } }),
    );
    expect(prismaMock.jogo.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['j1'] } },
      data: { publicacaoId: 'pub-3' },
    });
  });

  it('grava snapshot com pontuacaoRodada somando apostas dos jogos da publicacao', async () => {
    setupBase();
    prismaMock.rankingSnapshot.findMany.mockResolvedValue([]);
    await service.publicar('admin-1');
    expect(prismaMock.rankingSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publicacaoId: 'pub-3', bolaoId: 'b1', usuarioId: 'u1',
          posicao: 1, pontuacaoTotal: 30, pontuacaoRodada: 10, posicoesGanhas: 0,
          acertosPlacarExato: 2, apostasPostadas: 4,
        }),
      }),
    );
  });

  it('calcula posicoesGanhas como posicaoAnterior - posicao', async () => {
    setupBase();
    // snapshot anterior: usuário estava em 4º → ganhou 3 posições (4 - 1)
    prismaMock.rankingSnapshot.findMany.mockResolvedValue([
      { usuarioId: 'u1', posicao: 4 },
    ]);
    await service.publicar('admin-1');
    expect(prismaMock.rankingSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ posicoesGanhas: 3 }) }),
    );
  });

  it('primeira publicacao começa numero=1', async () => {
    setupBase();
    prismaMock.publicacao.findFirst.mockResolvedValue(null); // nenhuma anterior
    prismaMock.publicacao.create.mockResolvedValue({ id: 'pub-1', numero: 1, publicadoEm: new Date() });
    prismaMock.rankingSnapshot.findMany.mockResolvedValue([]);
    await service.publicar('admin-1');
    expect(prismaMock.publicacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { numero: 1, publicadoPorId: 'admin-1' } }),
    );
  });

  it('só recalcula bolões ativos', async () => {
    setupBase();
    prismaMock.rankingSnapshot.findMany.mockResolvedValue([]);
    await service.publicar('admin-1');
    expect(prismaMock.bolao.findMany).toHaveBeenCalledWith({
      where: { status: 'ATIVO' }, select: { id: true },
    });
    expect(rankingMock.recalcularRankingBolao).toHaveBeenCalledWith('b1');
  });
});
