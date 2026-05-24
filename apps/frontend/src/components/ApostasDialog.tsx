'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Jogo } from '@/types/api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface Palpite {
  usuarioId: string;
  nome: string;
  avatarUrl: string | null;
  placarCasa: number;
  placarVisitante: number;
  pontuacao: number | null;
}

interface ApostasDialogProps {
  jogo: Jogo;
  bolaoId: string;
  aberto: boolean;
  onFechar: () => void;
}

export function ApostasDialog({ jogo, bolaoId, aberto, onFechar }: ApostasDialogProps) {
  const [palpites, setPalpites] = useState<Palpite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!aberto) return;
    setLoading(true);
    api.get<Palpite[]>(`/boloes/${bolaoId}/apostas?jogoId=${jogo.id}`)
      .then(setPalpites)
      .catch(() => setPalpites([]))
      .finally(() => setLoading(false));
  }, [aberto, bolaoId, jogo.id]);

  return (
    <Dialog open={aberto} onOpenChange={open => { if (!open) onFechar(); }}>
      <DialogContent className="bg-trovao-card border-trovao-border max-w-sm w-full">
        <DialogHeader>
          <DialogTitle className="text-white text-sm">
            {jogo.selecaoCasa.codigo} × {jogo.selecaoVisitante.codigo} — Palpites
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-trovao-muted text-sm text-center py-4">Carregando...</p>
        ) : palpites.length === 0 ? (
          <p className="text-trovao-muted text-sm text-center py-4">Nenhum palpite ainda.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {palpites.map(p => (
              <div key={p.usuarioId}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-trovao-surface">
                <div className="flex items-center gap-2">
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl} alt={p.nome} className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-trovao-border flex items-center justify-center text-[10px] text-trovao-muted font-bold">
                      {p.nome.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-white text-xs font-medium">{p.nome}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white text-xs font-mono font-semibold">
                    {p.placarCasa} × {p.placarVisitante}
                  </span>
                  {p.pontuacao !== null && (
                    <span className="text-trovao-gold text-xs font-bold">+{p.pontuacao}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
