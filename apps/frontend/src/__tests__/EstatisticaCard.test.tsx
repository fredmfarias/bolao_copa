import { render, screen } from '@testing-library/react';
import { EstatisticaCard } from '@/components/estatisticas/EstatisticaCard';

const u = (id: string, nome: string) => ({ id, nome, avatarUrl: null });

describe('EstatisticaCard', () => {
  it('renderiza título, legenda, usuários e valor', () => {
    render(
      <EstatisticaCard
        icone="👑"
        titulo="Rei da liderança"
        legenda="Rodadas terminadas em 1º lugar"
        destaque={{ usuarios: [u('u1', 'Ana')], valor: '4 rodadas' }}
      />,
    );
    expect(screen.getByText('Rei da liderança')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('4 rodadas')).toBeInTheDocument();
    expect(screen.getByText('Rodadas terminadas em 1º lugar')).toBeInTheDocument();
  });

  it('mostra até 3 empatados e resume o excedente', () => {
    render(
      <EstatisticaCard
        icone="🏅"
        titulo="Top 5"
        legenda="x"
        destaque={{
          usuarios: [u('a', 'Ana'), u('b', 'Bia'), u('c', 'Caio'), u('d', 'Duda')],
          valor: '3',
        }}
      />,
    );
    expect(screen.getByText('Caio')).toBeInTheDocument();
    expect(screen.queryByText('Duda')).not.toBeInTheDocument();
    expect(screen.getByText('e mais 1')).toBeInTheDocument();
  });

  it('renderiza linha com texto no lugar de usuários e linhas secundárias', () => {
    render(
      <EstatisticaCard
        icone="🦓"
        titulo="A zebra da Copa"
        legenda="x"
        destaque={{ texto: 'Brasil x França', valor: '12%' }}
        secundarios={[{ texto: 'Empates reais', valor: '18%' }]}
      />,
    );
    expect(screen.getByText('Brasil x França')).toBeInTheDocument();
    expect(screen.getByText('Empates reais')).toBeInTheDocument();
  });
});
