import type { Palpite } from '@/types/api';

export interface PlacarContagem {
  key: string;
  casa: number;
  visitante: number;
  count: number;
}

export interface PalpiteOrdenado {
  palpite: Palpite;
  posicao?: number;
}

export function placarKey(p: { placarCasa: number; placarVisitante: number }): string {
  return `${p.placarCasa}x${p.placarVisitante}`;
}

export function contarPlacares(palpites: Palpite[]): PlacarContagem[] {
  const mapa = new Map<string, PlacarContagem>();
  for (const p of palpites) {
    const key = placarKey(p);
    const existente = mapa.get(key);
    if (existente) {
      existente.count++;
    } else {
      mapa.set(key, { key, casa: p.placarCasa, visitante: p.placarVisitante, count: 1 });
    }
  }
  return [...mapa.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function ordenarPorClassificacao(
  palpites: Palpite[],
  posicoes: Map<string, number>,
): PalpiteOrdenado[] {
  // Array.prototype.sort é estável: não ranqueados (Infinity) mantêm a ordem do backend.
  return palpites
    .map((palpite) => ({ palpite, posicao: posicoes.get(palpite.usuarioId) }))
    .sort((a, b) => (a.posicao ?? Infinity) - (b.posicao ?? Infinity));
}
