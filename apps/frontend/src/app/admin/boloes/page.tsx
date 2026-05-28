'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { UserSearchInput } from '@/components/UserSearchInput';
import { BolaoEscopo } from '@bolao/shared';
import type { AdminBolao } from '@/types/api';

export default function AdminBoloesPage() {
  const [boloes, setBoloes] = useState<AdminBolao[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({
    nome: '', descricao: '', escopo: BolaoEscopo.AMBOS, maxParticipantes: 10,
  });
  const [moderador, setModerador] = useState<{ id: string; nome: string } | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setLoading(true);
    const data = await api.get<AdminBolao[]>('/admin/boloes').catch(() => [] as AdminBolao[]);
    setBoloes(data);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  function set(k: string, v: unknown) { setForm(p => ({ ...p, [k]: v })); }

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    if (!moderador) { setErro('Selecione um moderador.'); return; }
    setErro('');
    setSalvando(true);
    try {
      await api.post('/boloes', { ...form, moderadorId: moderador.id });
      setCriando(false);
      setForm({ nome: '', descricao: '', escopo: BolaoEscopo.AMBOS, maxParticipantes: 10 });
      setModerador(null);
      carregar();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar bolão.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(b: AdminBolao) {
    const novo = b.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    await api.patch(`/boloes/${b.id}/status`, { status: novo }).catch(() => {});
    carregar();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Bolões</h1>
        <button
          onClick={() => {
            setCriando(v => !v);
            setErro('');
            setForm({ nome: '', descricao: '', escopo: BolaoEscopo.AMBOS, maxParticipantes: 10 });
            setModerador(null);
          }}
          className="bg-yellow-400 text-gray-900 font-bold px-4 py-2 rounded-lg text-sm hover:bg-yellow-300">
          {criando ? 'Cancelar' : '+ Criar bolão'}
        </button>
      </div>

      {criando && (
        <form onSubmit={handleCriar}
          className="bg-trovao-card border border-trovao-border rounded-xl p-4 space-y-3">
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Nome</label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)} required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Descrição (opcional)</label>
            <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Escopo</label>
            <select value={form.escopo} onChange={e => set('escopo', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
              {Object.values(BolaoEscopo).map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Máx. participantes (múltiplo de 10)</label>
            <input type="number" min={10} step={10} value={form.maxParticipantes}
              onChange={e => set('maxParticipantes', Number(e.target.value))} required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Moderador</label>
            <UserSearchInput value={moderador} onChange={setModerador} />
          </div>
          <button type="submit" disabled={salvando}
            className="w-full bg-yellow-400 text-gray-900 font-bold py-2 rounded-lg text-sm hover:bg-yellow-300 disabled:opacity-50">
            {salvando ? 'Criando...' : 'Criar bolão'}
          </button>
        </form>
      )}

      {loading ? <PageSkeleton /> : boloes.length === 0 ? (
        <EmptyState titulo="Nenhum bolão" />
      ) : (
        <div className="space-y-2">
          {boloes.map((b) => (
            <div key={b.id}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-trovao-card border border-trovao-border">
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold truncate">{b.nome}</p>
                <p className="text-trovao-muted text-xs">
                  {b._count.membros} membros · R$ {b.precoReais}
                </p>
              </div>
              <button onClick={() => alternar(b)}
                className={`px-3 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${
                  b.status === 'ATIVO'
                    ? 'bg-trovao-green/10 text-trovao-green border-trovao-green/40'
                    : 'bg-trovao-surface text-trovao-muted border-trovao-border hover:border-trovao-gold'}`}>
                {b.status === 'ATIVO' ? 'Ativo' : 'Inativo'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
