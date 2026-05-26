'use client';

import { useState } from 'react';
import type { RankingEntry, EvolucaoPonto } from '@/types/api';
import { api } from '@/lib/api';
import { RankingEvolucao } from './RankingEvolucao';

interface RankingRowProps {
  entry: RankingEntry;
  myId?: string;
  bolaoId: string;
}

const ACERTOS = [
  { label: 'Placar exato',                      key: 'acertosPlacarExato'    },
  { label: 'Placar do vencedor correto',         key: 'acertosPlacarVencedor' },
  { label: 'Empate correto (sem placar exato)',  key: 'acertosEmpate'         },
  { label: 'Placar do perdedor correto',         key: 'acertosPlacarPerdedor' },
  { label: 'Acertou apenas o vencedor',          key: 'acertosGanhador'       },
  { label: 'Apostas feitas',                     key: 'apostasPostadas'       },
] as const;

export function RankingRow({ entry, myId, bolaoId }: RankingRowProps) {
  const [expandido, setExpandido] = useState(false);
  const [evolucao, setEvolucao] = useState<EvolucaoPonto[] | null>(null);
  const [loadingEv, setLoadingEv] = useState(false);
  const isMe = entry.usuarioId === myId;

  const handleExpand = () => {
    const abrir = !expandido;
    setExpandido(abrir);
    if (abrir && evolucao === null) {
      setLoadingEv(true);
      api.get<EvolucaoPonto[]>(`/boloes/${bolaoId}/ranking/evolucao?usuarioId=${entry.usuarioId}`)
        .then(setEvolucao)
        .catch(() => setEvolucao([]))
        .finally(() => setLoadingEv(false));
    }
  };

  return (
    <div className={`rounded-xl border transition-colors ${
      isMe ? 'border-trovao-gold/50 bg-trovao-gold/5' : 'border-trovao-border bg-trovao-card'
    }`}>
      <button
        onClick={handleExpand}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-trovao-muted text-sm w-7 flex-shrink-0">{entry.posicao}º</span>

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
          <div className="grid grid-cols-2 gap-2">
            {ACERTOS.map(({ label, key }) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="text-trovao-muted">{label}</span>
                <span className="text-white font-semibold tabular-nums">{entry[key]}</span>
              </div>
            ))}
          </div>

          {loadingEv && (
            <p className="text-trovao-muted text-xs text-center py-2">Carregando evolução...</p>
          )}
          {!loadingEv && evolucao && evolucao.length > 0 && (
            <RankingEvolucao dados={evolucao} />
          )}
        </div>
      )}
    </div>
  );
}
