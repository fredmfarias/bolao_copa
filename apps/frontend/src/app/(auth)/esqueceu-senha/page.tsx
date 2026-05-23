'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function EsqueceuSenhaPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const d = await api.post<{ message: string }>('/auth/esqueceu-senha', { email });
      setMsg(d.message);
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm bg-gray-900 rounded-xl p-8 space-y-6">
        <h1 className="text-xl font-bold text-center">Recuperar senha</h1>
        {msg ? (
          <div className="text-center space-y-4">
            <p className="text-green-400">{msg}</p>
            <Link href="/login" className="text-yellow-400 hover:underline block">Voltar ao login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" placeholder="Seu e-mail" value={email}
              onChange={e => setEmail(e.target.value)} required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
            <button type="submit" disabled={loading}
              className="w-full bg-yellow-400 text-gray-900 font-bold py-2 rounded-lg hover:bg-yellow-300 disabled:opacity-50">
              {loading ? 'Enviando...' : 'Enviar link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
