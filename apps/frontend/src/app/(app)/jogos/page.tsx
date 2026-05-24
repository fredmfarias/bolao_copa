'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { JogoCard } from '@/components/JogoCard';
import { ApostaForm } from '@/components/ApostaForm';
import type { Jogo } from '@/types/api';
import { JogoFase } from '@bolao/shared';
import { BOLAO_GLOBAL_ID } from '@bolao/shared';

const FASES = ['Todos', ...Object.values(JogoFase)];

export default function JogosPage() {
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [fase, setFase] = useState('Todos');
  const [apostando, setApostando] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    const params = fase !== 'Todos' ? `?fase=${fase}` : '';
    const data = await api.get<Jogo[]>(`/jogos${params}`).catch(() => []);
    setJogos(data);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [fase]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Jogos</h1>
        <select value={fase} onChange={e => setFase(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white">
          {FASES.map(f => <option key={f}>{f}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500 text-center">Carregando jogos...</p>
      ) : jogos.length === 0 ? (
        <p className="text-gray-500 text-center">Nenhum jogo encontrado.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {jogos.map(jogo => (
            <div key={jogo.id}>
              {apostando === jogo.id ? (
                <ApostaForm jogo={jogo} bolaoId={BOLAO_GLOBAL_ID}
                  onSuccess={() => { setApostando(null); carregar(); }}
                  onCancel={() => setApostando(null)} />
              ) : (
                <JogoCard jogo={jogo} aposta={undefined}
                  onApostar={() => setApostando(jogo.id)} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
