import { render, screen, fireEvent } from '@testing-library/react';
import { AdminPublicarDialog } from '@/components/AdminPublicarDialog';
import type { JogoPendente } from '@/types/api';

const jogos: JogoPendente[] = [
  {
    id: 'j1', dataHora: new Date().toISOString(), rodada: 1, fase: 'OITAVAS',
    pesoPontuacao: 2, placarCasa: 2, placarVisitante: 1,
    selecaoCasa:      { nome: 'Brasil',    codigo: 'BRA', bandeiraSvg: '<svg></svg>' },
    selecaoVisitante: { nome: 'Argentina', codigo: 'ARG', bandeiraSvg: '<svg></svg>' },
  },
  {
    id: 'j2', dataHora: new Date().toISOString(), rodada: 1, fase: 'OITAVAS',
    pesoPontuacao: 1, placarCasa: 0, placarVisitante: 0,
    selecaoCasa:      { nome: 'Espanha', codigo: 'ESP', bandeiraSvg: '<svg></svg>' },
    selecaoVisitante: { nome: 'Portugal', codigo: 'POR', bandeiraSvg: '<svg></svg>' },
  },
];

it('quando open=true, mostra título com contagem e cada jogo', () => {
  render(<AdminPublicarDialog open={true} jogos={jogos} onCancel={jest.fn()} onConfirm={jest.fn()} />);
  expect(screen.getByText(/Confirmar publicação · 2 jogos/i)).toBeInTheDocument();
  expect(screen.getByText('BRA')).toBeInTheDocument();
  expect(screen.getByText('ARG')).toBeInTheDocument();
  expect(screen.getByText('2 × 1')).toBeInTheDocument();
  expect(screen.getByText('×2')).toBeInTheDocument();
  expect(screen.getByText('×1')).toBeInTheDocument(); // peso sempre exibido
});

it('chama onConfirm ao clicar em Publicar', () => {
  const onConfirm = jest.fn();
  render(<AdminPublicarDialog open={true} jogos={jogos} onCancel={jest.fn()} onConfirm={onConfirm} />);
  fireEvent.click(screen.getByRole('button', { name: /publicar/i }));
  expect(onConfirm).toHaveBeenCalled();
});

it('Publicar fica disabled e mostra "Publicando..." quando publicando=true', () => {
  render(<AdminPublicarDialog open={true} jogos={jogos} publicando={true} onCancel={jest.fn()} onConfirm={jest.fn()} />);
  expect(screen.getByRole('button', { name: /publicando/i })).toBeDisabled();
});
