'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AdminRankingPreview } from '@/components/AdminRankingPreview';
import { PageSkeleton } from '@/components/PageSkeleton';
import type { AdminBolao } from '@/types/api';

export default function AdminRankingPage() {
  const [boloes, setBoloes] = useState<AdminBolao[]>([]);
  const [bolaoSel, setBolaoSel] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AdminBolao[]>('/admin/boloes')
      .then((data) => {
        setBoloes(data);
        setBolaoSel(data[0]?.id ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Ranking — Draft</h1>
      <p className="text-trovao-muted text-xs">
        Pré-visualize o draft por bolão. Publicar fecha a rodada para todos os bolões habilitados.
      </p>

      {loading ? (
        <PageSkeleton />
      ) : (
        <>
          {boloes.length > 0 && (
            <select value={bolaoSel} onChange={(e) => setBolaoSel(e.target.value)}
              className="bg-trovao-surface border border-trovao-border rounded-lg text-sm px-2 py-1 text-white">
              {boloes.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          )}
          {bolaoSel && <AdminRankingPreview key={bolaoSel} bolaoId={bolaoSel} />}
        </>
      )}
    </div>
  );
}
