'use client';

import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { useRouter } from 'next/navigation';

export function NavBar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/jogos" className="text-yellow-400 font-bold text-lg">⚡ Bolão Trovão</Link>
        <Link href="/jogos" className="text-gray-300 hover:text-white text-sm">Jogos</Link>
        <Link href="/boloes" className="text-gray-300 hover:text-white text-sm">Bolões</Link>
      </div>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <Link href="/perfil" className="text-gray-300 hover:text-white text-sm">{user.nome}</Link>
            <button onClick={handleLogout} className="text-gray-400 hover:text-white text-sm">Sair</button>
          </>
        ) : (
          <Link href="/login" className="text-yellow-400 hover:text-yellow-300 text-sm">Entrar</Link>
        )}
      </div>
    </nav>
  );
}
