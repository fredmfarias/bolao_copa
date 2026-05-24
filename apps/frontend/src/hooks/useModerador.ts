import { useAuth } from '@/components/AuthProvider';

interface Membro {
  usuarioId: string;
  papel: 'MODERADOR' | 'PARTICIPANTE';
}

export function useModerador(membros: Membro[]) {
  const { user } = useAuth();
  const membro = membros.find(m => m.usuarioId === user?.id);
  return { isModerador: membro?.papel === 'MODERADOR' };
}
