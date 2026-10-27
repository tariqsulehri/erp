import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormDialog } from '@/components/ui/FormDialog';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SummaryCard } from '@/components/ui/SummaryCard';

function renderDialog(props: Partial<Parameters<typeof FormDialog>[0]> = {}) {
  const onSave = jest.fn();
  const onCancel = jest.fn();
  const utils = render(
    <FormDialog open title="Create Fiscal Year" onSave={onSave} onCancel={onCancel} {...props}>
      <label>Name<input /></label>
    </FormDialog>,
  );
  return { onSave, onCancel, ...utils };
}

describe('FormDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<FormDialog open={false} title="X" onSave={jest.fn()} onCancel={jest.fn()}><input /></FormDialog>);
    expect(container).toBeEmptyDOMElement();
  });

  it('is a labelled modal dialog that focuses the first field', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Create Fiscal Year' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('Name')).toHaveFocus();
  });

  it('saves on the Save button and on Enter', () => {
    const { onSave } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.submit(screen.getByRole('dialog'));
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('cancels on Cancel, the close button, Escape, and the backdrop', () => {
    const { onCancel, container } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close Create Fiscal Year' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseDown(container.querySelector('.dialog-backdrop') as Element);
    expect(onCancel).toHaveBeenCalledTimes(4);
  });

  it('blocks saving and cancelling while it saves', () => {
    const { onSave, onCancel } = renderDialog({ saving: true });
    fireEvent.submit(screen.getByRole('dialog'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('does not save when saving is disabled', () => {
    const { onSave } = renderDialog({ saveDisabled: true });
    fireEvent.submit(screen.getByRole('dialog'));
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('ScreenHeader and SummaryCard', () => {
  it('shows the title, badge, description, and aside', () => {
    render(<ScreenHeader icon={<svg />} title="Fiscal Years" badge={<span>Accounting Calendar</span>} description="Years and periods." aside={<button type="button">Search</button>} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Fiscal Years' })).toBeInTheDocument();
    expect(screen.getByText('Accounting Calendar')).toBeInTheDocument();
    expect(screen.getByText('Years and periods.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('shows the label, value, detail, and tone', () => {
    const { container } = render(<SummaryCard icon={<svg />} tone="amber" label="Total Fiscal Years" value="3 Configured" detail="2 open" />);
    expect(screen.getByText('Total Fiscal Years')).toBeInTheDocument();
    expect(screen.getByText('3 Configured')).toBeInTheDocument();
    expect(screen.getByText('2 open')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('summary-card', 'tone-amber');
  });
});
