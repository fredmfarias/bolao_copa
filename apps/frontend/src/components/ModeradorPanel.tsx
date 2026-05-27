'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { BolaoMembro } from '@/types/api';

interface ModeradorPanelProps {
  bolaoId: string;
  membros: BolaoMembro[];
  onAtualizado: () => void;
}

export function ModeradorPanel({ bolaoId, membros, onAtualizado }: ModeradorPanelProps) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const [visiveis, setVisiveis] = useState(5);

  async function acao(path: string, memberId: string) {
    setAtivo(memberId);
    try {
      await api.post(path);
      onAtualizado();
    } finally {
      setAtivo(null);
    }
  }

  const restante = membros.length - visiveis;

  return (
    <div className="space-y-2">
      <p className="text-trovao-muted text-xs font-semibold uppercase tracking-wider px-1">Membros</p>
      {membros.slice(0, visiveis).map(m => (
        <div key={m.id} className="flex items-center gap-3 px-4 py-3 bg-trovao-card border border-trovao-border rounded-xl">
          {m.usuario.avatarUrl ? (
            <img src={m.usuario.avatarUrl} alt={m.usuario.nome} className="w-8 h-8 rounded-full flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-trovao-surface flex items-center justify-center text-xs font-bold text-trovao-muted flex-shrink-0">
              {m.usuario.nome.charAt(0).toUpperCase()}
            </div>
          )}

          <span className="flex-1 text-white text-sm">{m.usuario.nome}</span>

          <span className={`text-xs px-2 py-0.5 rounded-full ${
            m.papel === 'MODERADOR' ? 'bg-trovao-gold/20 text-trovao-gold' : 'bg-trovao-surface text-trovao-muted'
          }`}>
            {m.papel === 'MODERADOR' ? 'Mod' : 'Membro'}
          </span>

          <div className="flex gap-1">
            {m.papel === 'PARTICIPANTE' && (
              <button disabled={ativo === m.usuarioId}
                onClick={() => acao(`/boloes/${bolaoId}/eleger/${m.usuarioId}`, m.usuarioId)}
                className="text-[10px] px-2 py-1 rounded border border-trovao-border text-trovao-muted hover:text-trovao-gold hover:border-trovao-gold disabled:opacity-40 transition-colors">
                → Mod
              </button>
            )}
            <button disabled={ativo === m.usuarioId}
              onClick={() => acao(`/boloes/${bolaoId}/remover/${m.usuarioId}`, m.usuarioId)}
              className="text-[10px] px-2 py-1 rounded border border-trovao-border text-trovao-muted hover:text-trovao-red hover:border-trovao-red disabled:opacity-40 transition-colors">
              Remover
            </button>
          </div>
        </div>
      ))}
      {restante > 0 && (
        <button onClick={() => setVisiveis(v => v + 10)}
          className="w-full text-xs text-trovao-muted hover:text-white transition-colors py-1">
          mais {restante}...
        </button>
      )}
      {visiveis > 5 && restante <= 0 && (
        <button onClick={() => setVisiveis(5)}
          className="w-full text-xs text-trovao-muted hover:text-white transition-colors py-1">
          ocultar
        </button>
      )}
    </div>
  );
}
