import { render, screen } from '@testing-library/react';
import AppLayout from '@/app/(app)/layout';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/boloes',
}));

jest.mock('@/components/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '@/components/AuthProvider';
const mockUseAuth = useAuth as jest.Mock;

beforeEach(() => {
  mockPush.mockClear();
});

it('renderiza BottomNav durante auth loading', () => {
  mockUseAuth.mockReturnValue({ user: null, loading: true });
  render(<AppLayout><div>conteudo</div></AppLayout>);
  expect(screen.getByText('Jogos')).toBeInTheDocument();
  expect(screen.queryByText('conteudo')).not.toBeInTheDocument();
});

it('renderiza conteúdo e BottomNav quando usuário está autenticado', () => {
  mockUseAuth.mockReturnValue({
    user: { role: 'USER', bolaoFavoritoId: null },
    loading: false,
  });
  render(<AppLayout><div>conteudo</div></AppLayout>);
  expect(screen.getByText('Jogos')).toBeInTheDocument();
  expect(screen.getByText('conteudo')).toBeInTheDocument();
});

it('não renderiza nada quando loading=false e user=null', () => {
  mockUseAuth.mockReturnValue({ user: null, loading: false });
  const { container } = render(<AppLayout><div>conteudo</div></AppLayout>);
  expect(screen.queryByText('Jogos')).not.toBeInTheDocument();
  expect(container).toBeEmptyDOMElement();
});
