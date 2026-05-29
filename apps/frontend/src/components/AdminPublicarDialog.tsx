'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';
import type { JogoPendente } from '@/types/api';

interface Props {
  open: boolean;
  jogos: JogoPendente[];
  publicando?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function AdminPublicarDialog({ open, jogos, publicando, onCancel, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogTitle>Confirmar publicação · {jogos.length} jogo{jogos.length === 1 ? '' : 's'}</DialogTitle>
        <ul className="max-h-[60vh] overflow-y-auto divide-y divide-trovao-border/40">
          {jogos.map((j) => (
            <li key={j.id} className="flex items-center justify-between px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <SelecaoAvatar nome={j.selecaoCasa.nome} bandeiraSvg={j.selecaoCasa.bandeiraSvg} size="sm" shape="rect" />
                <span className="text-white font-semibold">{j.selecaoCasa.codigo}</span>
                <span className="text-white font-bold mx-1">{j.placarCasa} × {j.placarVisitante}</span>
                <span className="text-white font-semibold">{j.selecaoVisitante.codigo}</span>
                <SelecaoAvatar nome={j.selecaoVisitante.nome} bandeiraSvg={j.selecaoVisitante.bandeiraSvg} size="sm" shape="rect" />
              </div>
              <div className="flex items-center gap-2 text-trovao-muted shrink-0">
                <span className="text-[10px] font-bold text-trovao-gold">×{j.pesoPontuacao}</span>
                <span className="text-[10px] uppercase">{j.fase}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} disabled={publicando}
            className="px-3 py-1.5 text-xs rounded-lg border border-trovao-border text-trovao-muted hover:text-white disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={publicando}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-trovao-gold text-trovao-base disabled:opacity-50">
            {publicando ? 'Publicando...' : 'Publicar'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
