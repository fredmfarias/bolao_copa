'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { prazoEncerrado } from '@/lib/jogoEstado';
import { AdminPlacardCard } from '@/components/AdminPlacardCard';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import type { Jogo } from '@/types/api';

function ordenarJogosAdmin(jogos: Jogo[]): Jogo[] {
  return [...jogos]
    .filter(prazoEncerrado)
    .sort((a, b) => {
      const aTemPlacar = a.placarCasa !== null;
      const bTemPlacar = b.placarCasa !== null;
      if (aTemPlacar !== bTemPlacar) return aTemPlacar ? 1 : -1;
      const diff = new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime();
      return aTemPlacar ? -diff : diff;
    });
}

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

  const jogosOrdenados = ordenarJogosAdmin(jogos);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Placares</h1>
      {loading ? <PageSkeleton /> : jogosOrdenados.length === 0 ? (
        <EmptyState titulo="Nenhum jogo encerrado" />
      ) : (
        <div className="space-y-3">
          {jogosOrdenados.map(jogo => (
            <AdminPlacardCard key={jogo.id} jogo={jogo} onSalvo={carregar} />
          ))}
        </div>
      )}
    </div>
  );
}
