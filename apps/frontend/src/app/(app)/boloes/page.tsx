'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { BolaoCard } from '@/components/BolaoCard';
import type { Bolao } from '@/types/api';

export default function BolaoesPage() {
  const { user, refresh } = useAuth();
  const [meus, setMeus] = useState<Bolao[]>([]);
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Bolao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Bolao[]>('/boloes/meus')
      .then(setMeus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleBusca(e: React.FormEvent) {
    e.preventDefault();
    if (!busca.trim()) return;
    const data = await api.get<Bolao[]>(`/boloes/buscar?nome=${encodeURIComponent(busca)}`).catch(() => []);
    setResultados(data);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Meus Bolões</h1>
        <Link href="/boloes/novo"
          className="bg-yellow-400 text-gray-900 font-bold px-4 py-2 rounded-lg text-sm hover:bg-yellow-300">
          + Criar bolão
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500 text-center">Carregando...</p>
      ) : meus.length === 0 ? (
        <p className="text-gray-500 text-center">Você ainda não participa de nenhum bolão privado.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {meus.map(b => (
            <BolaoCard
              key={b.id}
              bolao={b}
              href={`/boloes/${b.id}`}
              favoritoId={user?.bolaoFavoritoId}
              onFavoritoChange={refresh}
            />
          ))}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Buscar bolão</h2>
        <form onSubmit={handleBusca} className="flex gap-2">
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome do bolão"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400" />
          <button type="submit"
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm">Buscar</button>
        </form>
        {resultados.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {resultados.map(b => (
              <BolaoCard
                key={b.id}
                bolao={b}
                href={`/boloes/${b.id}`}
                favoritoId={user?.bolaoFavoritoId}
                onFavoritoChange={refresh}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
