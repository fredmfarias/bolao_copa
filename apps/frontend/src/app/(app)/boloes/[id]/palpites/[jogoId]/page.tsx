'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { MINUTOS_PRAZO_APOSTA, BOLAO_GLOBAL_ID } from '@bolao/shared';
import type { Bolao, Jogo } from '@/types/api';

interface Palpite {
  usuarioId: string;
  nome: string;
  avatarUrl: string | null;
  placarCasa: number;
  placarVisitante: number;
  pontuacao: number | null;
}

function prazoEncerrado(dataHora: string): boolean {
  const prazo = new Date(new Date(dataHora).getTime() - MINUTOS_PRAZO_APOSTA * 60 * 1000);
  return new Date() >= prazo;
}

export default function PalpitesPage() {
  const { id: bolaoId, jogoId } = useParams<{ id: string; jogoId: string }>();
  const router = useRouter();
  const [jogo, setJogo] = useState<Jogo | null>(null);
  const [palpites, setPalpites] = useState<Palpite[]>([]);
  const [boloes, setBoloes] = useState<Bolao[]>([]);
  const [loading, setLoading] = useState(true);
  const [prazoPassou, setPrazoPassou] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Jogo>(`/jogos/${jogoId}`).catch(() => null),
      api.get<Bolao[]>('/boloes/meus').catch(() => [] as Bolao[]),
    ]).then(([j, bs]) => {
      setJogo(j);
      setBoloes(bs);
      if (j && prazoEncerrado(j.dataHora)) {
        setPrazoPassou(true);
        api.get<Palpite[]>(`/boloes/${bolaoId}/apostas?jogoId=${jogoId}`)
          .then(setPalpites)
          .catch(() => setPalpites([]));
      }
      setLoading(false);
    });
  }, [bolaoId, jogoId]);

  if (loading) return <PageSkeleton />;
  if (!jogo) return <EmptyState titulo="Jogo não encontrado" />;

  const boloesPrivados = boloes.filter(b => b.id !== BOLAO_GLOBAL_ID);
  const temMultiplosBoloesPrivados = boloesPrivados.length > 1;

  function navegarBolao(novoBolaoId: string) {
    router.push(`/boloes/${novoBolaoId}/palpites/${jogoId}`);
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/boloes/${bolaoId}`} className="text-trovao-muted text-sm hover:text-white">
          ← Voltar
        </Link>
      </div>

      {/* Cabeçalho do jogo */}
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

      {/* Seletor de bolão */}
      {(temMultiplosBoloesPrivados || boloesPrivados.length === 0) && (
        <div className="flex gap-2 flex-wrap">
          {boloesPrivados.map(b => (
            <button
              key={b.id}
              onClick={() => navegarBolao(b.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                b.id === bolaoId
                  ? 'bg-trovao-gold text-trovao-base border-trovao-gold'
                  : 'bg-trovao-surface text-trovao-muted border-trovao-border hover:border-trovao-gold'
              }`}
            >
              {b.nome}
            </button>
          ))}
          <button
            onClick={() => navegarBolao(BOLAO_GLOBAL_ID)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              bolaoId === BOLAO_GLOBAL_ID
                ? 'bg-trovao-gold text-trovao-base border-trovao-gold'
                : 'bg-trovao-surface text-trovao-muted border-trovao-border hover:border-trovao-gold'
            }`}
          >
            Global
          </button>
        </div>
      )}

      {/* Conteúdo dos palpites */}
      {!prazoPassou ? (
        <div className="text-center py-8">
          <p className="text-trovao-muted text-sm">
            Os palpites serão revelados quando as apostas encerrarem.
          </p>
        </div>
      ) : palpites.length === 0 ? (
        <EmptyState titulo="Nenhum palpite" descricao="Nenhum membro apostou neste jogo." />
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
