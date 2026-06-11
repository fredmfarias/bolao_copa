import { render, screen } from '@testing-library/react';
import { PalpiteRow } from '@/components/PalpiteRow';
import type { Palpite, Jogo } from '@/types/api';

const jogo = {
  selecaoCasa: { nome: 'Brasil', codigo: 'BRA', bandeiraSvg: 'bra.svg' },
  selecaoVisitante: { nome: 'Argentina', codigo: 'ARG', bandeiraSvg: 'arg.svg' },
} as unknown as Jogo;

const palpite: Palpite = {
  usuarioId: 'u1', nome: 'Diego', avatarUrl: null,
  placarCasa: 2, placarVisitante: 1, pontuacao: 7,
};

it('exibe nome, placar e pontuação', () => {
  render(<PalpiteRow palpite={palpite} jogo={jogo} isMe={false} />);
  expect(screen.getByText('Diego')).toBeInTheDocument();
  expect(screen.getByText('2 × 1')).toBeInTheDocument();
  expect(screen.getByText('+7')).toBeInTheDocument();
});

it('sem posição, não mostra número nem cor metálica', () => {
  const { container } = render(<PalpiteRow palpite={palpite} jogo={jogo} isMe={false} />);
  expect(screen.queryByText('1º')).not.toBeInTheDocument();
  expect((container.firstChild as HTMLElement).className).toMatch('border-trovao-border');
});

it.each([[1, 'gold'], [2, 'silver'], [3, 'bronze']])(
  'posição %iº usa a cor %s na borda e no número',
  (posicao, metal) => {
    const { container } = render(
      <PalpiteRow palpite={palpite} jogo={jogo} posicao={posicao} isMe={false} />,
    );
    expect((container.firstChild as HTMLElement).className).toMatch(`border-trovao-${metal}`);
    expect(screen.getByText(`${posicao}º`).className).toMatch(`text-trovao-${metal}`);
  },
);

it('posição fora do top 5 mostra o número sem cor metálica', () => {
  render(<PalpiteRow palpite={palpite} jogo={jogo} posicao={7} isMe={false} />);
  expect(screen.getByText('7º').className).toMatch('text-trovao-muted');
});

it('destaca o próprio usuário com ring dourado', () => {
  const { container } = render(<PalpiteRow palpite={palpite} jogo={jogo} posicao={2} isMe />);
  expect((container.firstChild as HTMLElement).className).toMatch('ring-trovao-gold');
});
