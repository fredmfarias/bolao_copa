import { render, screen } from '@testing-library/react';
import RegistrarPage from '@/app/(auth)/registrar/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/hooks/useInscricaoStatus', () => ({
  useInscricaoStatus: jest.fn(),
}));
import { useInscricaoStatus } from '@/hooks/useInscricaoStatus';
const mockUseInscricao = useInscricaoStatus as jest.Mock;

beforeEach(() => {
  mockUseInscricao.mockReturnValue({ abertas: true, loading: false });
});

it('renderiza formulário quando inscrições abertas', () => {
  render(<RegistrarPage />);
  expect(screen.getByRole('button', { name: /cadastrar/i })).toBeInTheDocument();
});

it('renderiza mensagem de encerrado quando inscrições fechadas', () => {
  mockUseInscricao.mockReturnValue({ abertas: false, loading: false });
  render(<RegistrarPage />);
  expect(
    screen.getByText(/cadastros encerrados a 2h do início da copa/i),
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /cadastrar/i })).not.toBeInTheDocument();
});
