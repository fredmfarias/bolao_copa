'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { RankingPodium } from '@/components/RankingPodium';
import { RankingRow } from '@/components/RankingRow';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { formatDataPublicacao } from '@/lib/dataFormat';
import type { Bolao, RankingEntry, PublicacaoResumo } from '@/types/api';

type Aba = 'geral' | 'rodada';

export default function RankingPage() {
  const { bolaoId } = useParams<{ bolaoId: string }>();
  const { user } = useAuth();
  const [aba, setAba] = useState<Aba>('geral');
  const [bolaoNome, setBolaoNome] = useState<string>('');
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [publicacoes, setPublicacoes] = useState<PublicacaoResumo[]>([]);
  const [publicacaoSel, setPublicacaoSel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const rankingGeralRef = useRef<RankingEntry[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<RankingEntry[]>(`/boloes/${bolaoId}/ranking`).catch(() => [] as RankingEntry[]),
      api.get<PublicacaoResumo[]>(`/boloes/${bolaoId}/ranking/publicacoes`).catch(() => [] as PublicacaoResumo[]),
      api.get<Bolao>(`/boloes/${bolaoId}`).catch(() => null),
    ]).then(([r, pubs, bolao]) => {
      rankingGeralRef.current = r;
      setRanking(r);
      setPublicacoes(pubs);
      setPublicacaoSel(pubs[0]?.numero ?? null);
      if (bolao) setBolaoNome(bolao.nome);
      setLoading(false);
    });
  }, [bolaoId]);

  useEffect(() => {
    if (aba === 'geral') {
      setRanking(rankingGeralRef.current);
      return;
    }
    if (publicacaoSel === null) return;
    api.get<RankingEntry[]>(`/boloes/${bolaoId}/ranking?publicacao=${publicacaoSel}`)
      .then(setRanking)
      .catch(() => setRanking([]));
  }, [publicacaoSel, bolaoId, aba]);

  const ordenadoRodada = useMemo(() => {
    if (aba !== 'rodada') return [];
    return [...ranking]
      .sort((a, b) => {
        if (b.pontuacaoRodada !== a.pontuacaoRodada) return b.pontuacaoRodada - a.pontuacaoRodada;
        if (b.pontuacaoTotal !== a.pontuacaoTotal) return b.pontuacaoTotal - a.pontuacaoTotal;
        return a.usuario.nome.localeCompare(b.usuario.nome);
      })
      .map((entry, idx) => ({ entry, posicaoRodada: idx + 1 }));
  }, [aba, ranking]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Ranking</h1>
          {bolaoNome && <p className="text-gray-400 text-sm mt-0.5">{bolaoNome}</p>}
        </div>
        <Link href="/ranking" className="text-trovao-muted text-sm hover:text-white shrink-0">← Voltar</Link>
      </div>

      {loading ? (
        <PageSkeleton />
      ) : ranking.length === 0 && publicacoes.length === 0 ? (
        <EmptyState
          titulo="Aguardando publicação"
          descricao="O ranking será publicado pelo administrador após os jogos."
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <button onClick={() => setAba('geral')}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  aba === 'geral' ? 'bg-trovao-gold text-trovao-base border-trovao-gold'
                    : 'bg-trovao-surface text-trovao-muted border-trovao-border'}`}>
                Geral
              </button>
              <button onClick={() => setAba('rodada')}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  aba === 'rodada' ? 'bg-trovao-gold text-trovao-base border-trovao-gold'
                    : 'bg-trovao-surface text-trovao-muted border-trovao-border'}`}>
                Rodada
              </button>
            </div>
            {aba === 'rodada' && publicacoes.length > 0 && (
              <div className="flex flex-col items-end gap-0.5">
                <select
                  value={publicacaoSel ?? ''}
                  onChange={(e) => setPublicacaoSel(Number(e.target.value))}
                  className="bg-trovao-surface border border-trovao-border rounded-lg text-sm px-2 py-1 text-white"
                >
                  {publicacoes.map((p) => (
                    <option key={p.numero} value={p.numero}>{formatDataPublicacao(p.publicadoEm)}</option>
                  ))}
                </select>
                <p className="text-trovao-muted text-[10px] leading-tight">
                  Data da publicação · pode diferir da data dos jogos
                </p>
              </div>
            )}
          </div>

          {aba === 'geral' && (
            <RankingPodium ranking={ranking} myId={user?.id} />
          )}

          {aba === 'rodada' && (
            <RankingPodium
              ranking={ordenadoRodada.map(({ entry }) => ({ ...entry, pontuacaoTotal: entry.pontuacaoRodada }))}
              myId={user?.id}
            />
          )}

          <div className="space-y-2 mt-4">
            {aba === 'geral'
              ? ranking.map((entry) => (
                  <RankingRow key={entry.id} entry={entry} myId={user?.id} bolaoId={bolaoId} />
                ))
              : ordenadoRodada.map(({ entry, posicaoRodada }) => (
                  <RankingRow
                    key={entry.id}
                    entry={{ ...entry, pontuacaoTotal: entry.pontuacaoRodada, posicoesGanhas: 0 }}
                    myId={user?.id}
                    bolaoId={bolaoId}
                    posicaoRodada={posicaoRodada}
                    publicacaoNumero={publicacaoSel ?? undefined}
                  />
                ))}
          </div>
        </>
      )}
    </div>
  );
}
