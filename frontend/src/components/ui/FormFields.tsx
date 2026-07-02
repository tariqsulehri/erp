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
  options: Array<{ value: string; label: string }>;
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
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </FieldLabel>
  );
}

export function fieldStyle(size: FieldSize = 'compact'): CSSProperties {
  return {
    height: size === 'compact' ? 28 : 34,
    minHeight: size === 'compact' ? 28 : 34,
    padding: size === 'compact' ? '3px 8px' : '5px 10px',
    fontSize: size === 'compact' ? '0.76rem' : '0.84rem',
  };
}

export function numericFieldStyle(size: FieldSize = 'compact'): CSSProperties {
  return {
    ...fieldStyle(size),
    textAlign: 'right',
    fontFamily: 'var(--font-mono)',
    fontWeight: 800,
  };
}

export function selectFieldStyle(size: FieldSize = 'compact'): CSSProperties {
  return {
    ...fieldStyle(size),
    paddingRight: 34,
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundColor: 'var(--color-input-bg)',
    backgroundImage: [
      'linear-gradient(45deg, transparent 50%, var(--color-text-muted) 50%)',
      'linear-gradient(135deg, var(--color-text-muted) 50%, transparent 50%)',
    ].join(', '),
    backgroundPosition: 'calc(100% - 17px) 50%, calc(100% - 12px) 50%',
    backgroundSize: '5px 5px, 5px 5px',
    backgroundRepeat: 'no-repeat',
  };
}

export function dateFieldStyle(size: FieldSize = 'compact'): CSSProperties {
  return {
    ...fieldStyle(size),
    padding: size === 'compact' ? '3px 2px 3px 5px' : '5px 4px 5px 8px',
    fontSize: size === 'compact' ? '0.72rem' : '0.8rem',
  };
}
