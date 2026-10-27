'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconCalendarStats, IconInfoCircle } from '@tabler/icons-react';
import { fiscalYearsQueryKey, useCreateFiscalYear } from '@/lib/api/fiscal-years';
import { formatDate, type AppFormatSettingsSource } from '@/lib/app-settings';
import { DateField, SelectField, TextField } from '@/components/ui/FormFields';
import { FormDialog } from '@/components/ui/FormDialog';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PERIOD_COUNT_OPTIONS, YEAR_BASIS_OPTIONS, basisDates, previewPeriods, type YearBasis } from './fiscal-year-rules';

const EMPTY_FORM = {
  fiscal_year: '',
  year_basis: 'july' as YearBasis,
  start_date: '',
  end_date: '',
  number_of_periods: '12',
  posting_cutoff_days: '5',
};

/** Create a fiscal year: the dates follow the year basis, and the periods it will create are previewed. */
export function CreateFiscalYearDialog({ open, settings, onClose, onCreated }: {
  open: boolean;
  settings?: AppFormatSettingsSource | null;
  onClose: () => void;
  onCreated?: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const createMutation = useCreateFiscalYear();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) { setForm(EMPTY_FORM); setError(''); setTouched(false); }
  }, [open]);

  const preview = useMemo(
    () => previewPeriods(form.start_date, form.end_date, Number(form.number_of_periods)),
    [form.start_date, form.end_date, form.number_of_periods],
  );
  const cutoff = Number(form.posting_cutoff_days);
  const nameError = touched && !form.fiscal_year.trim() ? 'Enter a Fiscal Year Name.' : undefined;
  const cutoffError = !Number.isInteger(cutoff) || cutoff < 0 || cutoff > 60 ? 'Enter a whole number from 0 to 60.' : undefined;

  function update(changes: Partial<typeof EMPTY_FORM>) {
    setForm(current => {
      const next = { ...current, ...changes };
      // Name or basis changes fill the dates; typed dates are kept until then.
      if (changes.fiscal_year !== undefined || changes.year_basis !== undefined) {
        const dates = basisDates(next.year_basis, next.fiscal_year);
        if (dates) Object.assign(next, dates);
      }
      return next;
    });
  }

  function save() {
    setTouched(true);
    setError('');
    if (!form.fiscal_year.trim() || preview.problem || cutoffError) return;
    createMutation.mutate(
      {
        fiscal_year: form.fiscal_year.trim(),
        year_basis: form.year_basis,
        start_date: form.start_date,
        end_date: form.end_date,
        number_of_periods: Number(form.number_of_periods),
        posting_cutoff_days: cutoff,
      },
      {
        onSuccess: result => {
          queryClient.invalidateQueries({ queryKey: fiscalYearsQueryKey });
          onCreated?.(result?.message ?? `Fiscal Year ${form.fiscal_year.trim()} created.`);
          onClose();
        },
        onError: mutationError => setError(mutationError.message),
      },
    );
  }

  const first = preview.periods[0];
  const last = preview.periods[preview.periods.length - 1];

  return (
    <FormDialog
      open={open}
      title="Create Fiscal Year"
      saveLabel="Save"
      saving={createMutation.isPending}
      onSave={save}
      onCancel={onClose}
    >
      <div className="form-dialog-info">
        <IconInfoCircle size={18} stroke={1.8} aria-hidden />
        <div>
          <strong>About Fiscal Years</strong>
          <p>A Fiscal Year splits your accounting year into Periods (for example, months). You can post vouchers only into an open Period of an open year. Only one year can be Active.</p>
        </div>
      </div>

      {error && <InlineAlert tone="danger">{error}</InlineAlert>}

      <div className="form-dialog-grid form-dialog-grid-2">
        <TextField
          label="Fiscal Year Name"
          required
          value={form.fiscal_year}
          onChange={value => update({ fiscal_year: value })}
          placeholder="For example 2026-2027"
          hint="Shown on reports. Each year needs a different name."
          error={nameError}
        />
        <SelectField
          label="Year Basis"
          required
          value={form.year_basis}
          options={YEAR_BASIS_OPTIONS}
          onChange={value => update({ year_basis: value as YearBasis })}
        />
      </div>

      <div className="form-dialog-grid form-dialog-grid-3">
        <DateField label="Start Date" required value={form.start_date} onChange={value => update({ start_date: value })} />
        <DateField label="End Date" required value={form.end_date} onChange={value => update({ end_date: value })} />
        <SelectField
          label="Number Of Periods"
          required
          value={form.number_of_periods}
          options={PERIOD_COUNT_OPTIONS}
          onChange={value => update({ number_of_periods: value })}
        />
        <TextField
          label="Late Entry Days"
          value={form.posting_cutoff_days}
          onChange={value => update({ posting_cutoff_days: value.replace(/[^0-9]/g, '') })}
          inputProps={{ inputMode: 'numeric', maxLength: 2 }}
          style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
          hint="Days after a period ends when late entries are still allowed."
          error={cutoffError}
        />
      </div>

      <div className="form-dialog-options" aria-live="polite">
        <div className="form-dialog-option-head">
          <IconCalendarStats size={16} stroke={1.8} aria-hidden />
          <strong>Periods That Will Be Created</strong>
        </div>
        {preview.problem ? (
          <p className="form-dialog-option-problem">{preview.problem}</p>
        ) : first && last ? (
          <>
            <p className="form-dialog-option-text">
              {`${preview.periods.length} ${preview.periods.length === 1 ? 'period' : 'periods'}, from ${formatDate(first.start_date, settings)} to ${formatDate(last.end_date, settings)}.`}
            </p>
            <ol className="period-chips">
              {preview.periods.map(period => (
                <li key={period.number} title={`${formatDate(period.start_date, settings)} – ${formatDate(period.end_date, settings)}`}>
                  <span>{period.number}</span>
                  {formatDate(period.start_date, settings)}
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </div>
    </FormDialog>
  );
}
