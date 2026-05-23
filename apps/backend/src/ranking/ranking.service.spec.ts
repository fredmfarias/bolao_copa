import { RankingService } from './ranking.service';

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
