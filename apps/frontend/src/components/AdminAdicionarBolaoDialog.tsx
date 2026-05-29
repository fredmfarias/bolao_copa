'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';

interface BolaoOpcao { id: string; nome: string; }

interface Props {
  open: boolean;
  usuarioId: string;
  onOpenChange: (open: boolean) => void;
  onAdicionado: () => void;
}

export function AdminAdicionarBolaoDialog({ open, usuarioId, onOpenChange, onAdicionado }: Props) {
  const [busca, setBusca] = useState('');
  const [opcoes, setOpcoes] = useState<BolaoOpcao[]>([]);
  const [bolaoId, setBolaoId] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!busca.trim() || bolaoId) { setOpcoes([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      api.get<BolaoOpcao[]>(`/boloes/buscar?nome=${encodeURIComponent(busca)}`)
        .then((res) => { if (!cancelled) setOpcoes(res); })
        .catch(() => { if (!cancelled) setOpcoes([]); });
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [busca, bolaoId]);

  async function submit() {
    if (!bolaoId) return;
    setErro('');
    setLoading(true);
    try {
      await api.post(`/admin/boloes/${bolaoId}/membros`, { usuarioId });
      onAdicionado();
      onOpenChange(false);
      setBusca(''); setBolaoId(null); setOpcoes([]);
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao adicionar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar a bolão</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {erro && <p className="text-trovao-red text-sm">{erro}</p>}
          {bolaoId ? (
            <div className="flex items-center gap-2">
              <span className="text-white">{opcoes.find((o) => o.id === bolaoId)?.nome ?? 'Bolão selecionado'}</span>
              <button type="button" className="text-trovao-muted text-xs" onClick={() => { setBolaoId(null); setBusca(''); }}>
                Trocar
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome"
                className="w-full bg-trovao-surface border border-trovao-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-trovao-gold"
              />
              {opcoes.length > 0 && (
                <ul className="border border-trovao-border rounded-lg bg-trovao-card max-h-40 overflow-auto">
                  {opcoes.map((o) => (
                    <li key={o.id}>
                      <button type="button" onClick={() => setBolaoId(o.id)}
                        className="w-full text-left px-3 py-2 hover:bg-trovao-surface text-white">
                        {o.nome}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => onOpenChange(false)}
              className="text-sm px-3 py-2 rounded-lg border border-trovao-border text-trovao-muted hover:text-white">
              Cancelar
            </button>
            <button type="button" onClick={submit} disabled={loading || !bolaoId}
              className="text-sm px-3 py-2 rounded-lg bg-trovao-gold text-trovao-bg font-semibold hover:bg-yellow-300 disabled:opacity-50">
              {loading ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
