'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { BottomNav } from '@/components/BottomNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-trovao-muted text-sm">Carregando...</span>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <main className="max-w-lg mx-auto w-full px-4 pt-6 pb-24">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
