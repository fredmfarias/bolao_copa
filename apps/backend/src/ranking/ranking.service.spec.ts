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
    jogo: { findMany: jest.fn() },
    aposta: { findMany: jest.fn() },
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

  describe('palpitesDoUsuario', () => {
    it('agrupa por publicação e omite rodadas sem jogos visíveis', async () => {
      prismaMock.rankingSnapshot.findMany.mockResolvedValue([
        { publicacao: { id: 'pub-2', numero: 2, publicadoEm: new Date('2026-05-26') } },
        { publicacao: { id: 'pub-1', numero: 1, publicadoEm: new Date('2026-05-25') } },
      ]);
      // pub-2 tem um jogo passado; pub-1 não tem jogos
      prismaMock.jogo.findMany
        .mockResolvedValueOnce([
          {
            id: 'j1', dataHora: new Date('2026-05-25T16:00:00Z'),
            pesoPontuacao: 1, placarCasa: 2, placarVisitante: 1,
            selecaoCasa:      { nome: 'Brasil',    codigo: 'BRA', bandeiraSvg: '<svg></svg>' },
            selecaoVisitante: { nome: 'Argentina', codigo: 'ARG', bandeiraSvg: '<svg></svg>' },
          },
        ])
        .mockResolvedValueOnce([]);
      prismaMock.aposta.findMany.mockResolvedValue([
        { jogoId: 'j1', placarCasa: 2, placarVisitante: 1, pontuacao: 6 },
      ]);

      const r = await service.palpitesDoUsuario('b1', 'u1');

      expect(prismaMock.rankingSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bolaoId: 'b1' },
          distinct: ['publicacaoId'],
        }),
      );
      expect(r).toEqual([
        {
          publicacao: { numero: 2, publicadoEm: new Date('2026-05-26') },
          items: [
            {
              jogo: expect.objectContaining({ id: 'j1' }),
              palpite: { placarCasa: 2, placarVisitante: 1 },
              pontuacao: 6,
            },
          ],
        },
      ]);
    });
  });

  describe('palpitesDaRodada', () => {
    it('retorna jogos da publicação com palpites (ou null) e pontuação', async () => {
      prismaMock.publicacao.findUnique.mockResolvedValue({ id: 'pub-3', numero: 3 });
      prismaMock.jogo.findMany.mockResolvedValue([
        {
          id: 'j1', dataHora: new Date('2026-06-11T16:00:00Z'),
          pesoPontuacao: 2, placarCasa: 2, placarVisitante: 1,
          selecaoCasa:      { nome: 'Brasil',    codigo: 'BRA', bandeiraSvg: '<svg></svg>' },
          selecaoVisitante: { nome: 'Argentina', codigo: 'ARG', bandeiraSvg: '<svg></svg>' },
        },
        {
          id: 'j2', dataHora: new Date('2026-06-11T20:00:00Z'),
          pesoPontuacao: 1, placarCasa: 0, placarVisitante: 0,
          selecaoCasa:      { nome: 'Espanha', codigo: 'ESP', bandeiraSvg: '<svg></svg>' },
          selecaoVisitante: { nome: 'Portugal', codigo: 'POR', bandeiraSvg: '<svg></svg>' },
        },
      ]);
      prismaMock.aposta.findMany.mockResolvedValue([
        { jogoId: 'j1', placarCasa: 2, placarVisitante: 1, pontuacao: 12 },
        // j2 sem aposta
      ]);

      const r = await service.palpitesDaRodada('b1', 3, 'u1');
      expect(prismaMock.publicacao.findUnique).toHaveBeenCalledWith({ where: { numero: 3 } });
      expect(prismaMock.jogo.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { publicacaoId: 'pub-3' },
        orderBy: { dataHora: 'asc' },
      }));
      expect(prismaMock.aposta.findMany).toHaveBeenCalledWith({
        where: { usuarioId: 'u1', jogoId: { in: ['j1', 'j2'] } },
        select: { jogoId: true, placarCasa: true, placarVisitante: true, pontuacao: true },
      });
      expect(r).toEqual([
        {
          jogo: expect.objectContaining({ id: 'j1', pesoPontuacao: 2 }),
          palpite: { placarCasa: 2, placarVisitante: 1 },
          pontuacao: 12,
        },
        {
          jogo: expect.objectContaining({ id: 'j2' }),
          palpite: null,
          pontuacao: 0,
        },
      ]);
    });

    it('retorna lista vazia se publicação não existe', async () => {
      prismaMock.publicacao.findUnique.mockResolvedValue(null);
      const r = await service.palpitesDaRodada('b1', 99, 'u1');
      expect(r).toEqual([]);
    });

    it('omite jogos cujas apostas ainda não encerraram (prazo não atingido)', async () => {
      prismaMock.publicacao.findUnique.mockResolvedValue({ id: 'pub-3', numero: 3 });
      prismaMock.jogo.findMany.mockResolvedValue([
        {
          id: 'j1', dataHora: new Date('2026-06-11T16:00:00Z'), // passado → visível
          pesoPontuacao: 1, placarCasa: 1, placarVisitante: 0,
          selecaoCasa:      { nome: 'Brasil',    codigo: 'BRA', bandeiraSvg: '<svg></svg>' },
          selecaoVisitante: { nome: 'Argentina', codigo: 'ARG', bandeiraSvg: '<svg></svg>' },
        },
        {
          id: 'j2', dataHora: new Date('2099-01-01T00:00:00Z'), // futuro → oculto
          pesoPontuacao: 1, placarCasa: 0, placarVisitante: 0,
          selecaoCasa:      { nome: 'Espanha',  codigo: 'ESP', bandeiraSvg: '<svg></svg>' },
          selecaoVisitante: { nome: 'Portugal', codigo: 'POR', bandeiraSvg: '<svg></svg>' },
        },
      ]);
      prismaMock.aposta.findMany.mockResolvedValue([]);

      const r = await service.palpitesDaRodada('b1', 3, 'u1');

      expect(r).toHaveLength(1);
      expect(r[0].jogo.id).toBe('j1');
      expect(prismaMock.aposta.findMany).toHaveBeenCalledWith({
        where: { usuarioId: 'u1', jogoId: { in: ['j1'] } },
        select: { jogoId: true, placarCasa: true, placarVisitante: true, pontuacao: true },
      });
    });
  });
});

