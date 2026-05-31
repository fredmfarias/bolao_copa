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

  if (!loading && !user) return null;

  return (
    <div className="min-h-screen overflow-x-hidden">
      <main className="max-w-lg mx-auto w-full px-4 pt-6 pb-24">
        {loading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <span className="text-trovao-muted text-sm">Carregando...</span>
          </div>
        ) : (
          children
        )}
      </main>
      <BottomNav />
    </div>
  );
}
