'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useInscricaoStatus } from '@/hooks/useInscricaoStatus';

function mascaraTelefone(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 2) return `(${nums}`;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
}

function RegistrarForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conviteToken = searchParams.get('convite');
  const { abertas } = useInscricaoStatus();
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', senha: '' });
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const body = conviteToken ? { ...form, conviteToken } : form;
      const data = await api.post<{ message: string }>('/auth/registrar', body);
      setSucesso(data.message);
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao cadastrar.');
    } finally {
      setLoading(false);
    }
  }

  if (!abertas) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-gray-900 rounded-xl p-8 text-center max-w-sm space-y-4">
        <p className="text-red-400">
          Cadastros encerrados a 2h do início da Copa. Procure o administrador para se cadastrar.
        </p>
        <Link href="/login" className="text-yellow-400 hover:underline block">Voltar ao login</Link>
      </div>
    </div>
  );

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

          <div>
            <label className="block text-sm text-gray-400 mb-1">Nome</label>
            <input type="text" value={form.nome} required
              onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input type="email" value={form.email} required
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Telefone</label>
            <input type="tel" inputMode="tel" value={form.telefone} required
              placeholder="(11) 91234-5678"
              onChange={e => setForm(p => ({ ...p, telefone: mascaraTelefone(e.target.value) }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Senha</label>
            <input type="password" value={form.senha} required
              onChange={e => setForm(p => ({ ...p, senha: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
          </div>

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

export default function RegistrarPage() {
  return (
    <Suspense>
      <RegistrarForm />
    </Suspense>
  );
}