describe('RankingService.recalcularRankingBolao', () => {
  const prismaMock = {
    bolaoMembro: { findMany: jest.fn() },
    aposta: { findMany: jest.fn() },
    ranking: { upsert: jest.fn(), deleteMany: jest.fn() },
  };
  let service: RankingService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [RankingService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(RankingService);
    jest.clearAllMocks();
    prismaMock.ranking.upsert.mockResolvedValue({});
    prismaMock.ranking.deleteMany.mockResolvedValue({});
  });

  function posicaoDe(usuarioId: string): number | undefined {
    const call = prismaMock.ranking.upsert.mock.calls.find(
      (c: any) => c[0].where.bolaoId_usuarioId.usuarioId === usuarioId,
    );
    return call?.[0].update.posicao;
  }

  it('só busca membros ativos do bolão', async () => {
    prismaMock.bolaoMembro.findMany.mockResolvedValue([]);
    prismaMock.aposta.findMany.mockResolvedValue([]);
    await service.recalcularRankingBolao('b1');
    expect(prismaMock.bolaoMembro.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bolaoId: 'b1', usuario: { ativo: true } },
      }),
    );
  });

  it('membro sem apostas fica no fundo, não no topo', async () => {
    prismaMock.bolaoMembro.findMany.mockResolvedValue([
      { usuarioId: 'u-ana', usuario: { nome: 'Ana' } },
      { usuarioId: 'u-bob', usuario: { nome: 'Bob' } },
    ]);
    prismaMock.aposta.findMany.mockResolvedValue([
      {
        usuarioId: 'u-ana',
        placarCasa: 2,
        placarVisitante: 1,
        pontuacao: 10,
        jogo: { placarCasa: 2, placarVisitante: 1 },
      },
    ]);

    await service.recalcularRankingBolao('b1');

    expect(posicaoDe('u-ana')).toBe(1);
    expect(posicaoDe('u-bob')).toBe(2);
  });

  it('não envia o campo nome no upsert (não é coluna do Ranking)', async () => {
    prismaMock.bolaoMembro.findMany.mockResolvedValue([
      { usuarioId: 'u-ana', usuario: { nome: 'Ana' } },
    ]);
    prismaMock.aposta.findMany.mockResolvedValue([]);

    await service.recalcularRankingBolao('b1');

    const call = prismaMock.ranking.upsert.mock.calls[0][0];
    expect(call.update).not.toHaveProperty('nome');
    expect(call.create).not.toHaveProperty('nome');
  });

  it('remove linhas Ranking de membros não-ativos', async () => {
    prismaMock.bolaoMembro.findMany.mockResolvedValue([
      { usuarioId: 'u-ana', usuario: { nome: 'Ana' } },
      { usuarioId: 'u-bob', usuario: { nome: 'Bob' } },
    ]);
    prismaMock.aposta.findMany.mockResolvedValue([]);

    await service.recalcularRankingBolao('b1');

    expect(prismaMock.ranking.deleteMany).toHaveBeenCalledWith({
      where: { bolaoId: 'b1', usuarioId: { notIn: ['u-ana', 'u-bob'] } },
    });
  });

  it('desempata por ordem alfabética crescente do nome', async () => {
    prismaMock.bolaoMembro.findMany.mockResolvedValue([
      { usuarioId: 'u-bruno', usuario: { nome: 'Bruno' } },
      { usuarioId: 'u-ana', usuario: { nome: 'Ana' } },
    ]);
    prismaMock.aposta.findMany.mockResolvedValue([]);

    await service.recalcularRankingBolao('b1');

    expect(posicaoDe('u-ana')).toBe(1);
    expect(posicaoDe('u-bruno')).toBe(2);
  });
});
