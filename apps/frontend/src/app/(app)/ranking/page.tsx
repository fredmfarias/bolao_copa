'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { BolaoCard } from '@/components/BolaoCard';
import { PageSkeleton } from '@/components/PageSkeleton';
import { BOLAO_GLOBAL_ID } from '@bolao/shared';
import type { Bolao } from '@/types/api';

export default function RankingIndexPage() {
  const { user, refresh } = useAuth();
  const [boloes, setBoloes] = useState<Bolao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Bolao[]>('/boloes/meus')
      .then(setBoloes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  const global = boloes.find(b => b.id === BOLAO_GLOBAL_ID);
  const privados = boloes.filter(b => b.id !== BOLAO_GLOBAL_ID);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Ranking</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {global && (
          <BolaoCard
            bolao={global}
            href={`/ranking/${BOLAO_GLOBAL_ID}`}
          />
        )}
        {privados.length === 0 && !global ? (
          <p className="text-trovao-muted text-sm px-1 col-span-2">Você não participa de nenhum bolão privado.</p>
        ) : (
          privados.map(b => (
            <BolaoCard
              key={b.id}
              bolao={b}
              href={`/ranking/${b.id}`}
              favoritoId={user?.bolaoFavoritoId}
              onFavoritoChange={refresh}
            />
          ))
        )}
      </div>
    </div>
  );
}
