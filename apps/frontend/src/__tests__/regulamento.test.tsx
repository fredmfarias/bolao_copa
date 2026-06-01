import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegulamentoPage from '@/app/regulamento/page';

Object.assign(navigator, {
  clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
});

describe('RegulamentoPage', () => {
  it('renders all four accordion section titles', () => {
    render(<RegulamentoPage />);
    expect(screen.getByText('Disposições Gerais')).toBeInTheDocument();
    expect(screen.getByText('Valor e Pagamento')).toBeInTheDocument();
    expect(screen.getByText('Sistema de Pontuação')).toBeInTheDocument();
    expect(screen.getByText('Premiação')).toBeInTheDocument();
  });

  it('copy button copies PIX code and shows "Copiado!" feedback', async () => {
    render(<RegulamentoPage />);

    await userEvent.click(screen.getByText('Valor e Pagamento'));

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /copiar/i }));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('00020126730014BR.GOV.BCB.PIX')
    );
    expect(screen.getByRole('button', { name: /copiado/i })).toBeInTheDocument();
  });
});
