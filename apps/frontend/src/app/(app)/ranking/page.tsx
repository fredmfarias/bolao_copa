'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { BOLAO_GLOBAL_ID } from '@bolao/shared';
import { PageSkeleton } from '@/components/PageSkeleton';
import type { Bolao } from '@/types/api';

export default function RankingIndexPage() {
  const [boloes, setBoloes] = useState<Bolao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Bolao[]>('/boloes/meus')
      .then(setBoloes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  const privados = boloes.filter(b => b.id !== BOLAO_GLOBAL_ID);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Ranking</h1>
      <div className="space-y-2">
        <Link
          href={`/ranking/${BOLAO_GLOBAL_ID}`}
          className="block px-4 py-3 rounded-xl bg-trovao-card border border-trovao-border hover:border-trovao-gold transition-colors"
        >
          <span className="text-white font-medium">Global</span>
        </Link>
        {privados.length === 0 ? (
          <p className="text-trovao-muted text-sm px-1">Você não participa de nenhum bolão privado.</p>
        ) : (
          privados.map(b => (
            <Link
              key={b.id}
              href={`/ranking/${b.id}`}
              className="block px-4 py-3 rounded-xl bg-trovao-card border border-trovao-border hover:border-trovao-gold transition-colors"
            >
              <span className="text-white font-medium">{b.nome}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
