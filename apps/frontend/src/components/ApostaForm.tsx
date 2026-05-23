'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { Jogo } from '@/types/api';

interface Props {
  jogo: Jogo;
  bolaoId: string;
  apostaAtual?: { placarCasa: number; placarVisitante: number };
  onSuccess: () => void;
  onCancel: () => void;
}

export function ApostaForm({ jogo, bolaoId, apostaAtual, onSuccess, onCancel }: Props) {
  const [casa, setCasa] = useState(apostaAtual?.placarCasa ?? 0);
  const [visitante, setVisitante] = useState(apostaAtual?.placarVisitante ?? 0);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      await api.post('/apostas', {
        jogoId: jogo.id,
        bolaoId,
        placarCasa: casa,
        placarVisitante: visitante,
      });
      onSuccess();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-center">
        {jogo.selecaoCasa.nome} x {jogo.selecaoVisitante.nome}
      </p>
      {erro && <p className="text-red-400 text-xs text-center">{erro}</p>}
      <form onSubmit={handleSubmit} className="flex items-center gap-3 justify-center">
        <input type="number" min={0} max={99} value={casa}
          onChange={e => setCasa(Number(e.target.value))}
          className="w-16 text-center bg-gray-700 border border-gray-600 rounded px-2 py-2 text-white text-xl font-bold" />
        <span className="text-gray-500">x</span>
        <input type="number" min={0} max={99} value={visitante}
          onChange={e => setVisitante(Number(e.target.value))}
          className="w-16 text-center bg-gray-700 border border-gray-600 rounded px-2 py-2 text-white text-xl font-bold" />
      </form>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-1.5 border border-gray-600 rounded-lg text-sm hover:bg-gray-700">
          Cancelar
        </button>
        <button onClick={handleSubmit as any} disabled={loading}
          className="flex-1 py-1.5 bg-yellow-400 text-gray-900 font-bold rounded-lg text-sm hover:bg-yellow-300 disabled:opacity-50">
          {loading ? 'Salvando...' : 'Confirmar'}
        </button>
      </div>
    </div>
  );
}
