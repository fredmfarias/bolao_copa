import { render } from '@testing-library/react';
import { PageSkeleton } from '@/components/PageSkeleton';

it('renderiza barras de skeleton animadas', () => {
  const { container } = render(<PageSkeleton />);
  expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
});

it('renderiza múltiplas barras de placeholder', () => {
  const { container } = render(<PageSkeleton />);
  const bars = container.querySelectorAll('.bg-trovao-surface');
  expect(bars.length).toBeGreaterThanOrEqual(3);
});
