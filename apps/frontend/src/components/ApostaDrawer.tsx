'use client';

import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import type { Jogo, Aposta } from '@/types/api';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';

interface ApostaDrawerProps {
  jogo: Jogo;
  aposta?: Aposta;
  aberto: boolean;
  onFechar: () => void;
  onSalvo: () => void;
}

export function ApostaDrawer({ jogo, aposta, aberto, onFechar, onSalvo }: ApostaDrawerProps) {
  const [casa, setCasa] = useState(aposta?.placarCasa ?? 0);
  const [visitante, setVisitante] = useState(aposta?.placarVisitante ?? 0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const isDirtyRef = useRef(false);

  async function salvar(placarCasa: number, placarVisitante: number): Promise<boolean> {
    setSalvando(true);
    setErro('');
    try {
      await api.post('/apostas', { jogoId: jogo.id, placarCasa, placarVisitante });
      isDirtyRef.current = false;
      onSalvo();
      return true;
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar.');
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function handleConfirmar() {
    const ok = await salvar(casa, visitante);
    if (ok) onFechar();
  }

  async function handleFechar() {
    if (isDirtyRef.current) {
      await salvar(casa, visitante);
    }
    onFechar();
  }

  function incCasa()      { setCasa(v => v + 1);              isDirtyRef.current = true; }
  function decCasa()      { setCasa(v => Math.max(0, v - 1)); isDirtyRef.current = true; }
  function incVisitante() { setVisitante(v => v + 1);              isDirtyRef.current = true; }
  function decVisitante() { setVisitante(v => Math.max(0, v - 1)); isDirtyRef.current = true; }

  return (
    <Sheet open={aberto} onOpenChange={open => { if (!open) handleFechar(); }}>
      <SheetContent side="bottom" className="bg-trovao-card border-t border-trovao-border rounded-t-2xl pb-8">
        <SheetHeader className="text-center pb-2">
          <SheetTitle className="text-white text-base">Seu Palpite</SheetTitle>
          <p className="text-trovao-muted text-xs">
            {jogo.fase}{jogo.grupo ? ` · Grupo ${jogo.grupo}` : ''} · Rodada {jogo.rodada}
          </p>
        </SheetHeader>

        <div className="flex items-center justify-center gap-6 py-6">
          {/* Time casa */}
          <div className="flex flex-col items-center gap-2 w-16">
            <SelecaoAvatar nome={jogo.selecaoCasa.nome} bandeiraSvg={jogo.selecaoCasa.bandeiraSvg} size="lg" />
            <p className="text-xs font-semibold text-white">{jogo.selecaoCasa.codigo}</p>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <button onClick={incCasa} aria-label="+"
                className="w-10 h-10 bg-trovao-surface rounded-xl text-trovao-gold text-xl font-bold hover:bg-trovao-border transition-colors">
                +
              </button>
              <span data-testid="placar-casa"
                className="text-white text-2xl font-bold w-10 text-center tabular-nums">
                {casa}
              </span>
              <button onClick={decCasa} aria-label="−"
                className="w-10 h-10 bg-trovao-surface rounded-xl text-trovao-muted text-xl hover:bg-trovao-border transition-colors">
                −
              </button>
            </div>

            <span className="text-trovao-muted text-2xl font-bold">×</span>

            <div className="flex flex-col items-center gap-1">
              <button onClick={incVisitante} aria-label="+"
                className="w-10 h-10 bg-trovao-surface rounded-xl text-trovao-gold text-xl font-bold hover:bg-trovao-border transition-colors">
                +
              </button>
              <span data-testid="placar-visitante"
                className="text-white text-2xl font-bold w-10 text-center tabular-nums">
                {visitante}
              </span>
              <button onClick={decVisitante} aria-label="−"
                className="w-10 h-10 bg-trovao-surface rounded-xl text-trovao-muted text-xl hover:bg-trovao-border transition-colors">
                −
              </button>
            </div>
          </div>

          {/* Time visitante */}
          <div className="flex flex-col items-center gap-2 w-16">
            <SelecaoAvatar nome={jogo.selecaoVisitante.nome} bandeiraSvg={jogo.selecaoVisitante.bandeiraSvg} size="lg" />
            <p className="text-xs font-semibold text-white">{jogo.selecaoVisitante.codigo}</p>
          </div>
        </div>

        {erro && <p className="text-trovao-red text-sm text-center mb-3">{erro}</p>}

        <button
          onClick={handleConfirmar}
          disabled={salvando}
          className="w-full py-3 bg-trovao-gold text-trovao-base font-bold rounded-xl text-sm hover:bg-trovao-gold/90 disabled:opacity-50 transition-colors"
        >
          {salvando ? 'Salvando...' : 'Confirmar Palpite'}
        </button>
      </SheetContent>
    </Sheet>
  );
}
