import { TopEntry, UserRef } from '../estatistica.types';

export function mediana(valores: number[]): number {
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 === 0 ? (v[meio - 1] + v[meio]) / 2 : v[meio];
}

/** Desvio padrão populacional. */
export function desvioPadrao(valores: number[]): number {
  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  const variancia = valores.reduce((acc, x) => acc + (x - media) ** 2, 0) / valores.length;
  return Math.sqrt(variancia);
}

export function incrementar(mapa: Map<string, number>, chave: string, delta = 1): void {
  mapa.set(chave, (mapa.get(chave) ?? 0) + delta);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Converte contagens por usuário em linhas de ranking: empatados dividem a
 * linha, ordena por valor desc e corta nas N primeiras linhas. Valores <= 0
 * e usuários fora do mapa de membros são descartados.
 */
export function topEntries(
  contagens: Map<string, number>,
  membros: Map<string, UserRef>,
  n = 3,
): TopEntry[] {
  const grupos = new Map<number, UserRef[]>();
  for (const [usuarioId, valor] of contagens) {
    if (valor <= 0) continue;
    const usuario = membros.get(usuarioId);
    if (!usuario) continue;
    const lista = grupos.get(valor) ?? [];
    lista.push(usuario);
    grupos.set(valor, lista);
  }
  return [...grupos.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, n)
    .map(([valor, usuarios]) => ({
      valor,
      usuarios: [...usuarios].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    }));
}
