import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminUsuarioRow } from '@/components/AdminUsuarioRow';

jest.mock('@/lib/api', () => ({ api: { patch: jest.fn().mockResolvedValue({ role: 'ADMIN' }) } }));
import { api } from '@/lib/api';
const mockPatch = api.patch as jest.Mock;

const usuario = { id: 'u1', nome: 'Alice', email: 'alice@test.com', role: 'USER' as const, avatarUrl: null, criadoEm: '' };

beforeEach(() => mockPatch.mockClear());

it('exibe nome e email do usuário', () => {
  render(<AdminUsuarioRow usuario={usuario} onAtualizado={jest.fn()} />);
  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.getByText('alice@test.com')).toBeInTheDocument();
});

it('botão promover chama PATCH com role ADMIN', async () => {
  const onAtualizado = jest.fn();
  render(<AdminUsuarioRow usuario={usuario} onAtualizado={onAtualizado} />);
  fireEvent.click(screen.getByRole('button', { name: /admin/i }));
  await waitFor(() => {
    expect(mockPatch).toHaveBeenCalledWith('/admin/usuarios/u1', { role: 'ADMIN' });
    expect(onAtualizado).toHaveBeenCalledTimes(1);
  });
});
