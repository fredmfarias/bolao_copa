import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModeradorPanel } from '@/components/ModeradorPanel';
import type { BolaoMembro } from '@/types/api';

jest.mock('@/lib/api', () => ({
  api: {
    post: jest.fn().mockResolvedValue({}),
    patch: jest.fn().mockResolvedValue({}),
  },
}));
import { api } from '@/lib/api';
const mockPost = api.post as jest.Mock;
const mockPatch = api.patch as jest.Mock;

const membros: BolaoMembro[] = [
  { id: 'm1', usuarioId: 'u1', papel: 'PARTICIPANTE', statusPagamento: 'PENDENTE', usuario: { id: 'u1', nome: 'Alice', avatarUrl: null } },
  { id: 'm2', usuarioId: 'u2', papel: 'MODERADOR',    statusPagamento: 'PAGO',     usuario: { id: 'u2', nome: 'Bob',   avatarUrl: null } },
];

const membrosDesordenados: BolaoMembro[] = [
  { id: 'm1', usuarioId: 'u1', papel: 'PARTICIPANTE', statusPagamento: 'PENDENTE', usuario: { id: 'u1', nome: 'Carlos', avatarUrl: null } },
  { id: 'm2', usuarioId: 'u2', papel: 'PARTICIPANTE', statusPagamento: 'PENDENTE', usuario: { id: 'u2', nome: 'Ana',    avatarUrl: null } },
  { id: 'm3', usuarioId: 'u3', papel: 'PARTICIPANTE', statusPagamento: 'PENDENTE', usuario: { id: 'u3', nome: 'Bruno',  avatarUrl: null } },
];

beforeEach(() => { mockPost.mockClear(); mockPatch.mockClear(); });

it('exibe lista de membros', () => {
  render(<ModeradorPanel bolaoId="b1" membros={membros} onAtualizado={jest.fn()} />);
  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.getByText('Bob')).toBeInTheDocument();
});

it('marca moderador com a tag "Mod" e não exibe tag "Membro" para participantes', () => {
  render(<ModeradorPanel bolaoId="b1" membros={membros} onAtualizado={jest.fn()} />);
  expect(screen.getByText('Mod')).toBeInTheDocument();
  expect(screen.queryByText('Membro')).not.toBeInTheDocument();
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

it('badge Pendente chama PATCH para PAGO e notifica onAtualizado', async () => {
  const onAtualizado = jest.fn();
  render(<ModeradorPanel bolaoId="b1" membros={membros} onAtualizado={onAtualizado} />);
  fireEvent.click(screen.getByText('Pendente'));
  await waitFor(() => {
    expect(mockPatch).toHaveBeenCalledWith('/boloes/b1/membros/u1/pagamento', { status: 'PAGO' });
    expect(onAtualizado).toHaveBeenCalled();
  });
});

it('badge Pago chama PATCH para PENDENTE e notifica onAtualizado', async () => {
  const onAtualizado = jest.fn();
  render(<ModeradorPanel bolaoId="b1" membros={membros} onAtualizado={onAtualizado} />);
  fireEvent.click(screen.getByText('Pago'));
  await waitFor(() => {
    expect(mockPatch).toHaveBeenCalledWith('/boloes/b1/membros/u2/pagamento', { status: 'PENDENTE' });
    expect(onAtualizado).toHaveBeenCalled();
  });
});

it('exibe membros em ordem alfabética', () => {
  render(<ModeradorPanel bolaoId="b1" membros={membrosDesordenados} onAtualizado={jest.fn()} />);
  const nomes = screen.getAllByText(/Ana|Bruno|Carlos/).map(el => el.textContent);
  expect(nomes).toEqual(['Ana', 'Bruno', 'Carlos']);
});

it('filtra membros pela busca por nome', () => {
  render(<ModeradorPanel bolaoId="b1" membros={membrosDesordenados} onAtualizado={jest.fn()} />);
  fireEvent.change(screen.getByPlaceholderText('Buscar membro por nome'), { target: { value: 'bru' } });
  expect(screen.getByText('Bruno')).toBeInTheDocument();
  expect(screen.queryByText('Ana')).not.toBeInTheDocument();
  expect(screen.queryByText('Carlos')).not.toBeInTheDocument();
});

it('exibe mensagem quando a busca não encontra membros', () => {
  render(<ModeradorPanel bolaoId="b1" membros={membrosDesordenados} onAtualizado={jest.fn()} />);
  fireEvent.change(screen.getByPlaceholderText('Buscar membro por nome'), { target: { value: 'zzz' } });
  expect(screen.getByText('Nenhum membro corresponde à busca.')).toBeInTheDocument();
});
