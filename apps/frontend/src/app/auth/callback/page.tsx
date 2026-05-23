'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { setAccessToken } from '@/lib/auth';

function CallbackContent() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      setAccessToken(token);
      router.replace('/jogos');
    } else {
      router.replace('/login');
    }
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
