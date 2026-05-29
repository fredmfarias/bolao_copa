'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { AdminAdicionarBolaoDialog } from '@/components/AdminAdicionarBolaoDialog';
import type { Usuario } from '@/types/api';

interface AdminUsuarioRowProps {
  usuario: Pick<Usuario, 'id' | 'nome' | 'email' | 'role' | 'avatarUrl' | 'ativo'>;
  onAtualizado: () => void;
}

export function AdminUsuarioRow({ usuario, onAtualizado }: AdminUsuarioRowProps) {
  const [atualizando, setAtualizando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [bolaoOpen, setBolaoOpen] = useState(false);
  const ativo = usuario.ativo ?? true;

  async function patch(data: { role?: 'ADMIN' | 'USER'; ativo?: boolean }) {
    setAtualizando(true);
    try {
      await api.patch(`/admin/usuarios/${usuario.id}`, data);
      onAtualizado();
    } finally {
      setAtualizando(false);
    }
  }

  async function resetarSenha() {
    setAtualizando(true);
    setMsg(null);
    try {
      await api.post(`/admin/usuarios/${usuario.id}/reset-senha`);
      setMsg('E-mail de redefinição enviado.');
    } finally {
      setAtualizando(false);
    }
  }

  return (
    <div className="px-4 py-3 bg-trovao-card border border-trovao-border rounded-xl space-y-2">
      <div className="flex items-center gap-3">
        {usuario.avatarUrl ? (
          <img src={usuario.avatarUrl} alt={usuario.nome} className="w-8 h-8 rounded-full flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-trovao-surface flex items-center justify-center text-xs font-bold text-trovao-muted flex-shrink-0">
            {usuario.nome.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{usuario.nome}</p>
          <p className="text-trovao-muted text-xs truncate">{usuario.email}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          usuario.role === 'ADMIN' ? 'bg-trovao-gold/20 text-trovao-gold' : 'bg-trovao-surface text-trovao-muted'
        }`}>
          {usuario.role}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => patch({ role: usuario.role === 'ADMIN' ? 'USER' : 'ADMIN' })}
          disabled={atualizando}
          className="text-xs px-2 py-1 rounded-lg border border-trovao-border text-trovao-muted hover:text-white hover:border-trovao-gold disabled:opacity-50 transition-colors"
        >
          {usuario.role === 'ADMIN' ? 'Remover Admin' : '→ Admin'}
        </button>
        <button
          onClick={() => patch({ ativo: !ativo })}
          disabled={atualizando}
          className={`text-xs px-2 py-1 rounded-lg border disabled:opacity-50 transition-colors ${
            ativo
              ? 'bg-trovao-green/10 text-trovao-green border-trovao-green/40'
              : 'bg-trovao-red/10 text-trovao-red border-trovao-red/40'
          }`}
        >
          {ativo ? 'Ativo' : 'Inativo'}
        </button>
        <button
          onClick={resetarSenha}
          disabled={atualizando}
          className="text-xs px-2 py-1 rounded-lg border border-trovao-border text-trovao-muted hover:text-white hover:border-trovao-gold disabled:opacity-50 transition-colors"
        >
          Reset senha
        </button>
        <button
          onClick={() => setBolaoOpen(true)}
          disabled={atualizando}
          className="text-xs px-2 py-1 rounded-lg border border-trovao-border text-trovao-muted hover:text-white hover:border-trovao-gold disabled:opacity-50 transition-colors"
        >
          + Bolão
        </button>
      </div>

      {msg && <p className="text-trovao-green text-xs">{msg}</p>}

      <AdminAdicionarBolaoDialog
        open={bolaoOpen}
        usuarioId={usuario.id}
        onOpenChange={setBolaoOpen}
      />
    </div>
  );
}
