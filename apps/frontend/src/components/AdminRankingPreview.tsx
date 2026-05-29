'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AdminPublicarDialog } from '@/components/AdminPublicarDialog';
import type { JogoPendente, RankingEntry } from '@/types/api';

interface Props { bolaoId: string }

export function AdminRankingPreview({ bolaoId }: Props) {
  const [ranking, setRanking]   = useState<RankingEntry[]>([]);
  const [pendentes, setPendentes] = useState<JogoPendente[] | null>(null);
  const [loading, setLoading]   = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [publicando, setPublicando]   = useState(false);
  const [publicado, setPublicado]     = useState(false);
  const [erro, setErro]               = useState('');

  async function carregar() {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        api.get<RankingEntry[]>(`/admin/ranking/${bolaoId}/draft`),
        api.get<JogoPendente[]>(`/admin/publicacoes/pendente`),
      ]);
      setRanking(r);
      setPendentes(p);
    } catch {
      setRanking([]);
      setPendentes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, [bolaoId]);

  async function publicar() {
    setPublicando(true);
    setErro('');
    try {
      await api.post('/admin/publicacoes');
      setPublicado(true);
      setConfirmando(false);
      carregar();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao publicar.');
    } finally {
      setPublicando(false);
    }
  }

  if (loading) return <p className="text-trovao-muted text-sm">Carregando draft...</p>;

  const qtdPendentes = pendentes?.length ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-trovao-muted text-xs">{ranking.length} participantes</p>
        {publicado ? (
          <span className="text-trovao-green text-xs font-semibold">Publicado</span>
        ) : (
          <div className="flex flex-col items-end gap-0.5">
            <button
              onClick={() => setConfirmando(true)}
              disabled={publicando || qtdPendentes === 0}
              className="px-3 py-1.5 bg-trovao-gold text-trovao-base text-xs font-bold rounded-lg disabled:opacity-50"
            >
              Publicar rodada (global)
            </button>
            <p className="text-trovao-muted text-[10px]">
              {qtdPendentes === 0
                ? 'Nenhum jogo com placar pendente de publicação'
                : `${qtdPendentes} jogo${qtdPendentes === 1 ? '' : 's'} prontos para publicar`}
            </p>
          </div>
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

      <AdminPublicarDialog
        open={confirmando}
        jogos={pendentes ?? []}
        publicando={publicando}
        onCancel={() => setConfirmando(false)}
        onConfirm={publicar}
      />
    </div>
  );
}
