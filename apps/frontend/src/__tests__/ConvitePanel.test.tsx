import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConvitePanel } from '@/components/ConvitePanel';

jest.mock('@/lib/api', () => ({
  api: { post: jest.fn().mockResolvedValue({ token: 'abc123' }) },
}));

Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });

it('exibe botão de gerar convite', () => {
  render(<ConvitePanel bolaoId="b1" />);
  expect(screen.getByRole('button', { name: /gerar/i })).toBeInTheDocument();
});

it('gera convite e exibe link ao clicar', async () => {
  render(<ConvitePanel bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button', { name: /gerar/i }));
  expect(await screen.findByText(/abc123/)).toBeInTheDocument();
});

it('copia link ao clicar no botão copiar', async () => {
  render(<ConvitePanel bolaoId="b1" />);
  fireEvent.click(screen.getByRole('button', { name: /gerar/i }));
  await screen.findByText(/abc123/);
  fireEvent.click(screen.getByRole('button', { name: /copiar/i }));
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
});
