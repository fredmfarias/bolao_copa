'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageSkeleton } from '@/components/PageSkeleton';
import { UsuarioPalpitesRodadas } from '@/components/UsuarioPalpitesRodadas';
import type { RankingEntry, UsuarioPalpitesRodada } from '@/types/api';

export default function UsuarioPalpitesPage() {
  const { bolaoId, usuarioId } = useParams<{ bolaoId: string; usuarioId: string }>();
  const [nome, setNome] = useState('');
  const [grupos, setGrupos] = useState<UsuarioPalpitesRodada[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<RankingEntry[]>(`/boloes/${bolaoId}/ranking`).catch(() => [] as RankingEntry[]),
      api
        .get<UsuarioPalpitesRodada[]>(`/boloes/${bolaoId}/ranking/usuarios/${usuarioId}/apostas`)
        .catch(() => [] as UsuarioPalpitesRodada[]),
    ]).then(([ranking, gs]) => {
      const entry = ranking.find((r) => r.usuarioId === usuarioId);
      setNome(entry?.usuario.nome ?? '');
      setGrupos(gs);
      setLoading(false);
    });
  }, [bolaoId, usuarioId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Palpites</h1>
          {nome && <p className="text-gray-400 text-sm mt-0.5">{nome}</p>}
        </div>
        <Link href={`/ranking/${bolaoId}`} className="text-trovao-muted text-sm hover:text-white shrink-0">
          ← Voltar
        </Link>
      </div>

      {loading ? <PageSkeleton /> : <UsuarioPalpitesRodadas grupos={grupos} />}
    </div>
  );
}
