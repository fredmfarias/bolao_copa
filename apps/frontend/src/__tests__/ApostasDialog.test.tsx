import { render, screen } from '@testing-library/react';
import { ApostasDialog } from '@/components/ApostasDialog';
import type { Jogo } from '@/types/api';

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn().mockResolvedValue([
      { usuarioId: 'u1', nome: 'Alice', avatarUrl: null, placarCasa: 2, placarVisitante: 1, pontuacao: 10 },
      { usuarioId: 'u2', nome: 'Bob',   avatarUrl: null, placarCasa: 1, placarVisitante: 1, pontuacao: 0  },
    ]),
  },
}));

const selecao = (nome: string) => ({ id: nome, nome, codigo: nome.slice(0, 3).toUpperCase(), bandeiraSvg: '<svg/>' });

const jogo: Jogo = {
  id: 'j1', rodada: 1, grupo: 'A', fase: 'GRUPOS',
  placarCasa: 2, placarVisitante: 1, pesoPontuacao: 1, publicacaoId: null,
  dataHora: new Date().toISOString(),
  selecaoCasa: selecao('Brasil'), selecaoVisitante: selecao('Argentina'),
};

it('exibe nomes dos apostadores após carregar', async () => {
  render(<ApostasDialog jogo={jogo} bolaoId="b1" aberto onFechar={jest.fn()} />);
  expect(await screen.findByText('Alice')).toBeInTheDocument();
  expect(await screen.findByText('Bob')).toBeInTheDocument();
});

it('exibe os palpites dos apostadores', async () => {
  render(<ApostasDialog jogo={jogo} bolaoId="b1" aberto onFechar={jest.fn()} />);
  expect(await screen.findByText('2 × 1')).toBeInTheDocument();
  expect(await screen.findByText('1 × 1')).toBeInTheDocument();
});
