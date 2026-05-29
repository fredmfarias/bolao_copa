import { render, screen } from '@testing-library/react';
import LoginPage from '@/app/(auth)/login/page';

const mockPush = jest.fn();
const mockGetParam = jest.fn();

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: mockGetParam }),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ login: jest.fn() }),
}));

jest.mock('@/hooks/useInscricaoStatus', () => ({
  useInscricaoStatus: jest.fn(),
}));
import { useInscricaoStatus } from '@/hooks/useInscricaoStatus';
const mockUseInscricao = useInscricaoStatus as jest.Mock;

beforeEach(() => {
  mockPush.mockClear();
  mockGetParam.mockImplementation((key: string) => {
    if (key === 'redirect') return null;
    if (key === 'emailConfirmado') return null;
    if (key === 'erro') return null;
    return null;
  });
  mockUseInscricao.mockReturnValue({ abertas: true, loading: false });
});

it('não exibe banner verde quando emailConfirmado está ausente', () => {
  render(<LoginPage />);
  expect(
    screen.queryByText(/e-mail verificado com sucesso/i),
  ).not.toBeInTheDocument();
});

it('exibe banner verde quando emailConfirmado=true está na URL', () => {
  mockGetParam.mockImplementation((key: string) => {
    if (key === 'emailConfirmado') return 'true';
    return null;
  });
  render(<LoginPage />);
  expect(
    screen.getByText('E-mail verificado com sucesso! Faça login para continuar.'),
  ).toBeInTheDocument();
});

it('exibe link "Criar conta" como link ativo quando inscrições abertas', () => {
  render(<LoginPage />);
  const link = screen.getByText('Criar conta');
  expect(link.closest('a')).toHaveAttribute('href', '/registrar');
});

it('exibe "Cadastros encerrados" desabilitado quando inscrições fechadas', () => {
  mockUseInscricao.mockReturnValue({ abertas: false, loading: false });
  render(<LoginPage />);
  expect(screen.getByText('Cadastros encerrados')).toBeInTheDocument();
  expect(screen.queryByText('Criar conta')).not.toBeInTheDocument();
});

it('exibe banner de erro quando ?erro=cadastros-encerrados', () => {
  mockGetParam.mockImplementation((key: string) => {
    if (key === 'erro') return 'cadastros-encerrados';
    return null;
  });
  render(<LoginPage />);
  expect(
    screen.getByText(/cadastros encerrados a 2h do início da copa/i),
  ).toBeInTheDocument();
});
