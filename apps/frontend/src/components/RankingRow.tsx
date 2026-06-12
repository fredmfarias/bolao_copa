'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { RankingEntry, EvolucaoPonto, RodadaPalpiteItem } from '@/types/api';
import { api } from '@/lib/api';
import { MEDALHAS } from '@/lib/medalhas';
import { RankingEvolucao } from './RankingEvolucao';
import { RankingPalpitesRodada } from './RankingPalpitesRodada';

interface RankingRowProps {
  entry: RankingEntry;
  myId?: string;
  bolaoId: string;
  posicaoRodada?: number;
  publicacaoNumero?: number;
}

const ACERTOS = [
  { label: 'Placar exato',                       key: 'acertosPlacarExato'    },
  { label: 'Placar do vencedor correto',         key: 'acertosPlacarVencedor' },
  { label: 'Empate correto (sem placar exato)',  key: 'acertosEmpate'         },
  { label: 'Placar do perdedor correto',         key: 'acertosPlacarPerdedor' },
  { label: 'Acertou apenas o vencedor',          key: 'acertosGanhador'       },
  { label: 'Acertou nada',                       key: 'acertosNada'           },
] as const;

export function RankingRow({ entry, myId, bolaoId, posicaoRodada, publicacaoNumero }: RankingRowProps) {
  const [expandido, setExpandido] = useState(false);
  const [evolucao, setEvolucao] = useState<EvolucaoPonto[] | null>(null);
  const [palpites, setPalpites] = useState<RodadaPalpiteItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const isMe = entry.usuarioId === myId;
  const modoRodada = publicacaoNumero !== undefined;
  const posicaoExibida = posicaoRodada ?? entry.posicao;
  const medalha = MEDALHAS[posicaoExibida];

  const handleExpand = () => {
    const abrir = !expandido;
    setExpandido(abrir);
    if (!abrir) return;

    if (modoRodada && palpites === null) {
      setLoading(true);
      api.get<RodadaPalpiteItem[]>(
        `/boloes/${bolaoId}/ranking/publicacoes/${publicacaoNumero}/usuarios/${entry.usuarioId}/apostas`,
      )
        .then(setPalpites)
        .catch(() => setPalpites([]))
        .finally(() => setLoading(false));
      return;
    }

    if (!modoRodada && evolucao === null) {
      setLoading(true);
      api.get<EvolucaoPonto[]>(`/boloes/${bolaoId}/ranking/evolucao?usuarioId=${entry.usuarioId}`)
        .then(setEvolucao)
        .catch(() => setEvolucao([]))
        .finally(() => setLoading(false));
    }
  };

  return (
    <div className={`rounded-xl border bg-trovao-card transition-colors ${
      medalha ? medalha.border : 'border-trovao-border'
    } ${isMe ? 'ring-2 ring-trovao-gold/60' : ''}`}>
      <button onClick={handleExpand} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <span className={`text-sm w-7 flex-shrink-0 ${
          medalha ? `${medalha.texto} font-bold` : 'text-trovao-muted'
        }`}>
          {posicaoExibida}º
        </span>
        {posicaoRodada !== undefined && (
          <span className="text-trovao-muted text-[10px] flex-shrink-0">(P {entry.posicao}º)</span>
        )}

        {entry.usuario.avatarUrl ? (
          <img src={entry.usuario.avatarUrl} alt={entry.usuario.nome}
            className="w-8 h-8 rounded-full flex-shrink-0" />
        ) : (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
            ${isMe ? 'bg-trovao-gold text-trovao-base' : 'bg-trovao-surface text-trovao-muted'}`}>
            {entry.usuario.nome.charAt(0).toUpperCase()}
          </div>
        )}

        <span className={`flex-1 text-sm font-semibold truncate ${isMe ? 'text-trovao-gold' : 'text-white'}`}>
          {entry.usuario.nome}
        </span>

        {entry.posicoesGanhas !== 0 && (
          <span className={`text-xs font-semibold tabular-nums ${
            entry.posicoesGanhas > 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {entry.posicoesGanhas > 0 ? '▲' : '▼'}{Math.abs(entry.posicoesGanhas)}
          </span>
        )}

        <span className={`text-sm font-bold tabular-nums ${isMe ? 'text-trovao-gold' : 'text-white'}`}>
          {entry.pontuacaoTotal}
        </span>

        <span className="text-trovao-muted text-xs ml-1">{expandido ? '▲' : '▼'}</span>
      </button>

      {expandido && (
        <div className="px-4 pb-3 border-t border-trovao-border/50 pt-3 space-y-3">
          {modoRodada ? (
            <>
              {loading && <p className="text-trovao-muted text-xs text-center py-2">Carregando palpites...</p>}
              {!loading && palpites && <RankingPalpitesRodada items={palpites} />}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {ACERTOS.map(({ label, key }) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-trovao-muted">{label}</span>
                    <span className="text-white font-semibold tabular-nums">{entry[key]}</span>
                  </div>
                ))}
              </div>
              {loading && <p className="text-trovao-muted text-xs text-center py-2">Carregando evolução...</p>}
              {!loading && evolucao && evolucao.length > 0 && <RankingEvolucao dados={evolucao} />}
              <div className="flex items-center justify-between pt-1">
                <span className="text-trovao-muted text-xs">
                  Apostas realizadas:{' '}
                  <span className="text-white font-semibold tabular-nums">{entry.apostasPostadas}</span>
                </span>
                <Link
                  href={`/ranking/${bolaoId}/usuarios/${entry.usuarioId}/palpites`}
                  className="text-trovao-gold text-xs font-medium hover:underline"
                >
                  Ver palpites →
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
