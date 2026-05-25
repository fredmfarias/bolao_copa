'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { AdminTopNav } from '@/components/AdminTopNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role !== 'ADMIN') router.replace('/jogos');
  }, [user, loading, router]);

  if (loading || user?.role !== 'ADMIN') return null;

  return (
    <div className="min-h-screen bg-trovao-base">
      <AdminTopNav />
      <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
