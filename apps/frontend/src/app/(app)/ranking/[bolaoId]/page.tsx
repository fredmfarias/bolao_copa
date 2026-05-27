'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { RankingPodium } from '@/components/RankingPodium';
import { RankingRow } from '@/components/RankingRow';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import type { RankingEntry, PublicacaoResumo } from '@/types/api';

type Aba = 'geral' | 'rodada';

export default function RankingPage() {
  const { bolaoId } = useParams<{ bolaoId: string }>();
  const { user } = useAuth();
  const [aba, setAba] = useState<Aba>('geral');
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [publicacoes, setPublicacoes] = useState<PublicacaoResumo[]>([]);
  const [publicacaoSel, setPublicacaoSel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const rankingGeralRef = useRef<RankingEntry[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<RankingEntry[]>(`/boloes/${bolaoId}/ranking`).catch(() => [] as RankingEntry[]),
      api.get<PublicacaoResumo[]>(`/boloes/${bolaoId}/ranking/publicacoes`).catch(() => [] as PublicacaoResumo[]),
    ]).then(([r, pubs]) => {
      rankingGeralRef.current = r;
      setRanking(r);
      setPublicacoes(pubs);
      setPublicacaoSel(pubs[0]?.numero ?? null);
      setLoading(false);
    });
  }, [bolaoId]);

  useEffect(() => {
    if (aba === 'geral') {
      setRanking(rankingGeralRef.current);
      return;
    }
    if (publicacaoSel === null) return;
    api.get<RankingEntry[]>(`/boloes/${bolaoId}/ranking?publicacao=${publicacaoSel}`)
      .then(setRanking)
      .catch(() => setRanking([]));
  }, [publicacaoSel, bolaoId, aba]);

  const ordenado = aba === 'rodada'
    ? [...ranking].sort((a, b) => b.pontuacaoRodada - a.pontuacaoRodada)
    : ranking;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ranking</h1>
        <Link href="/ranking" className="text-trovao-muted text-sm hover:text-white">← Voltar</Link>
      </div>

      {loading ? (
        <PageSkeleton />
      ) : ranking.length === 0 && publicacoes.length === 0 ? (
        <EmptyState
          titulo="Aguardando publicação"
          descricao="O ranking será publicado pelo administrador após os jogos."
        />
      ) : (
        <>
          <div className="flex gap-2">
            <button onClick={() => setAba('geral')}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                aba === 'geral' ? 'bg-trovao-gold text-trovao-base border-trovao-gold'
                  : 'bg-trovao-surface text-trovao-muted border-trovao-border'}`}>
              Geral
            </button>
            <button onClick={() => setAba('rodada')}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                aba === 'rodada' ? 'bg-trovao-gold text-trovao-base border-trovao-gold'
                  : 'bg-trovao-surface text-trovao-muted border-trovao-border'}`}>
              Rodada
            </button>
          </div>

          {aba === 'rodada' && publicacoes.length > 0 && (
            <select
              value={publicacaoSel ?? ''}
              onChange={(e) => setPublicacaoSel(Number(e.target.value))}
              className="bg-trovao-surface border border-trovao-border rounded-lg text-sm px-2 py-1 text-white"
            >
              {publicacoes.map((p) => (
                <option key={p.numero} value={p.numero}>Rodada {p.numero}</option>
              ))}
            </select>
          )}

          {aba === 'geral' && (
            <RankingPodium ranking={ordenado} myId={user?.id} />
          )}

          {aba === 'rodada' && (
            <RankingPodium
              ranking={ordenado.map(e => ({ ...e, pontuacaoTotal: e.pontuacaoRodada }))}
              myId={user?.id}
            />
          )}

          <div className="space-y-2 mt-4">
            {ordenado.map((entry) => (
              <RankingRow
                key={entry.id}
                entry={aba === 'rodada'
                  ? { ...entry, pontuacaoTotal: entry.pontuacaoRodada, posicoesGanhas: 0 }
                  : entry}
                myId={user?.id}
                bolaoId={bolaoId}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
