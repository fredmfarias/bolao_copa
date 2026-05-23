'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

function ConfirmarEmailContent() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [msg, setMsg] = useState('Confirmando...');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!token) { setMsg('Token não encontrado.'); return; }
    api.get<{ message: string }>(`/auth/confirmar-email?token=${token}`)
      .then(d => { setMsg(d.message); setOk(true); })
      .catch(e => setMsg(e.message));
  }, [token]);

  return (
    <div className="bg-gray-900 rounded-xl p-8 text-center max-w-sm space-y-4">
      <p className={ok ? 'text-green-400' : 'text-gray-300'}>{msg}</p>
      {ok && <Link href="/login" className="text-yellow-400 hover:underline block">Ir para login</Link>}
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
