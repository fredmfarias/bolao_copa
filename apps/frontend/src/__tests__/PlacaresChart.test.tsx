import { render } from '@testing-library/react';
import { PlacaresChart } from '@/components/estatisticas/PlacaresChart';

// Recharts usa ResizeObserver e dimensões; mockar para jsdom (mesmo padrão de RankingEvolucao).
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  } as any;
});

describe('PlacaresChart', () => {
  it('não renderiza nada sem dados', () => {
    const { container } = render(<PlacaresChart dados={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza o gráfico quando há placares', () => {
    const { container, getByText } = render(
      <PlacaresChart dados={[{ placar: '2x1', quantidade: 40 }, { placar: '1x0', quantidade: 25 }]} />,
    );
    expect(getByText(/placares mais apostados/i)).toBeInTheDocument();
    expect(container.querySelector('.recharts-responsive-container')).toBeTruthy();
  });
});
