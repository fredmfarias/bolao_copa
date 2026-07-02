// apps/frontend/src/__tests__/EstatisticasPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EstatisticasPage from '@/app/(app)/boloes/[id]/estatisticas/page';
import { api } from '@/lib/api';
import type { EstatisticasBolao } from '@/types/api';

jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'bolao-1' }) }));
jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  } as any;
});

const apiGet = api.get as jest.Mock;
const u = (id: string, nome: string) => ({ id, nome, avatarUrl: null });

const payload: EstatisticasBolao = {
  temDados: true,
  ultimaPublicacao: { numero: 3, publicadoEm: '2026-06-28T12:00:00Z' },
  posicoes: {
    reiDaLideranca: [{ valor: 2, usuarios: [u('u1', 'Ana')] }],
    lanterna: [],
    foguete: { valor: 7, registros: [{ usuario: u('u2', 'Bruno'), publicacao: 2 }] },
    quedaLivre: null,
    maisRegular: null,
    top5: [],
  },
  recordes: {
    maiorPontuacaoRodada: null,
    rodadaGenerosa: { publicacao: 2, media: 14 },
    rodadaAvara: { publicacao: 1, media: 7.5 },
    reiDoPlacarExato: [],
    aproveitamentoPorFase: [],
  },
  palpites: {
    placaresMaisApostados: [{ placar: '2x1', quantidade: 40 }],
    jogoConsensual: null,
    jogoDividido: null,
    otimista: null,
    pessimista: null,
    mediaRealGols: null,
    ultimaHora: null,
    precavido: null,
    reenvios: [],
    empates: { percentualApostas: 12, percentualJogos: 18 },
    esquecidos: [],
  },
  zebras: {
    zebra: { jogo: 'A x B', percentualPontuaram: 10 },
    previsivel: null,
    acertosSolitarios: [{ jogo: 'C x D', usuario: u('u1', 'Ana'), placar: '3x2' }],
  },
};

function mockRespostas(estatisticas: unknown) {
  apiGet.mockImplementation((path: string) =>
    path.includes('estatisticas')
      ? Promise.resolve(estatisticas)
      : Promise.resolve({ id: 'bolao-1', nome: 'Bolão da Firma' }),
  );
}

describe('EstatisticasPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renderiza seções e cards com dados', async () => {
    mockRespostas(payload);
    render(<EstatisticasPage />);
    expect(await screen.findByText(/Posições/)).toBeInTheDocument();
    expect(screen.getByText('Bolão da Firma')).toBeInTheDocument();
    expect(screen.getByText(/dados até a rodada 3/i)).toBeInTheDocument();
    expect(screen.getByText('Rei da liderança')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText(/zebra da copa/i)).toBeInTheDocument();
  });

  it('omite cards nulos', async () => {
    mockRespostas(payload);
    render(<EstatisticasPage />);
    await screen.findByText(/Posições/);
    expect(screen.queryByText(/queda livre/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mais regular/i)).not.toBeInTheDocument();
  });

  it('mostra estado vazio quando temDados é false', async () => {
    mockRespostas({ temDados: false });
    render(<EstatisticasPage />);
    expect(
      await screen.findByText(/aparecem após a primeira rodada publicada/i),
    ).toBeInTheDocument();
  });

  it('mostra erro com retry e refaz a busca ao clicar', async () => {
    apiGet.mockRejectedValue(new Error('boom'));
    render(<EstatisticasPage />);
    const botao = await screen.findByRole('button', { name: /tentar novamente/i });
    mockRespostas(payload);
    await userEvent.click(botao);
    await waitFor(() => expect(screen.getByText('Rei da liderança')).toBeInTheDocument());
  });
});
