import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminCriarUsuarioDialog } from '@/components/AdminCriarUsuarioDialog';

jest.mock('@/lib/api', () => ({
  api: {
    post: jest.fn().mockResolvedValue({ id: 'novo-1', nome: 'X', email: 'x@x.com' }),
    get: jest.fn().mockResolvedValue([]),
  },
}));
import { api } from '@/lib/api';
const mockPost = api.post as jest.Mock;

beforeEach(() => mockPost.mockClear());

it('submete POST /admin/usuarios com nome, email e senhaTemp', async () => {
  const onCriado = jest.fn();
  render(<AdminCriarUsuarioDialog open onOpenChange={jest.fn()} onCriado={onCriado} />);

  fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Alice' } });
  fireEvent.change(screen.getByLabelText(/^e-mail$/i), { target: { value: 'a@a.com' } });
  fireEvent.change(screen.getByLabelText(/senha tempor/i), { target: { value: 'senha12345' } });

  fireEvent.click(screen.getByRole('button', { name: /criar/i }));

  await waitFor(() => {
    expect(mockPost).toHaveBeenCalledWith('/admin/usuarios', {
      nome: 'Alice',
      email: 'a@a.com',
      senhaTemp: 'senha12345',
    });
    expect(onCriado).toHaveBeenCalled();
  });
});

it('exibe erro quando POST falha', async () => {
  mockPost.mockRejectedValueOnce(new Error('E-mail já cadastrado.'));
  render(<AdminCriarUsuarioDialog open onOpenChange={jest.fn()} onCriado={jest.fn()} />);

  fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Alice' } });
  fireEvent.change(screen.getByLabelText(/^e-mail$/i), { target: { value: 'a@a.com' } });
  fireEvent.change(screen.getByLabelText(/senha tempor/i), { target: { value: 'senha12345' } });

  fireEvent.click(screen.getByRole('button', { name: /criar/i }));

  await waitFor(() => {
    expect(screen.getByText('E-mail já cadastrado.')).toBeInTheDocument();
  });
});
