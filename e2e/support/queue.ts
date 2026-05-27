import { expect, APIRequestContext } from '@playwright/test';

// Polls the admin draft until the user's pontuacaoTotal reaches at least
// `minimo` — i.e. the Bull job has written aposta.pontuacao and the draft
// recompute reflects it. getRankingDraft returns a NUMBER (0, never null),
// so we must poll on a value, not on null. No fixed sleeps.
export async function aguardarPontuacaoDraft(
  adminApi: APIRequestContext,
  bolaoId: string,
  usuarioId: string,
  minimo = 1,
) {
  await expect
    .poll(async () => {
      const res = await adminApi.get(`/admin/ranking/${bolaoId}/draft`);
      if (!res.ok()) return -1;
      const linhas = (await res.json()) as { usuarioId: string; pontuacaoTotal: number }[];
      const linha = linhas.find((l) => l.usuarioId === usuarioId);
      return linha?.pontuacaoTotal ?? -1;
    }, { timeout: 15_000, intervals: [250, 500, 1000] })
    .toBeGreaterThanOrEqual(minimo);
}
