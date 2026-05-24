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
      await api.post(`/admin/ranking/${bolaoId}/publicar`);
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
            {publicando ? 'Publicando...' : 'Publicar ranking'}
          </button>
        )}
      </div>
      {erro && <p className="text-trovao-red text-xs">{erro}</p>}
      <div className="space-y-2">
        {ranking.map(r => (
          <div key={r.id} className="flex items-center justify-between px-3 py-2 bg-trovao-surface rounded-lg text-sm">
            <span className="text-trovao-muted w-6">{r.posicao}º</span>
            <span className="flex-1 text-white">{r.usuario.nome}</span>
            <span className="text-trovao-gold font-bold tabular-nums">{r.pontuacaoTotal} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}
