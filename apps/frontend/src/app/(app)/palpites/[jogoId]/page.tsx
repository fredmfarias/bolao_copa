'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { BOLAO_GLOBAL_ID } from '@bolao/shared';
import type { Jogo } from '@/types/api';

interface Palpite {
  usuarioId: string;
  nome: string;
  avatarUrl: string | null;
  placarCasa: number;
  placarVisitante: number;
  pontuacao: number | null;
}

export default function PalpitesPage() {
  const { jogoId } = useParams<{ jogoId: string }>();
  const [jogo, setJogo] = useState<Jogo | null>(null);
  const [palpites, setPalpites] = useState<Palpite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Jogo>(`/jogos/${jogoId}`).catch(() => null),
      api.get<Palpite[]>(`/boloes/${BOLAO_GLOBAL_ID}/apostas?jogoId=${jogoId}`).catch(() => [] as Palpite[]),
    ]).then(([j, ps]) => {
      setJogo(j);
      setPalpites(ps);
      setLoading(false);
    });
  }, [jogoId]);

  if (loading) return <PageSkeleton />;
  if (!jogo) return <EmptyState titulo="Jogo não encontrado" />;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-trovao-muted text-xs mb-1">{jogo.fase} · Rodada {jogo.rodada}</p>
        <h1 className="text-lg font-bold text-white">
          {jogo.selecaoCasa.codigo} × {jogo.selecaoVisitante.codigo}
        </h1>
        {jogo.placarCasa !== null && (
          <p className="text-trovao-gold font-mono text-2xl font-bold mt-1">
            {jogo.placarCasa} : {jogo.placarVisitante}
          </p>
        )}
      </div>

      {palpites.length === 0 ? (
        <EmptyState titulo="Nenhum palpite" descricao="Ninguém apostou neste jogo ainda." />
      ) : (
        <div className="space-y-2">
          <p className="text-trovao-muted text-xs px-1">{palpites.length} palpites</p>
          {palpites.map(p => (
            <div key={p.usuarioId}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-trovao-card border border-trovao-border">
              <div className="flex items-center gap-2">
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt={p.nome} className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-trovao-surface flex items-center justify-center text-xs font-bold text-trovao-muted">
                    {p.nome.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-white text-sm font-medium">{p.nome}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white font-mono text-sm font-semibold">
                  {p.placarCasa} × {p.placarVisitante}
                </span>
                {p.pontuacao !== null && (
                  <span className="text-trovao-gold text-sm font-bold tabular-nums">
                    +{p.pontuacao}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
