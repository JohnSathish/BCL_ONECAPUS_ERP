'use client';

type Option = { value: string; label: string };

type Props = {
  category: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  loading?: boolean;
};

export function SupportDataSelect({
  category,
  value,
  onChange,
  options,
  disabled,
  placeholder = 'Select…',
  className,
  loading,
}: Props) {
  return (
    <select
      className={className}
      value={value}
      disabled={disabled || loading}
      aria-label={category}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{loading ? 'Loading…' : placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
