'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { BolaoMembro } from '@/types/api';

interface ModeradorPanelProps {
  bolaoId: string;
  membros: BolaoMembro[];
  onAtualizado: () => void;
}

const MEMBROS_INICIAIS = 3;
const MEMBROS_PASSO = 10;

export function ModeradorPanel({ bolaoId, membros, onAtualizado }: ModeradorPanelProps) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const [visiveis, setVisiveis] = useState(MEMBROS_INICIAIS);

  async function acao(path: string, memberId: string) {
    setAtivo(memberId);
    try {
      await api.post(path);
      onAtualizado();
    } finally {
      setAtivo(null);
    }
  }

  async function alternarPagamento(m: BolaoMembro) {
    const novoStatus = m.statusPagamento === 'PENDENTE' ? 'PAGO' : 'PENDENTE';
    setAtivo(`pag-${m.usuarioId}`);
    try {
      await api.patch(`/boloes/${bolaoId}/membros/${m.usuarioId}/pagamento`, { status: novoStatus });
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
        <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 bg-trovao-card border border-trovao-border rounded-xl">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {m.usuario.avatarUrl ? (
              <img src={m.usuario.avatarUrl} alt={m.usuario.nome} className="w-8 h-8 rounded-full flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-trovao-surface flex items-center justify-center text-xs font-bold text-trovao-muted flex-shrink-0">
                {m.usuario.nome.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-white text-sm truncate">{m.usuario.nome}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {m.papel === 'MODERADOR' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-trovao-gold/20 text-trovao-gold">
                Mod
              </span>
            )}

            <button
              disabled={ativo === `pag-${m.usuarioId}`}
              onClick={() => alternarPagamento(m)}
              className={`text-xs px-2 py-0.5 rounded-full transition-opacity disabled:opacity-50 ${
                m.statusPagamento === 'PAGO'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}
            >
              {m.statusPagamento === 'PAGO' ? 'Pago' : 'Pendente'}
            </button>

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
        <button onClick={() => setVisiveis(v => v + MEMBROS_PASSO)}
          className="w-full text-xs text-trovao-muted hover:text-white transition-colors py-1">
          mais {restante}...
        </button>
      )}
      {visiveis > MEMBROS_INICIAIS && restante <= 0 && (
        <button onClick={() => setVisiveis(MEMBROS_INICIAIS)}
          className="w-full text-xs text-trovao-muted hover:text-white transition-colors py-1">
          ocultar
        </button>
      )}
    </div>
  );
}
