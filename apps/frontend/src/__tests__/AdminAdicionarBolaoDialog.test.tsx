import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminAdicionarBolaoDialog } from '@/components/AdminAdicionarBolaoDialog';

jest.mock('@/lib/api', () => ({
  api: {
    post: jest.fn().mockResolvedValue({ message: 'Usuário adicionado ao bolão.' }),
    get: jest.fn().mockResolvedValue([{ id: 'b1', nome: 'Liga Trovão' }]),
  },
}));
import { api } from '@/lib/api';
const mockPost = api.post as jest.Mock;
const mockGet = api.get as jest.Mock;

beforeEach(() => {
  mockPost.mockClear();
  mockGet.mockClear();
});

it('submete POST /admin/boloes/:id/membros após selecionar bolão', async () => {
  const onAdicionado = jest.fn();
  render(<AdminAdicionarBolaoDialog open usuarioId="u1" onOpenChange={jest.fn()} onAdicionado={onAdicionado} />);

  fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'Liga' } });
  await waitFor(() => expect(screen.getByText('Liga Trovão')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Liga Trovão'));

  fireEvent.click(screen.getByRole('button', { name: /adicionar/i }));

  await waitFor(() => {
    expect(mockPost).toHaveBeenCalledWith('/admin/boloes/b1/membros', { usuarioId: 'u1' });
    expect(onAdicionado).toHaveBeenCalled();
  });
});
