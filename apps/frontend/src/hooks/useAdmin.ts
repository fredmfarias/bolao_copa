import { useAuth } from '@/components/AuthProvider';

export function useAdmin() {
  const { user } = useAuth();
  return { isAdmin: user?.role === 'ADMIN' };
}
