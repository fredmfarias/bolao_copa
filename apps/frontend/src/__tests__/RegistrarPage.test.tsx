import { render, screen } from '@testing-library/react';
import RegistrarPage from '@/app/(auth)/registrar/page';

const mockGetParam = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: mockGetParam }),
}));

jest.mock('@/lib/api', () => ({
  api: { post: jest.fn() },
}));

beforeEach(() => {
  mockGetParam.mockReturnValue(null);
});

it('renderiza formulário quando convite está na URL', () => {
  mockGetParam.mockReturnValue('token-abc');
  render(<RegistrarPage />);
  expect(screen.getByRole('button', { name: /cadastrar/i })).toBeInTheDocument();
});

it('exibe mensagem de sem convite quando convite está ausente', () => {
  render(<RegistrarPage />);
  expect(
    screen.getByText(/você precisa de um convite para criar uma conta/i),
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /cadastrar/i })).not.toBeInTheDocument();
});
