'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { PageSkeleton } from '@/components/PageSkeleton';

interface ConviteInfo {
  valido: boolean;
  bolaoId: string | null;
  bolaoNome: string | null;
  descricao: string | null;
  criadorNome: string | null;
  expiraEm: string | null;
}

type Estado = 'carregando' | 'invalido' | 'nao-autenticado' | 'pronto' | 'entrando' | 'sucesso';

export default function ConvitePage() {
  const { codigo } = useParams<{ codigo: string }>();
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [estado, setEstado] = useState<Estado>('carregando');
  const [convite, setConvite] = useState<ConviteInfo | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (authLoading) return;
    api.get<ConviteInfo>(`/convites/${codigo}`)
      .then(data => {
        if (!data.valido) { setEstado('invalido'); return; }
        setConvite(data);
        setEstado(user ? 'pronto' : 'nao-autenticado');
      })
      .catch(() => setEstado('invalido'));
  }, [codigo, authLoading, user]);

  async function entrar() {
    if (!convite?.bolaoId) return;
    setEstado('entrando');
    setErro('');
    try {
      await api.post(`/boloes/entrar/${codigo}`);
      setEstado('sucesso');
      setTimeout(() => router.push(`/boloes/${convite.bolaoId}`), 1500);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao entrar no bolão.');
      setEstado('pronto');
    }
  }

  async function trocarConta() {
    await logout();
    setErro('');
    setEstado('nao-autenticado');
  }

  if (estado === 'carregando') return <PageSkeleton />;

  if (estado === 'invalido') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-trovao-card border border-trovao-border rounded-2xl p-8 text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-white font-bold text-lg">Convite inválido</h1>
          <p className="text-trovao-muted text-sm">Este link de convite não existe ou expirou.</p>
          <button onClick={() => router.push('/jogos')}
            className="w-full py-2 bg-trovao-surface border border-trovao-border rounded-lg text-trovao-muted text-sm hover:text-white transition-colors">
            Ir para Jogos
          </button>
        </div>
      </div>
    );
  }

  if (estado === 'nao-autenticado') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-trovao-card border border-trovao-border rounded-2xl p-8 text-center space-y-4">
          <div className="text-4xl">⚡</div>
          <h1 className="text-white font-bold text-lg">{convite?.bolaoNome}</h1>
          {convite?.descricao && <p className="text-trovao-muted text-sm">{convite.descricao}</p>}
          <p className="text-trovao-muted text-xs">Convidado por {convite?.criadorNome}</p>
          <p className="text-trovao-muted text-sm">Entre ou crie uma conta para participar.</p>
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/google`}
            onClick={() => sessionStorage.setItem('convitePendente', codigo)}
            className="block w-full py-2 bg-trovao-gold text-trovao-base text-sm font-bold rounded-lg hover:opacity-90 transition-opacity text-center"
          >
            Registrar com Google
          </a>
          <button onClick={() => router.push(`/registrar?convite=${codigo}`)}
            className="w-full py-2 bg-trovao-gold/10 border border-trovao-gold/40 text-trovao-gold text-sm rounded-lg hover:bg-trovao-gold/20 hover:border-trovao-gold/60 transition-colors">
            Criar conta
          </button>
          <button onClick={() => router.push(`/login?redirect=/convite/${codigo}`)}
            className="w-full py-2 bg-trovao-green/10 border border-trovao-green/40 text-trovao-green text-sm font-semibold rounded-lg hover:bg-trovao-green/20 hover:border-trovao-green/60 transition-colors">
            Fazer login
          </button>
          <Link
            href={`/regulamento?from=/convite/${codigo}`}
            className="block text-trovao-muted text-xs hover:text-white transition-colors"
          >
            Regulamento
          </Link>
        </div>
      </div>
    );
  }

  if (estado === 'sucesso') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-trovao-card border border-trovao-border rounded-2xl p-8 text-center space-y-4">
          <div className="text-4xl">🎉</div>
          <h1 className="text-white font-bold text-lg">Bem-vindo ao {convite?.bolaoNome}!</h1>
          <p className="text-trovao-muted text-sm">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-trovao-card border border-trovao-border rounded-2xl p-8 text-center space-y-4">
        <div className="text-4xl">⚡</div>
        <h1 className="text-white font-bold text-lg">{convite?.bolaoNome}</h1>
        {convite?.descricao && <p className="text-trovao-muted text-sm">{convite.descricao}</p>}
        <p className="text-trovao-muted text-xs">Convidado por {convite?.criadorNome}</p>
        {convite?.expiraEm && (
          <p className="text-trovao-muted text-xs">
            Expira em {new Date(convite.expiraEm).toLocaleDateString('pt-BR')}
          </p>
        )}
        {erro && <p className="text-trovao-red text-sm">{erro}</p>}
        <button onClick={entrar} disabled={estado === 'entrando'}
          className="w-full py-3 bg-trovao-gold text-trovao-base text-sm font-bold rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity">
          {estado === 'entrando' ? 'Entrando...' : 'Entrar no Bolão'}
        </button>
        <Link
          href={`/regulamento?from=/convite/${codigo}`}
          className="block text-trovao-muted text-xs hover:text-white transition-colors"
        >
          Regulamento
        </Link>
        {user && (
          <div className="pt-2 border-t border-trovao-border space-y-1">
            <p className="text-trovao-muted text-xs">Logado como {user.email}</p>
            <button onClick={trocarConta} disabled={estado === 'entrando'}
              className="text-trovao-gold text-xs hover:underline disabled:opacity-50">
              Não é você? Trocar de conta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
