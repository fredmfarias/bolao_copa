'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { Usuario } from '@/types/api';

interface AdminUsuarioRowProps {
  usuario: Pick<Usuario, 'id' | 'nome' | 'email' | 'role' | 'avatarUrl'>;
  onAtualizado: () => void;
}

export function AdminUsuarioRow({ usuario, onAtualizado }: AdminUsuarioRowProps) {
  const [atualizando, setAtualizando] = useState(false);

  async function alterarRole(role: 'ADMIN' | 'USER') {
    setAtualizando(true);
    try {
      await api.patch(`/admin/usuarios/${usuario.id}`, { role });
      onAtualizado();
    } finally {
      setAtualizando(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-trovao-card border border-trovao-border rounded-xl">
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
      <button
        onClick={() => alterarRole(usuario.role === 'ADMIN' ? 'USER' : 'ADMIN')}
        disabled={atualizando}
        className="text-xs px-2 py-1 rounded-lg border border-trovao-border text-trovao-muted hover:text-white hover:border-trovao-gold disabled:opacity-50 transition-colors"
      >
        {usuario.role === 'ADMIN' ? 'Remover Admin' : '→ Admin'}
      </button>
    </div>
  );
}
