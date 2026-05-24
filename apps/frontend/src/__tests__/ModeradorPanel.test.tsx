import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModeradorPanel } from '@/components/ModeradorPanel';
import type { BolaoMembro } from '@/types/api';

jest.mock('@/lib/api', () => ({ api: { post: jest.fn().mockResolvedValue({}) } }));
import { api } from '@/lib/api';
const mockPost = api.post as jest.Mock;

const membros: BolaoMembro[] = [
  { id: 'm1', usuarioId: 'u1', papel: 'PARTICIPANTE', usuario: { id: 'u1', nome: 'Alice', avatarUrl: null } },
  { id: 'm2', usuarioId: 'u2', papel: 'MODERADOR',    usuario: { id: 'u2', nome: 'Bob',   avatarUrl: null } },
];

beforeEach(() => mockPost.mockClear());

it('exibe lista de membros', () => {
  render(<ModeradorPanel bolaoId="b1" membros={membros} onAtualizado={jest.fn()} />);
  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.getByText('Bob')).toBeInTheDocument();
});

it('botão remover chama POST /boloes/:id/remover/:userId', async () => {
  const onAtualizado = jest.fn();
  render(<ModeradorPanel bolaoId="b1" membros={membros} onAtualizado={onAtualizado} />);
  fireEvent.click(screen.getAllByRole('button', { name: /remover/i })[0]);
  await waitFor(() => {
    expect(mockPost).toHaveBeenCalledWith('/boloes/b1/remover/u1');
    expect(onAtualizado).toHaveBeenCalled();
  });
});
