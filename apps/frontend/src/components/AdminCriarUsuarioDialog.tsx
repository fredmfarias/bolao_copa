'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';

interface BolaoOpcao { id: string; nome: string; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriado: () => void;
}

export function AdminCriarUsuarioDialog({ open, onOpenChange, onCriado }: Props) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senhaTemp, setSenhaTemp] = useState('');
  const [buscaBolao, setBuscaBolao] = useState('');
  const [opcoes, setOpcoes] = useState<BolaoOpcao[]>([]);
  const [bolaoId, setBolaoId] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!buscaBolao.trim() || bolaoId) {
      setOpcoes([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      api.get<BolaoOpcao[]>(`/boloes/buscar?nome=${encodeURIComponent(buscaBolao)}`)
        .then((res) => { if (!cancelled) setOpcoes(res); })
        .catch(() => { if (!cancelled) setOpcoes([]); });
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [buscaBolao, bolaoId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const payload: Record<string, string> = { nome, email, senhaTemp };
      if (bolaoId) payload.bolaoId = bolaoId;
      await api.post('/admin/usuarios', payload);
      onCriado();
      onOpenChange(false);
      setNome(''); setEmail(''); setSenhaTemp(''); setBuscaBolao(''); setBolaoId(null);
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao criar usuário.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {erro && <p className="text-trovao-red text-sm">{erro}</p>}
          <label className="block text-sm">
            Nome
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required minLength={2}
              className="w-full mt-1 bg-trovao-surface border border-trovao-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-trovao-gold"
            />
          </label>
          <label className="block text-sm">
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full mt-1 bg-trovao-surface border border-trovao-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-trovao-gold"
            />
          </label>
          <label className="block text-sm">
            Senha temporária
            <input
              type="text"
              value={senhaTemp}
              onChange={(e) => setSenhaTemp(e.target.value)}
              required minLength={8}
              className="w-full mt-1 bg-trovao-surface border border-trovao-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-trovao-gold"
            />
          </label>
          <div className="text-sm">
            <label className="block">Adicionar também a um bolão (opcional)</label>
            {bolaoId ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-white">{opcoes.find((o) => o.id === bolaoId)?.nome ?? 'Bolão selecionado'}</span>
                <button type="button" className="text-trovao-muted text-xs" onClick={() => { setBolaoId(null); setBuscaBolao(''); }}>
                  Trocar
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={buscaBolao}
                  onChange={(e) => setBuscaBolao(e.target.value)}
                  placeholder="Buscar por nome"
                  className="w-full mt-1 bg-trovao-surface border border-trovao-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-trovao-gold"
                />
                {opcoes.length > 0 && (
                  <ul className="mt-1 border border-trovao-border rounded-lg bg-trovao-card max-h-40 overflow-auto">
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
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => onOpenChange(false)}
              className="text-sm px-3 py-2 rounded-lg border border-trovao-border text-trovao-muted hover:text-white">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="text-sm px-3 py-2 rounded-lg bg-trovao-gold text-trovao-bg font-semibold hover:bg-yellow-300 disabled:opacity-50">
              {loading ? 'Criando...' : 'Criar'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
