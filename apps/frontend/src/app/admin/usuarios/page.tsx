'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { AdminUsuarioRow } from '@/components/AdminUsuarioRow';
import { PageSkeleton } from '@/components/PageSkeleton';
import type { Usuario } from '@/types/api';

function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState('');

  async function carregar() {
    setLoading(true);
    const data = await api.get<Usuario[]>('/admin/usuarios').catch(() => [] as Usuario[]);
    setUsuarios(data);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  const filtrados = useMemo(() => {
    const q = normalizar(query.trim());
    if (!q) return usuarios;
    return usuarios.filter(
      (u) => normalizar(u.nome).includes(q) || normalizar(u.email).includes(q),
    );
  }, [usuarios, query]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Usuários</h1>

      <div className="space-y-2">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou email"
            className="w-full bg-trovao-card border border-trovao-border rounded-xl
                       pl-9 pr-9 py-2 text-sm text-white placeholder:text-trovao-muted
                       focus:outline-none focus:border-trovao-gold"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-trovao-muted pointer-events-none"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 text-trovao-muted hover:text-white"
            >×</button>
          )}
        </div>
        {query && (
          <p className="text-trovao-muted text-xs">{filtrados.length} de {usuarios.length} usuários</p>
        )}
      </div>

      {loading ? (
        <PageSkeleton />
      ) : query && filtrados.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <p className="text-trovao-muted text-sm">Nenhum usuário corresponde à busca.</p>
          <button onClick={() => setQuery('')} className="text-trovao-gold text-xs font-semibold">Limpar</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((u) => (
            <AdminUsuarioRow key={u.id} usuario={u} onAtualizado={carregar} />
          ))}
        </div>
      )}
    </div>
  );
}
