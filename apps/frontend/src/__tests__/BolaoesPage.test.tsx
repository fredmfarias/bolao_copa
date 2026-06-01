import { render, screen, waitFor } from '@testing-library/react';
import BolaoesPage from '@/app/(app)/boloes/page';

const GLOBAL_ID = '00000000-0000-0000-0000-000000000001';

const mockApiGet = jest.fn();

jest.mock('@/lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args) },
}));

jest.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { bolaoFavoritoId: null }, refresh: jest.fn() }),
}));

jest.mock('@/components/BolaoCard', () => ({
  BolaoCard: ({ bolao }: { bolao: { nome: string } }) => <div>{bolao.nome}</div>,
}));

beforeEach(() => {
  mockApiGet.mockResolvedValue([]);
});

it('exibe banner quando usuário tem apenas o bolão global', async () => {
  mockApiGet.mockResolvedValue([
    { id: GLOBAL_ID, nome: 'Global', status: 'ATIVO', precoReais: '0', _count: { membros: 1 }, maxParticipantes: 100 },
  ]);
  render(<BolaoesPage />);
  await waitFor(() =>
    expect(
      screen.getByText(/você ainda não participa de nenhum bolão privado/i),
    ).toBeInTheDocument(),
  );
});

it('não exibe banner quando usuário tem bolões reais além do global', async () => {
  mockApiGet.mockResolvedValue([
    { id: GLOBAL_ID, nome: 'Global', status: 'ATIVO', precoReais: '0', _count: { membros: 1 }, maxParticipantes: 100 },
    { id: 'bolao-2', nome: 'Bolão Real', status: 'ATIVO', precoReais: '10', _count: { membros: 5 }, maxParticipantes: 20 },
  ]);
  render(<BolaoesPage />);
  await waitFor(() => screen.getByText('Bolão Real'));
  expect(
    screen.queryByText(/você ainda não participa de nenhum bolão privado/i),
  ).not.toBeInTheDocument();
});

it('não exibe banner durante carregamento', () => {
  mockApiGet.mockReturnValue(new Promise(() => {})); // never resolves
  render(<BolaoesPage />);
  expect(
    screen.queryByText(/você ainda não participa de nenhum bolão privado/i),
  ).not.toBeInTheDocument();
});
