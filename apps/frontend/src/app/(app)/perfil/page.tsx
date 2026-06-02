'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

export default function PerfilPage() {
  const { user, refresh, logout } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ nome: user?.nome ?? '', avatarUrl: user?.avatarUrl ?? '' });
  const [sucesso, setSucesso] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    if (user) setForm({ nome: user.nome, avatarUrl: user.avatarUrl ?? '' });
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setLoading(true);
    try {
      await api.patch('/usuarios/me', {
        nome: form.nome || undefined,
        avatarUrl: form.avatarUrl || undefined,
      });
      await refresh();
      setSucesso('Perfil atualizado!');
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLogoutLoading(true);
    await logout();
    router.push('/login');
  }

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-xl font-bold">Meu perfil</h1>

      <div className="flex items-center gap-4">
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.nome} className="w-16 h-16 rounded-full" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl">
            {user?.nome?.[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-semibold">{user?.nome}</p>
          <p className="text-sm text-gray-400">{user?.email}</p>
          <p className="text-xs text-gray-600 mt-0.5">{user?.role}</p>
        </div>
      </div>

      {sucesso && <p className="text-green-400 text-sm">{sucesso}</p>}
      {erro && <p className="text-red-400 text-sm">{erro}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Nome</label>
          <input
            value={form.nome}
            onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Avatar URL (opcional)</label>
          <input
            value={form.avatarUrl}
            onChange={e => setForm(p => ({ ...p, avatarUrl: e.target.value }))}
            placeholder="https://..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-yellow-400 text-gray-900 font-bold px-6 py-2 rounded-lg hover:bg-yellow-300 disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
      </form>

      <Link
        href="/regulamento?from=/perfil"
        className="block text-sm text-gray-400 hover:text-white"
      >
        Regulamento
      </Link>
      <button
        onClick={handleLogout}
        disabled={logoutLoading}
        className="border border-red-500 text-red-400 hover:bg-red-500/10 px-6 py-2 rounded-lg font-medium disabled:opacity-50"
      >
        {logoutLoading ? 'Saindo...' : 'Sair'}
      </button>
    </div>
  );
}
