'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function RegistrarPage() {
  const router = useRouter();
  const [form, setForm] = useState({ nome: '', email: '', senha: '' });
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const data = await api.post<{ message: string }>('/auth/registrar', form);
      setSucesso(data.message);
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao cadastrar.');
    } finally {
      setLoading(false);
    }
  }

  if (sucesso) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-gray-900 rounded-xl p-8 text-center max-w-sm space-y-4">
        <p className="text-green-400">{sucesso}</p>
        <Link href="/login" className="text-yellow-400 hover:underline block">Ir para login</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm bg-gray-900 rounded-xl p-8 space-y-6">
        <h1 className="text-xl font-bold text-center">Criar conta</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
          {(['nome', 'email', 'senha'] as const).map(f => (
            <div key={f}>
              <label className="block text-sm text-gray-400 mb-1 capitalize">{f}</label>
              <input type={f === 'senha' ? 'password' : f === 'email' ? 'email' : 'text'}
                value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
            </div>
          ))}
          <button type="submit" disabled={loading}
            className="w-full bg-yellow-400 text-gray-900 font-bold py-2 rounded-lg hover:bg-yellow-300 disabled:opacity-50">
            {loading ? 'Cadastrando...' : 'Cadastrar'}
          </button>
        </form>
        <div className="text-center text-sm text-gray-400">
          <Link href="/login" className="hover:text-white">Já tem conta? Entrar</Link>
        </div>
      </div>
    </div>
  );
}
