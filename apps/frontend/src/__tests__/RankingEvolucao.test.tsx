import { render, screen } from '@testing-library/react';
import { RankingEvolucao } from '@/components/RankingEvolucao';

// Recharts usa ResizeObserver e dimensões; mockar para jsdom.
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  } as any;
});

describe('RankingEvolucao', () => {
  it('mostra estado vazio quando sem dados', () => {
    render(<RankingEvolucao dados={[]} />);
    expect(screen.getByText(/sem hist[oó]rico/i)).toBeInTheDocument();
  });

  it('renderiza o gráfico quando há pontos', () => {
    const { container } = render(
      <RankingEvolucao dados={[{ numero: 1, posicao: 5 }, { numero: 2, posicao: 2 }]} />,
    );
    // Recharts renderiza um container com a classe recharts-responsive-container
    expect(container.querySelector('.recharts-responsive-container')).toBeTruthy();
  });
});
