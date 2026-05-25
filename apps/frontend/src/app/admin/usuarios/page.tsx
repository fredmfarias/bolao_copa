'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AdminUsuarioRow } from '@/components/AdminUsuarioRow';
import { PageSkeleton } from '@/components/PageSkeleton';
import type { Usuario } from '@/types/api';

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    const data = await api.get<Usuario[]>('/admin/usuarios').catch(() => [] as Usuario[]);
    setUsuarios(data);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Usuários</h1>
      {loading ? <PageSkeleton /> : (
        <div className="space-y-2">
          {usuarios.map(u => (
            <AdminUsuarioRow key={u.id} usuario={u} onAtualizado={carregar} />
          ))}
        </div>
      )}
    </div>
  );
}
