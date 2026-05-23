'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { RankingTable } from '@/components/RankingTable';
import type { RankingEntry } from '@/types/api';

export default function RankingPage() {
  const { bolaoId } = useParams<{ bolaoId: string }>();
  const { user } = useAuth();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<RankingEntry[]>(`/boloes/${bolaoId}/ranking`).catch(() => [])
      .then(setRanking)
      .finally(() => setLoading(false));
  }, [bolaoId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ranking</h1>
        <Link href={`/boloes/${bolaoId}`} className="text-sm text-gray-400 hover:text-white">← Voltar</Link>
      </div>
      {loading ? (
        <p className="text-gray-500 text-center">Carregando...</p>
      ) : (
        <RankingTable ranking={ranking} myId={user?.id} />
      )}
    </div>
  );
}
