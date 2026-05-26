'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { RankingEntry } from '@/types/api';

interface AdminRankingPreviewProps {
  bolaoId: string;
}

export function AdminRankingPreview({ bolaoId }: AdminRankingPreviewProps) {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [publicando, setPublicando] = useState(false);
  const [publicado, setPublicado] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get<RankingEntry[]>(`/admin/ranking/${bolaoId}/draft`)
      .then(setRanking)
      .catch(() => setRanking([]))
      .finally(() => setLoading(false));
  }, [bolaoId]);

  async function publicar() {
    setPublicando(true);
    setErro('');
    try {
      // Publicação é global: fecha a rodada para todos os bolões habilitados.
      await api.post('/admin/publicacoes');
      setPublicado(true);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao publicar.');
    } finally {
      setPublicando(false);
    }
  }

  if (loading) return <p className="text-trovao-muted text-sm">Carregando draft...</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-trovao-muted text-xs">{ranking.length} participantes</p>
        {publicado ? (
          <span className="text-trovao-green text-xs font-semibold">Publicado</span>
        ) : (
          <button onClick={publicar} disabled={publicando}
            className="px-3 py-1.5 bg-trovao-gold text-trovao-base text-xs font-bold rounded-lg disabled:opacity-50">
            {publicando ? 'Publicando...' : 'Publicar rodada (global)'}
          </button>
        )}
      </div>
      {erro && <p className="text-trovao-red text-xs">{erro}</p>}
      <div className="space-y-2">
        {ranking.map(r => (
          <div key={r.id} className="flex items-center justify-between px-3 py-2 bg-trovao-surface rounded-lg text-sm">
            <span className="text-trovao-muted w-6">{r.posicao}º</span>
            <span className="flex-1 text-white">{r.usuario.nome}</span>
            {r.posicoesGanhas !== 0 && (
              <span className={`text-xs font-semibold tabular-nums mr-2 ${
                r.posicoesGanhas > 0 ? 'text-trovao-green' : 'text-trovao-red'
              }`}>
                {r.posicoesGanhas > 0 ? '▲' : '▼'}{Math.abs(r.posicoesGanhas)}
              </span>
            )}
            <span className="text-trovao-gold font-bold tabular-nums">{r.pontuacaoTotal} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}
