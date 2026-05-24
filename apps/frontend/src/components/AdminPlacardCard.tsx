'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { Jogo } from '@/types/api';

interface AdminPlacardCardProps {
  jogo: Jogo;
  onSalvo: () => void;
}

export function AdminPlacardCard({ jogo, onSalvo }: AdminPlacardCardProps) {
  const [casa, setCasa] = useState(jogo.placarCasa ?? 0);
  const [visitante, setVisitante] = useState(jogo.placarVisitante ?? 0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      await api.patch(`/jogos/${jogo.id}/placar`, { placarCasa: casa, placarVisitante: visitante });
      onSalvo();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  function stepper(value: number, onChange: (v: number) => void) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button onClick={() => onChange(value + 1)} aria-label="+"
          className="w-9 h-9 bg-trovao-surface rounded-lg text-trovao-gold text-lg font-bold hover:bg-trovao-border">+</button>
        <span className="text-white text-xl font-bold tabular-nums w-9 text-center">{value}</span>
        <button onClick={() => onChange(Math.max(0, value - 1))} aria-label="−"
          className="w-9 h-9 bg-trovao-surface rounded-lg text-trovao-muted text-lg hover:bg-trovao-border">−</button>
      </div>
    );
  }

  return (
    <div className="bg-trovao-card border border-trovao-border rounded-xl p-4 space-y-3">
      <div className="text-xs text-trovao-muted text-center">
        {jogo.fase}{jogo.grupo ? ` · Grupo ${jogo.grupo}` : ''} · R{jogo.rodada}
      </div>

      <div className="flex items-center justify-center gap-4">
        <p className="text-white text-sm font-semibold w-16 text-right">{jogo.selecaoCasa.codigo}</p>
        <div className="flex items-center gap-3">
          {stepper(casa, setCasa)}
          <span className="text-trovao-muted text-lg">×</span>
          {stepper(visitante, setVisitante)}
        </div>
        <p className="text-white text-sm font-semibold w-16">{jogo.selecaoVisitante.codigo}</p>
      </div>

      {erro && <p className="text-trovao-red text-xs text-center">{erro}</p>}

      <button onClick={salvar} disabled={salvando}
        className="w-full py-2 bg-trovao-gold text-trovao-base font-bold rounded-lg text-sm disabled:opacity-50">
        {salvando ? 'Salvando...' : 'Salvar Placar'}
      </button>
    </div>
  );
}
