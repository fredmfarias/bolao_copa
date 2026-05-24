'use client';

import { useState } from 'react';
import type { RankingEntry } from '@/types/api';

interface RankingRowProps {
  entry: RankingEntry;
  myId?: string;
}

export function RankingRow({ entry, myId }: RankingRowProps) {
  const [expandido, setExpandido] = useState(false);
  const isMe = entry.usuarioId === myId;

  return (
    <div className={`rounded-xl border transition-colors ${
      isMe ? 'border-trovao-gold/50 bg-trovao-gold/5' : 'border-trovao-border bg-trovao-card'
    }`}>
      <button
        onClick={() => setExpandido(v => !v)}
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

        <span className={`text-sm font-bold tabular-nums ${isMe ? 'text-trovao-gold' : 'text-white'}`}>
          {entry.pontuacaoTotal}
        </span>

        <span className="text-trovao-muted text-xs ml-1">{expandido ? '▲' : '▼'}</span>
      </button>

      {expandido && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-2 border-t border-trovao-border/50 pt-3">
          {[
            { label: 'Placar exato',   valor: entry.acertosPlacarExato },
            { label: 'Vencedor',       valor: entry.acertosPlacarVencedor },
            { label: 'Empate',         valor: entry.acertosEmpate },
            { label: 'Apostas feitas', valor: entry.apostasPostadas },
          ].map(({ label, valor }) => (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-trovao-muted">{label}</span>
              <span className="text-white font-semibold tabular-nums">{valor}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
