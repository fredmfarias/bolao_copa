'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface ConvitePanelProps {
  bolaoId: string;
}

export function ConvitePanel({ bolaoId }: ConvitePanelProps) {
  const [token, setToken] = useState('');
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState('');

  const link = token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/convite/${token}` : '';

  async function gerarConvite() {
    setGerando(true);
    setErro('');
    try {
      const data = await api.post<{ token: string }>(`/boloes/${bolaoId}/convite`);
      setToken(data.token);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao gerar convite.');
    } finally {
      setGerando(false);
    }
  }

  async function copiarLink() {
    await navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="bg-trovao-card border border-trovao-border rounded-xl p-4 space-y-3">
      <p className="text-white text-sm font-semibold">Convidar membros</p>

      {!token ? (
        <>
          {erro && <p className="text-trovao-red text-xs">{erro}</p>}
          <button onClick={gerarConvite} disabled={gerando}
            className="w-full py-2 bg-trovao-gold text-trovao-base text-sm font-bold rounded-lg disabled:opacity-50">
            {gerando ? 'Gerando...' : 'Gerar link de convite'}
          </button>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-trovao-muted text-xs break-all bg-trovao-surface rounded-lg px-3 py-2">
            {link}
          </p>
          <button onClick={copiarLink}
            className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
              copiado
                ? 'bg-trovao-green text-trovao-base'
                : 'border border-trovao-border text-trovao-muted hover:text-white'
            }`}>
            {copiado ? 'Copiado!' : 'Copiar link'}
          </button>
        </div>
      )}
    </div>
  );
}
