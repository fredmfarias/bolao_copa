'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { PageSkeleton } from '@/components/PageSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';
import { PalpiteRow } from '@/components/PalpiteRow';
import { PlacarFiltro } from '@/components/PlacarFiltro';
import { ordenarPorClassificacao, placarKey } from '@/lib/palpites';
import { MINUTOS_PRAZO_APOSTA, BOLAO_GLOBAL_ID } from '@bolao/shared';
import type { Bolao, Jogo, Palpite, RankingEntry } from '@/types/api';

function prazoEncerrado(dataHora: string): boolean {
  const prazo = new Date(new Date(dataHora).getTime() - MINUTOS_PRAZO_APOSTA * 60 * 1000);
  return new Date() >= prazo;
}

export default function PalpitesPage() {
  const { id: bolaoId, jogoId } = useParams<{ id: string; jogoId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [jogo, setJogo] = useState<Jogo | null>(null);
  const [palpites, setPalpites] = useState<Palpite[]>([]);
  const [boloes, setBoloes] = useState<Bolao[]>([]);
  const [loading, setLoading] = useState(true);
  const [prazoPassou, setPrazoPassou] = useState(false);
  const [posicoes, setPosicoes] = useState<Map<string, number>>(new Map());
  const [placarFiltro, setPlacarFiltro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Jogo>(`/jogos/${jogoId}`).catch(() => null),
      api.get<Bolao[]>('/boloes/meus').catch(() => [] as Bolao[]),
    ]).then(([j, bs]) => {
      setJogo(j);
      setBoloes(bs);
      setPlacarFiltro(null);
      if (j && prazoEncerrado(j.dataHora)) {
        setPrazoPassou(true);
        Promise.all([
          api.get<Palpite[]>(`/boloes/${bolaoId}/apostas?jogoId=${jogoId}`).catch(() => [] as Palpite[]),
          api.get<RankingEntry[]>(`/boloes/${bolaoId}/ranking`).catch(() => [] as RankingEntry[]),
        ]).then(([ps, ranking]) => {
          setPalpites(ps);
          setPosicoes(new Map(ranking.map((r) => [r.usuarioId, r.posicao])));
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
  }, [bolaoId, jogoId]);

  if (loading) return <PageSkeleton />;
  if (!jogo) return <EmptyState titulo="Jogo não encontrado" />;

  const boloesPrivados = boloes.filter(b => b.id !== BOLAO_GLOBAL_ID);
  const temMultiplosBoloesPrivados = boloesPrivados.length > 1;

  function navegarBolao(novoBolaoId: string) {
    router.push(`/boloes/${novoBolaoId}/palpites/${jogoId}`);
  }

  const ordenados = ordenarPorClassificacao(palpites, posicoes);
  const visiveis = placarFiltro === null
    ? ordenados
    : ordenados.filter(({ palpite }) => placarKey(palpite) === placarFiltro);

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/boloes/${bolaoId}`} className="text-trovao-muted text-sm hover:text-white">
          ← Voltar
        </Link>
      </div>

      {/* Cabeçalho do jogo */}
      <div className="text-center">
        <p className="text-trovao-muted text-xs mb-2">{jogo.fase} · Rodada {jogo.rodada}</p>
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <SelecaoAvatar nome={jogo.selecaoCasa.nome} bandeiraSvg={jogo.selecaoCasa.bandeiraSvg} size="sm" shape="rect" />
            <span className="text-lg font-bold text-white">{jogo.selecaoCasa.codigo}</span>
          </div>
          <span className="text-trovao-muted text-sm">×</span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">{jogo.selecaoVisitante.codigo}</span>
            <SelecaoAvatar nome={jogo.selecaoVisitante.nome} bandeiraSvg={jogo.selecaoVisitante.bandeiraSvg} size="sm" shape="rect" />
          </div>
        </div>
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
        <div className="space-y-3">
          <PlacarFiltro palpites={palpites} value={placarFiltro} onChange={setPlacarFiltro} />
          <div className="space-y-2">
            <p className="text-trovao-muted text-xs px-1">{visiveis.length} palpites</p>
            {visiveis.map(({ palpite, posicao }) => (
              <PalpiteRow
                key={palpite.usuarioId}
                palpite={palpite}
                jogo={jogo}
                posicao={posicao}
                isMe={palpite.usuarioId === user?.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
