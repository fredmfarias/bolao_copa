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

beforeEach(() => {
  mockPush.mockClear();
  mockGetParam.mockImplementation((key: string) => {
    if (key === 'redirect') return null;
    if (key === 'emailConfirmado') return null;
    if (key === 'erro') return null;
    return null;
  });
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

it('exibe o logo do Bolão Trovão', () => {
  render(<LoginPage />);
  const logo = screen.getByAltText('Bolão Trovão');
  expect(logo).toBeInTheDocument();
});
