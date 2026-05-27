'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Bolao } from '@/types/api';

interface BolaoCardProps {
  bolao: Bolao;
  href: string;
  favoritoId?: string | null;
  onFavoritoChange?: () => void;
}

export function BolaoCard({ bolao, href, favoritoId, onFavoritoChange }: BolaoCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const isFavorito = bolao.id === favoritoId;

  async function confirmarFavorito() {
    setSalvando(true);
    try {
      await api.patch('/usuarios/me/favorito', { bolaoId: bolao.id });
      setConfirmOpen(false);
      onFavoritoChange?.();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div className="relative bg-trovao-card border border-trovao-border rounded-xl hover:border-trovao-gold/50 transition-colors">
        <Link href={href} className={`block p-4 ${onFavoritoChange ? 'pr-12' : ''}`}>
          <p className="font-semibold text-white">{bolao.nome}</p>
          {bolao.descricao && (
            <p className="text-sm text-trovao-muted mt-0.5 truncate">{bolao.descricao}</p>
          )}
          <p className="text-xs text-trovao-muted mt-2">
            {bolao._count?.membros ?? 0} / {bolao.maxParticipantes ?? '?'} participantes
          </p>
        </Link>
        {onFavoritoChange && (
          <button
            onClick={() => setConfirmOpen(true)}
            aria-label={isFavorito ? 'Bolão favorito' : 'Definir como favorito'}
            className="absolute top-4 right-4 text-xl leading-none transition-colors"
          >
            <span className={isFavorito ? 'text-trovao-gold' : 'text-trovao-muted hover:text-trovao-gold'}>
              {isFavorito ? '★' : '☆'}
            </span>
          </button>
        )}
      </div>

      {onFavoritoChange && (
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>★ Definir bolão favorito</DialogTitle>
              <DialogDescription>
                "{bolao.nome}" será seu bolão padrão nos menus Bolões e Ranking.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancelar
              </DialogClose>
              <Button
                onClick={confirmarFavorito}
                disabled={salvando}
                className="bg-trovao-gold text-trovao-base font-bold hover:bg-trovao-gold/90"
              >
                {salvando ? 'Salvando...' : 'Confirmar ★'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
