'use client';

type ShiftOption = { id: string; label: string; code?: string };

type Props = {
  options: ShiftOption[];
  primaryShiftId: string;
  additionalShiftIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

export function ShiftMultiSelect({
  options,
  primaryShiftId,
  additionalShiftIds,
  onChange,
  disabled,
}: Props) {
  const extraOptions = options.filter((o) => o.id !== primaryShiftId);

  const toggle = (id: string) => {
    if (disabled) return;
    if (additionalShiftIds.includes(id)) {
      onChange(additionalShiftIds.filter((x) => x !== id));
    } else {
      onChange([...additionalShiftIds, id]);
    }
  };

  if (extraOptions.length === 0) {
    return <p className="text-xs text-muted-foreground">No other shifts available</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {extraOptions.map((shift) => (
        <label key={shift.id} className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="rounded border-input"
            checked={additionalShiftIds.includes(shift.id)}
            disabled={disabled}
            onChange={() => toggle(shift.id)}
          />
          <span>
            {shift.code ? `${shift.code} — ` : ''}
            {shift.label}
          </span>
        </label>
      ))}
    </div>
  );
}
