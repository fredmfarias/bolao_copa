import { render, screen } from '@testing-library/react';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';

const svgPath = '/flags/BRA.svg';

it('renderiza a bandeira com o alt do país', () => {
  render(<SelecaoAvatar nome="Brasil" bandeiraSvg={svgPath} />);
  expect(screen.getByRole('img', { name: 'Brasil' })).toBeInTheDocument();
});

it('aplica classe de tamanho md por padrão', () => {
  render(<SelecaoAvatar nome="Brasil" bandeiraSvg={svgPath} />);
  expect(screen.getByRole('img', { name: 'Brasil' })).toHaveClass('w-10');
});

it('aplica classe de tamanho lg quando size="lg"', () => {
  render(<SelecaoAvatar nome="Brasil" bandeiraSvg={svgPath} size="lg" />);
  expect(screen.getByRole('img', { name: 'Brasil' })).toHaveClass('w-16');
});

it('usa o src correto', () => {
  render(<SelecaoAvatar nome="Brasil" bandeiraSvg={svgPath} />);
  expect(screen.getByRole('img', { name: 'Brasil' })).toHaveAttribute('src', '/flags/BRA.svg');
});
