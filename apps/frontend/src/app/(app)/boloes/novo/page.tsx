'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Bolao } from '@/types/api';
import { BolaoEscopo } from '@bolao/shared';

export default function NovoBolaoPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: '', descricao: '', escopo: BolaoEscopo.AMBOS, maxParticipantes: 10,
  });
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  function set(k: string, v: any) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const b = await api.post<Bolao>('/boloes', form);
      router.push(`/boloes/${b.id}`);
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold mb-6">Criar bolão</h1>
      {erro && <p className="text-red-400 text-sm mb-4">{erro}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Nome</label>
          <input value={form.nome} onChange={e => set('nome', e.target.value)} required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Descrição (opcional)</label>
          <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Escopo</label>
          <select value={form.escopo} onChange={e => set('escopo', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white">
            {Object.values(BolaoEscopo).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Máx. participantes (múltiplo de 10)
          </label>
          <input type="number" min={10} step={10} value={form.maxParticipantes}
            onChange={e => set('maxParticipantes', Number(e.target.value))} required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
          <p className="text-xs text-gray-500 mt-1">Preço: R$ {form.maxParticipantes},00</p>
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-yellow-400 text-gray-900 font-bold py-2 rounded-lg hover:bg-yellow-300 disabled:opacity-50">
          {loading ? 'Criando...' : 'Criar bolão'}
        </button>
      </form>
    </div>
  );
}
