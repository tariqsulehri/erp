'use client';

import type { CSSProperties, InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { sanitizeMoneyInput } from '@/lib/erp-utils';
import { FieldLabel } from './FieldLabel';

type FieldSize = 'compact' | 'normal';

interface BaseFieldProps {
  label: string;
  value: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  style?: CSSProperties;
  size?: FieldSize;
  /** Short help text shown under the field. */
  hint?: string;
}

interface TextFieldProps extends BaseFieldProps {
  onChange?: (value: string) => void;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'disabled' | 'placeholder'>;
}

interface NumericFieldProps extends BaseFieldProps {
  decimalPlaces?: number;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'disabled' | 'placeholder' | 'inputMode'>;
}

interface SelectFieldProps extends BaseFieldProps {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  onChange?: (value: string) => void;
  selectProps?: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange' | 'disabled'>;
}

export function TextField({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder,
  style,
  size = 'compact',
  inputProps,
  hint,
}: TextFieldProps) {
  return (
    <FieldLabel label={label} required={required}>
      <input
        {...inputProps}
        className="form-input"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={event => onChange?.(event.currentTarget.value)}
        style={{ ...fieldStyle(size), ...style }}
      />
      {hint && <span className="form-hint" style={{ display: 'block' }}>{hint}</span>}
    </FieldLabel>
  );
}

export function DateField(props: Omit<TextFieldProps, 'inputProps'>) {
  return (
    <TextField
      {...props}
      inputProps={{ type: 'date' }}
      style={{ ...dateFieldStyle(props.size ?? 'compact'), ...props.style }}
    />
  );
}

export function NumericField({
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  decimalPlaces = 2,
  required = false,
  disabled = false,
  placeholder,
  style,
  size = 'compact',
  inputProps,
  hint,
}: NumericFieldProps) {
  return (
    <FieldLabel label={label} required={required}>
      <input
        {...inputProps}
        className="form-input"
        inputMode="decimal"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={event => {
          event.currentTarget.select();
          onFocus?.();
        }}
        onBlur={onBlur}
        onChange={event => onChange?.(sanitizeMoneyInput(event.currentTarget.value, decimalPlaces))}
        style={{ ...numericFieldStyle(size), ...style }}
      />
      {hint && <span className="form-hint" style={{ display: 'block' }}>{hint}</span>}
    </FieldLabel>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  required = false,
  disabled = false,
  placeholder,
  style,
  size = 'compact',
  selectProps,
}: SelectFieldProps) {
  return (
    <FieldLabel label={label} required={required}>
      <select
        {...selectProps}
        className="form-input"
        value={value}
        disabled={disabled}
        onChange={event => onChange?.(event.currentTarget.value)}
        style={{ ...selectFieldStyle(size), ...style }}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map(option => (
          <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
        ))}
      </select>
    </FieldLabel>
  );
}

export function fieldStyle(size: FieldSize = 'compact'): CSSProperties {
  const height = size === 'compact' ? 'var(--control-h)' : 'var(--control-h-lg)';
  return {
    height,
    minHeight: height,
    padding: '0 10px',
    fontSize: size === 'compact' ? 'var(--font-size-sm)' : 'var(--font-size-md)',
  };
}

export function numericFieldStyle(size: FieldSize = 'compact'): CSSProperties {
  return {
    ...fieldStyle(size),
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 500,
  };
}

// Chevron comes from the shared select.form-input rule in globals.css.
export function selectFieldStyle(size: FieldSize = 'compact'): CSSProperties {
  return {
    ...fieldStyle(size),
    paddingRight: 32,
  };
}

export function dateFieldStyle(size: FieldSize = 'compact'): CSSProperties {
  return {
    ...fieldStyle(size),
    padding: '0 6px 0 10px',
  };
}

interface TextareaFieldProps extends BaseFieldProps {
  rows?: number;
  maxLength?: number;
  onChange?: (value: string) => void;
}

export function TextareaField({ label, value, onChange, required = false, disabled = false, placeholder, style, rows = 3, maxLength }: TextareaFieldProps) {
  return (
    <FieldLabel label={label} required={required}>
      <textarea
        className="form-input"
        value={value}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        onChange={event => onChange?.(event.currentTarget.value)}
        style={style}
      />
    </FieldLabel>
  );
}

/** Yes/No field for forms. Use a checkbox, not a toggle switch, so it saves with the form. */
export function CheckboxField({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <label className="check-field">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.currentTarget.checked)} />
      {label}
    </label>
  );
}
