'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AdminPlacardCard } from '@/components/AdminPlacardCard';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import type { Jogo } from '@/types/api';

export default function AdminPlacaresPage() {
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    const data = await api.get<Jogo[]>('/jogos').catch(() => [] as Jogo[]);
    setJogos(data);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Placares</h1>
      {loading ? <PageSkeleton /> : jogos.length === 0 ? (
        <EmptyState titulo="Nenhum jogo" />
      ) : (
        <div className="space-y-3">
          {jogos.map(jogo => (
            <AdminPlacardCard key={jogo.id} jogo={jogo} onSalvo={carregar} />
          ))}
        </div>
      )}
    </div>
  );
}
