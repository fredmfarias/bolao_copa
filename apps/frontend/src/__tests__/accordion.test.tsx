import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
} from '@/components/ui/accordion';

describe('Accordion', () => {
  it('renders trigger text', () => {
    render(
      <Accordion>
        <AccordionItem value="a">
          <AccordionTrigger>Título</AccordionTrigger>
          <AccordionPanel>Conteúdo</AccordionPanel>
        </AccordionItem>
      </Accordion>
    );
    expect(screen.getByText('Título')).toBeInTheDocument();
  });

  it('shows panel content when trigger is clicked', async () => {
    render(
      <Accordion>
        <AccordionItem value="a">
          <AccordionTrigger>Título</AccordionTrigger>
          <AccordionPanel>Conteúdo</AccordionPanel>
        </AccordionItem>
      </Accordion>
    );
    await userEvent.click(screen.getByText('Título'));
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });
});
