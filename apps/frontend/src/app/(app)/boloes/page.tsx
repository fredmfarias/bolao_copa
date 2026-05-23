'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Bolao } from '@/types/api';

export default function BolaoesPage() {
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

  function BolaoItem({ b }: { b: Bolao }) {
    return (
      <Link href={`/boloes/${b.id}`}
        className="block bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-yellow-400/50 transition-colors">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-semibold">{b.nome}</p>
            {b.descricao && <p className="text-sm text-gray-400 mt-0.5">{b.descricao}</p>}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            b.status === 'ATIVO' ? 'bg-green-900 text-green-400' :
            b.status === 'PAGO' ? 'bg-blue-900 text-blue-400' : 'bg-gray-800 text-gray-500'
          }`}>{b.status}</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">{b._count?.membros ?? 0} / {b.maxParticipantes} participantes</p>
      </Link>
    );
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
        <div className="grid gap-4 sm:grid-cols-2">{meus.map(b => <BolaoItem key={b.id} b={b} />)}</div>
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
          <div className="grid gap-3 sm:grid-cols-2">{resultados.map(b => <BolaoItem key={b.id} b={b} />)}</div>
        )}
      </div>
    </div>
  );
}
