'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

function mascaraTelefone(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 2) return `(${nums}`;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
}

function CompletarPerfilForm() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const convite = searchParams.get('convite');
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await api.patch('/usuarios/me', { telefone });
      if (convite) {
        try {
          await api.post(`/boloes/entrar/${convite}`);
        } catch {
          // already a member or bolão full — proceed anyway
        }
      }
      router.replace('/jogos');
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao salvar telefone.');
    } finally {
      setSalvando(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm bg-gray-900 rounded-xl p-8 space-y-6">
        <h1 className="text-xl font-bold text-center text-white">Complete seu perfil</h1>
        <p className="text-gray-400 text-sm text-center">
          Para participar do bolão, precisamos do seu telefone.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && <p className="text-red-400 text-sm text-center">{erro}</p>}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Telefone</label>
            <input
              type="tel"
              inputMode="tel"
              value={telefone}
              required
              placeholder="(11) 91234-5678"
              onChange={e => setTelefone(mascaraTelefone(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
            />
          </div>
          <button
            type="submit"
            disabled={salvando}
            className="w-full bg-yellow-400 text-gray-900 font-bold py-2 rounded-lg hover:bg-yellow-300 disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Confirmar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CompletarPerfilPage() {
  return (
    <Suspense>
      <CompletarPerfilForm />
    </Suspense>
  );
}
