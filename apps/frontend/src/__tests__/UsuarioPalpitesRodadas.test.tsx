import { render, screen } from '@testing-library/react';
import { UsuarioPalpitesRodadas } from '@/components/UsuarioPalpitesRodadas';
import type { UsuarioPalpitesRodada } from '@/types/api';

const grupos: UsuarioPalpitesRodada[] = [
  {
    publicacao: { numero: 2, publicadoEm: '2026-05-26T12:00:00.000Z' },
    items: [
      {
        jogo: {
          id: 'j1', dataHora: '2026-05-25T16:00:00.000Z',
          pesoPontuacao: 1, placarCasa: 2, placarVisitante: 1,
          selecaoCasa:      { nome: 'Brasil',    codigo: 'BRA', bandeiraSvg: '<svg></svg>' },
          selecaoVisitante: { nome: 'Argentina', codigo: 'ARG', bandeiraSvg: '<svg></svg>' },
        },
        palpite: { placarCasa: 2, placarVisitante: 1 },
        pontuacao: 6,
      },
    ],
  },
];

it('renderiza uma seção por publicação com a data e os palpites', () => {
  render(<UsuarioPalpitesRodadas grupos={grupos} />);
  expect(screen.getByText('26/05/2026')).toBeInTheDocument();
  expect(screen.getByText('BRA')).toBeInTheDocument();
  expect(screen.getByText('+6 pts')).toBeInTheDocument();
});

it('mostra empty state quando não há grupos', () => {
  render(<UsuarioPalpitesRodadas grupos={[]} />);
  expect(screen.getByText(/nenhum palpite/i)).toBeInTheDocument();
});
