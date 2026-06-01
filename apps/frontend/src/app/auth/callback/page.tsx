'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { setAccessToken } from '@/lib/auth';
import { api } from '@/lib/api';
import type { Usuario } from '@/types/api';

function CallbackContent() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      router.replace('/login');
      return;
    }

    setAccessToken(token);

    const convitePendente = sessionStorage.getItem('convitePendente');

    if (!convitePendente) {
      router.replace('/jogos');
      return;
    }

    api.get<Usuario>('/usuarios/me')
      .then(user => {
        sessionStorage.removeItem('convitePendente');
        if (!user.telefone) {
          router.replace(`/completar-perfil?convite=${convitePendente}`);
        } else {
          api.post(`/boloes/entrar/${convitePendente}`)
            .catch(() => {})
            .finally(() => router.replace('/jogos'));
        }
      })
      .catch(() => {
        router.replace('/jogos');
      });
  }, [params, router]);

  return <span className="text-gray-400">Autenticando...</span>;
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Suspense fallback={<span className="text-gray-400">Carregando...</span>}>
        <CallbackContent />
      </Suspense>
    </div>
  );
}
