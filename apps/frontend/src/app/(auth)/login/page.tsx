'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/jogos';
  const emailConfirmado = searchParams.get('emailConfirmado');
  const erroQuery = searchParams.get('erro');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      await login(email, senha);
      router.push(redirect);
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm bg-gray-900 rounded-xl p-8">
        <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 mb-4">
          <Image
            src="/logo_bolao.png"
            alt="Bolão Trovão"
            width={48}
            height={48}
            className="h-auto w-12 shrink-0"
            priority
          />
          <div className="flex flex-col flex-1">
            <span className="text-gray-300 text-sm">O Bolão da Copa do Mundo 2026.</span>
            <Link href="/regulamento" className="text-xs text-yellow-400 hover:text-yellow-300 self-end">Regulamento</Link>
          </div>
        </div>
        {erroQuery === 'cadastros-encerrados' && (
          <p className="text-red-400 text-sm text-center mb-4">
            Cadastros encerrados a 2h do início da Copa. Procure o administrador para se cadastrar.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          {erro && <p className="text-red-400 text-sm text-center">{erro}</p>}
          {emailConfirmado && (
            <p className="text-green-400 text-sm text-center">
              E-mail verificado com sucesso! Faça login para continuar.
            </p>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1">E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-yellow-400 text-gray-900 font-bold py-2 rounded-lg hover:bg-yellow-300 disabled:opacity-50">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          <a href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/google`}
            className="block bg-yellow-400/10 border border-yellow-400/40 text-yellow-300 rounded-lg py-2 hover:bg-yellow-400/20 hover:border-yellow-400/60 transition-colors text-center">
            Entrar com Google
          </a>
        </form>
        <div className="text-center text-sm text-gray-400">
          <Link href="/esqueceu-senha" className="hover:text-white block">Esqueceu a senha?</Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
