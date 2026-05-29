'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { Jogo } from '@/types/api';

interface AdminPlacardCardProps {
  jogo: Jogo;
  onSalvo: () => void;
}

export function AdminPlacardCard({ jogo, onSalvo }: AdminPlacardCardProps) {
  const publicado = jogo.placarCasa !== null;
  const [casa, setCasa] = useState<number | null>(jogo.placarCasa);
  const [visitante, setVisitante] = useState<number | null>(jogo.placarVisitante);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const podeSalvar = casa !== null && visitante !== null;

  async function salvar() {
    if (!podeSalvar) return;
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

  function stepper(value: number | null, onChange: (v: number | null) => void) {
    const incrementar = () => onChange(value === null ? 0 : value + 1);
    const decrementar = () => {
      if (value === null) return;
      onChange(value === 0 ? null : value - 1);
    };
    return (
      <div className="flex flex-col items-center gap-1">
        <button onClick={incrementar} aria-label="+"
          className="w-9 h-9 bg-trovao-surface rounded-lg text-trovao-gold text-lg font-bold hover:bg-trovao-border">+</button>
        <span className="text-white text-xl font-bold tabular-nums w-9 text-center">
          {value === null ? '-' : value}
        </span>
        <button onClick={decrementar} aria-label="−"
          className="w-9 h-9 bg-trovao-surface rounded-lg text-trovao-muted text-lg hover:bg-trovao-border">−</button>
      </div>
    );
  }

  return (
    <div className={`bg-trovao-card border rounded-xl p-4 space-y-3 ${publicado ? 'border-trovao-green' : 'border-trovao-border'}`}>
      <div className="flex items-center justify-center gap-2">
        <span className="text-xs text-trovao-muted">
          {jogo.fase}{jogo.grupo ? ` · Grupo ${jogo.grupo}` : ''} · R{jogo.rodada}
        </span>
        {publicado && (
          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-trovao-green/10 text-trovao-green border border-trovao-green/40">
            Publicado
          </span>
        )}
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

      <button onClick={salvar} disabled={salvando || !podeSalvar}
        className="w-full py-2 bg-trovao-gold text-trovao-base font-bold rounded-lg text-sm disabled:opacity-50">
        {salvando ? 'Salvando...' : publicado ? 'Atualizar Placar' : 'Salvar Placar'}
      </button>
    </div>
  );
}
