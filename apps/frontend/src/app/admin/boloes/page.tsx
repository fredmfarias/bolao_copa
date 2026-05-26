'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import type { AdminBolao } from '@/types/api';

export default function AdminBoloesPage() {
  const [boloes, setBoloes] = useState<AdminBolao[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    const data = await api.get<AdminBolao[]>('/admin/boloes').catch(() => [] as AdminBolao[]);
    setBoloes(data);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function alternar(b: AdminBolao) {
    const novo = b.status === 'PAGO' ? 'ATIVO' : 'PAGO';
    await api.patch(`/boloes/${b.id}/status`, { status: novo }).catch(() => {});
    carregar();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Bolões</h1>
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
                  b.status === 'PAGO'
                    ? 'bg-trovao-green/10 text-trovao-green border-trovao-green/40'
                    : 'bg-trovao-surface text-trovao-muted border-trovao-border hover:border-trovao-gold'}`}>
                {b.status === 'PAGO' ? 'Habilitado' : 'Habilitar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
