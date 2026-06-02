import { render, screen } from '@testing-library/react';
import RegulamentoPage from '@/app/regulamento/page';

const mockGet = jest.fn();

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: mockGet }),
}));

beforeEach(() => {
  mockGet.mockReturnValue(null);
});

it('Voltar aponta para /login por padrão (sem from)', () => {
  render(<RegulamentoPage />);
  const link = screen.getByRole('link', { name: /voltar/i });
  expect(link).toHaveAttribute('href', '/login');
});

it('Voltar aponta para a origem informada em from', () => {
  mockGet.mockImplementation((key: string) =>
    key === 'from' ? '/convite/ABC123' : null,
  );
  render(<RegulamentoPage />);
  const link = screen.getByRole('link', { name: /voltar/i });
  expect(link).toHaveAttribute('href', '/convite/ABC123');
});
