import { render, screen } from '@testing-library/react';
import { AproveitamentoFases } from '@/components/estatisticas/AproveitamentoFases';

describe('AproveitamentoFases', () => {
  it('não renderiza nada sem fases', () => {
    const { container } = render(<AproveitamentoFases fases={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza fase com rótulo amigável, aproveitamento e melhor da fase', () => {
    render(
      <AproveitamentoFases
        fases={[
          {
            fase: 'GRUPOS',
            aproveitamento: 42,
            melhor: { usuarios: [{ id: 'u1', nome: 'Ana', avatarUrl: null }], pontos: 120 },
          },
          { fase: 'OITAVAS', aproveitamento: 30, melhor: null },
        ]}
      />,
    );
    expect(screen.getByText('Grupos')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText(/Ana/)).toBeInTheDocument();
    expect(screen.getByText('Oitavas')).toBeInTheDocument();
  });
});
