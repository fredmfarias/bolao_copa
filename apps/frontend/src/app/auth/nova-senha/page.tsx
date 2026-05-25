'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

function NovaSenhaContent() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/nova-senha', { token, senha });
      router.push('/login');
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm bg-gray-900 rounded-xl p-8 space-y-6">
      <h1 className="text-xl font-bold text-center">Nova senha</h1>
      {erro && <p className="text-red-400 text-sm">{erro}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="password" placeholder="Nova senha (mín. 8 caracteres)" value={senha}
          onChange={e => setSenha(e.target.value)} minLength={8} required
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
        <button type="submit" disabled={loading}
          className="w-full bg-yellow-400 text-gray-900 font-bold py-2 rounded-lg hover:bg-yellow-300 disabled:opacity-50">
          {loading ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>
    </div>
  );
}

export default function NovaSenhaPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Suspense fallback={<div className="text-gray-400">Carregando...</div>}>
        <NovaSenhaContent />
      </Suspense>
    </div>
  );
}
