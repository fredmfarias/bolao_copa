import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '@/components/EmptyState';

it('renderiza o título obrigatório', () => {
  render(<EmptyState titulo="Nenhum jogo encontrado" />);
  expect(screen.getByText('Nenhum jogo encontrado')).toBeInTheDocument();
});

it('renderiza descrição quando fornecida', () => {
  render(<EmptyState titulo="Vazio" descricao="Tente novamente mais tarde" />);
  expect(screen.getByText('Tente novamente mais tarde')).toBeInTheDocument();
});

it('chama onClick ao clicar na ação', async () => {
  const onClick = jest.fn();
  render(<EmptyState titulo="Vazio" acao={{ label: 'Criar bolão', onClick }} />);
  await userEvent.click(screen.getByText('Criar bolão'));
  expect(onClick).toHaveBeenCalledTimes(1);
});

it('não renderiza botão quando acao não é fornecida', () => {
  render(<EmptyState titulo="Vazio" />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
