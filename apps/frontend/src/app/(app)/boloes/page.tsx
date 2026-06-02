'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { BolaoCard } from '@/components/BolaoCard';
import { BOLAO_GLOBAL_ID } from '@bolao/shared';
import type { Bolao } from '@/types/api';

export default function BolaoesPage() {
  const { user, refresh } = useAuth();
  const [meus, setMeus] = useState<Bolao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Bolao[]>('/boloes/meus')
      .then(setMeus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const semBolaoReal = !loading && meus.length === 1 && meus[0].id === BOLAO_GLOBAL_ID;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Meus Bolões</h1>
      </div>

      {semBolaoReal && (
        <div className="bg-yellow-900/40 border border-yellow-600/50 text-yellow-200 rounded-lg px-4 py-3 text-sm">
          ⚠ Você ainda não participa de nenhum bolão privado. Entre em contato com o moderador do seu bolão para solicitar um convite.
        </div>
      )}

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
              onFavoritoChange={b.id !== BOLAO_GLOBAL_ID ? refresh : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
