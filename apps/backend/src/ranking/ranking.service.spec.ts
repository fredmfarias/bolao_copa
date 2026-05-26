import { Test } from '@nestjs/testing';
import { RankingService } from './ranking.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RankingService.calcularNivel', () => {
  const service = new RankingService(null as any);

  it('nível 1 — placar exato', () => {
    expect(service.calcularNivel({ placarCasa: 2, placarVisitante: 1 }, { placarCasa: 2, placarVisitante: 1 })).toBe(1);
  });

  it('nível 1 — empate placar exato', () => {
    expect(service.calcularNivel({ placarCasa: 1, placarVisitante: 1 }, { placarCasa: 1, placarVisitante: 1 })).toBe(1);
  });

  it('nível 2 — placar do vencedor correto (não exato)', () => {
    // Aposta 2x0, Jogo 2x1 → acertou placar da casa (vencedora), errou visitante
    expect(service.calcularNivel({ placarCasa: 2, placarVisitante: 0 }, { placarCasa: 2, placarVisitante: 1 })).toBe(2);
  });

  it('nível 3 — empate correto (sem placar exato)', () => {
    // Aposta 1x1 (empate), Jogo 0x0 (empate) → acertou resultado, errou placar
    expect(service.calcularNivel({ placarCasa: 1, placarVisitante: 1 }, { placarCasa: 0, placarVisitante: 0 })).toBe(3);
  });

  it('nível 4 — placar do perdedor correto', () => {
    // Aposta 3x1, Jogo 2x1 → acertou visitante (perdedor), errou casa
    expect(service.calcularNivel({ placarCasa: 3, placarVisitante: 1 }, { placarCasa: 2, placarVisitante: 1 })).toBe(4);
  });

  it('nível 5 — acertou apenas o vencedor', () => {
    // Aposta 3x0, Jogo 2x1 → casa ganhou, errou ambos os placares
    expect(service.calcularNivel({ placarCasa: 3, placarVisitante: 0 }, { placarCasa: 2, placarVisitante: 1 })).toBe(5);
  });

  it('nível 0 — errou tudo', () => {
    // Apostou visitante, jogo casa ganhou
    expect(service.calcularNivel({ placarCasa: 0, placarVisitante: 2 }, { placarCasa: 2, placarVisitante: 1 })).toBe(0);
  });
});

describe('RankingService leitura de snapshot', () => {
  const prismaMock = {
    publicacao: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    rankingSnapshot: { findMany: jest.fn() },
  };
  let service: RankingService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [RankingService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(RankingService);
    jest.clearAllMocks();
  });

  describe('obterRanking', () => {
    it('retorna [] quando não há publicação', async () => {
      prismaMock.publicacao.findFirst.mockResolvedValue(null);
      const r = await service.obterRanking('b1');
      expect(r).toEqual([]);
      expect(prismaMock.rankingSnapshot.findMany).not.toHaveBeenCalled();
    });

    it('usa a última publicação quando numero não é informado', async () => {
      prismaMock.publicacao.findFirst.mockResolvedValue({ id: 'pub-3', numero: 3 });
      prismaMock.rankingSnapshot.findMany.mockResolvedValue([{ id: 's1', posicao: 1 }]);
      const r = await service.obterRanking('b1');
      expect(prismaMock.rankingSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { bolaoId: 'b1', publicacaoId: 'pub-3' } }),
      );
      expect(r).toHaveLength(1);
    });

    it('usa a publicação informada por numero', async () => {
      prismaMock.publicacao.findUnique.mockResolvedValue({ id: 'pub-2', numero: 2 });
      prismaMock.rankingSnapshot.findMany.mockResolvedValue([]);
      await service.obterRanking('b1', 2);
      expect(prismaMock.publicacao.findUnique).toHaveBeenCalledWith({ where: { numero: 2 } });
      expect(prismaMock.rankingSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { bolaoId: 'b1', publicacaoId: 'pub-2' } }),
      );
    });
  });

  describe('listarPublicacoes', () => {
    it('retorna numeros das publicações com snapshot do bolão, desc', async () => {
      prismaMock.rankingSnapshot.findMany.mockResolvedValue([
        { publicacao: { numero: 3, publicadoEm: new Date('2026-05-26') } },
        { publicacao: { numero: 2, publicadoEm: new Date('2026-05-25') } },
      ]);
      const r = await service.listarPublicacoes('b1');
      expect(r).toEqual([
        { numero: 3, publicadoEm: new Date('2026-05-26') },
        { numero: 2, publicadoEm: new Date('2026-05-25') },
      ]);
    });
  });

  describe('evolucao', () => {
    it('retorna série {numero, posicao} ordenada por numero asc', async () => {
      prismaMock.rankingSnapshot.findMany.mockResolvedValue([
        { posicao: 5, publicacao: { numero: 1 } },
        { posicao: 2, publicacao: { numero: 2 } },
      ]);
      const r = await service.evolucao('b1', 'u1');
      expect(r).toEqual([
        { numero: 1, posicao: 5 },
        { numero: 2, posicao: 2 },
      ]);
      expect(prismaMock.rankingSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { bolaoId: 'b1', usuarioId: 'u1' } }),
      );
    });
  });
});
