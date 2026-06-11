import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConvitePage from '@/app/convite/[codigo]/page';

const mockPush = jest.fn();
const mockLogout = jest.fn().mockResolvedValue(undefined);
const mockApiGet = jest.fn();
const mockApiPost = jest.fn();

let mockUser: { email: string } | null = { email: 'pessoa@gmail.com' };

jest.mock('next/navigation', () => ({
  useParams: () => ({ codigo: 'tok-123' }),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: mockUser, loading: false, logout: mockLogout }),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

jest.mock('@/components/PageSkeleton', () => ({
  PageSkeleton: () => <div>carregando</div>,
}));

const conviteValido = {
  valido: true,
  bolaoAtivo: true,
  bolaoId: 'bolao-b',
  bolaoNome: 'Bolão da Firma',
  descricao: null,
  criadorNome: 'Fred',
  expiraEm: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { email: 'pessoa@gmail.com' };
  mockApiGet.mockResolvedValue(conviteValido);
});

it('mostra o e-mail da conta logada no estado pronto', async () => {
  render(<ConvitePage />);
  expect(
    await screen.findByText(/logado como pessoa@gmail\.com/i),
  ).toBeInTheDocument();
});

it('botão "Trocar de conta" chama logout', async () => {
  render(<ConvitePage />);
  const botao = await screen.findByRole('button', { name: /trocar de conta/i });
  await userEvent.click(botao);
  expect(mockLogout).toHaveBeenCalled();
});

it('exibe link do Regulamento com origem do convite (estado pronto)', async () => {
  render(<ConvitePage />);
  const link = await screen.findByRole('link', { name: /regulamento/i });
  expect(link).toHaveAttribute('href', '/regulamento?from=/convite/tok-123');
});

it('exibe link do Regulamento no estado não-autenticado', async () => {
  mockUser = null;
  render(<ConvitePage />);
  const link = await screen.findByRole('link', { name: /regulamento/i });
  expect(link).toHaveAttribute('href', '/regulamento?from=/convite/tok-123');
});

it('exibe botão desabilitado e mensagem quando o bolão está inativo', async () => {
  mockApiGet.mockResolvedValue({ ...conviteValido, bolaoAtivo: false });
  render(<ConvitePage />);
  const botao = await screen.findByRole('button', { name: /entrar no bolão/i });
  expect(botao).toBeDisabled();
  expect(screen.getByText(/desativado e não está aceitando novos participantes/i)).toBeInTheDocument();
});

it('mostra o nome do bolão no estado inativo', async () => {
  mockApiGet.mockResolvedValue({ ...conviteValido, bolaoAtivo: false });
  render(<ConvitePage />);
  expect(await screen.findByText('Bolão da Firma')).toBeInTheDocument();
});

it('não chama a API de entrar quando o bolão está inativo', async () => {
  mockApiGet.mockResolvedValue({ ...conviteValido, bolaoAtivo: false });
  render(<ConvitePage />);
  const botao = await screen.findByRole('button', { name: /entrar no bolão/i });
  await userEvent.click(botao);
  expect(mockApiPost).not.toHaveBeenCalled();
});
