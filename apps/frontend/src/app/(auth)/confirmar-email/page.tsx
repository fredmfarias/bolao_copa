'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

function ConfirmarEmailContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [msg, setMsg] = useState('Confirmando...');

  useEffect(() => {
    if (!token) { setMsg('Token não encontrado.'); return; }
    api.get<{ message: string }>(`/auth/confirmar-email?token=${token}`)
      .then(() => router.push('/login?emailConfirmado=true'))
      .catch(e => setMsg(e.message));
  }, [token, router]);

  return (
    <div className="bg-gray-900 rounded-xl p-8 text-center max-w-sm space-y-4">
      <p className="text-gray-300">{msg}</p>
    </div>
  );
}

export default function ConfirmarEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Suspense fallback={<div className="text-gray-400">Carregando...</div>}>
        <ConfirmarEmailContent />
      </Suspense>
    </div>
  );
}
