'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { RankingPodium } from '@/components/RankingPodium';
import { RankingRow } from '@/components/RankingRow';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import type { RankingEntry } from '@/types/api';

export default function RankingPage() {
  const { bolaoId } = useParams<{ bolaoId: string }>();
  const { user } = useAuth();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<RankingEntry[]>(`/boloes/${bolaoId}/ranking`)
      .catch(() => [] as RankingEntry[])
      .then(data => { setRanking(data); setLoading(false); });
  }, [bolaoId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ranking</h1>
        <Link href={`/boloes/${bolaoId}`} className="text-trovao-muted text-sm hover:text-white">← Voltar</Link>
      </div>

      {loading ? (
        <PageSkeleton />
      ) : ranking.length === 0 ? (
        <EmptyState
          titulo="Aguardando publicação"
          descricao="O ranking será publicado pelo administrador após os jogos."
        />
      ) : (
        <>
          <RankingPodium ranking={ranking} myId={user?.id} />
          <div className="space-y-2 mt-4">
            {ranking.slice(3).map(entry => (
              <RankingRow key={entry.id} entry={entry} myId={user?.id} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
