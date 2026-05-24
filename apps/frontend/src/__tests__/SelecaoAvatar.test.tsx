import { render, screen } from '@testing-library/react';
import { SelecaoAvatar } from '@/components/SelecaoAvatar';

const svgMock = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="green"/></svg>';

it('renderiza o container com o title do país', () => {
  render(<SelecaoAvatar nome="Brasil" bandeiraSvg={svgMock} />);
  expect(screen.getByTitle('Brasil')).toBeInTheDocument();
});

it('aplica classe de tamanho md por padrão', () => {
  render(<SelecaoAvatar nome="Brasil" bandeiraSvg={svgMock} />);
  expect(screen.getByTitle('Brasil')).toHaveClass('w-10');
});

it('aplica classe de tamanho lg quando size="lg"', () => {
  render(<SelecaoAvatar nome="Brasil" bandeiraSvg={svgMock} size="lg" />);
  expect(screen.getByTitle('Brasil')).toHaveClass('w-16');
});
