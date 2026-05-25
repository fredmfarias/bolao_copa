import { render, screen, waitFor } from '@testing-library/react';
import ConfirmarEmailPage from '@/app/auth/confirmar-email/page';

const mockPush = jest.fn();
const mockGetParam = jest.fn().mockReturnValue('valid-token');

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: mockGetParam }),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));

import { api } from '@/lib/api';

beforeEach(() => {
  mockPush.mockClear();
  mockGetParam.mockReturnValue('valid-token');
  (api.get as jest.Mock).mockClear();
});

it('redireciona para /login?emailConfirmado=true após confirmação com sucesso', async () => {
  (api.get as jest.Mock).mockResolvedValue({ message: 'E-mail confirmado.' });
  render(<ConfirmarEmailPage />);
  await waitFor(() =>
    expect(mockPush).toHaveBeenCalledWith('/login?emailConfirmado=true'),
  );
});

it('exibe mensagem de erro e não redireciona se token for inválido', async () => {
  (api.get as jest.Mock).mockRejectedValue(new Error('Token inválido ou expirado.'));
  render(<ConfirmarEmailPage />);
  await waitFor(() =>
    expect(screen.getByText('Token inválido ou expirado.')).toBeInTheDocument(),
  );
  expect(mockPush).not.toHaveBeenCalled();
});

it('exibe "Token não encontrado." e não redireciona se token estiver ausente', async () => {
  mockGetParam.mockReturnValue(null);
  render(<ConfirmarEmailPage />);
  await waitFor(() =>
    expect(screen.getByText('Token não encontrado.')).toBeInTheDocument(),
  );
  expect(mockPush).not.toHaveBeenCalled();
  expect(api.get).not.toHaveBeenCalled();
});
