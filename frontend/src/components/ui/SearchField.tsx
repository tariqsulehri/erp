import { IconSearch } from '@tabler/icons-react';

/** Search box with a leading icon. Pressing Enter runs onSubmit when provided. */
export function SearchField({ value, onChange, onSubmit, placeholder, label }: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="search-field">
      <IconSearch size={15} stroke={1.8} aria-hidden />
      <input
        className="form-input"
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={event => onChange(event.currentTarget.value)}
        onKeyDown={event => { if (event.key === 'Enter') onSubmit?.(); }}
      />
    </div>
  );
}
