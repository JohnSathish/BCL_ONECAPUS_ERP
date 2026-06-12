'use client';

import { Input } from '@/components/ui/input';
import type { SupportDataFieldDef } from '@/types/support-data';

type Props = {
  fields: SupportDataFieldDef[];
  form: Record<string, unknown>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  isEdit?: boolean;
};

export function CategoryFieldRenderer({ fields, form, setForm, isEdit }: Props) {
  return (
    <div className="grid gap-3">
      {fields.map((field) => {
        if (field.key === 'code' && isEdit) {
          return (
            <label key={field.key} className="grid gap-1 text-sm">
              <span className="font-medium">{field.label}</span>
              <Input value={String(form.code ?? '')} disabled className="font-mono text-xs" />
            </label>
          );
        }

        if (field.type === 'select' && field.options) {
          return (
            <label key={field.key} className="grid gap-1 text-sm">
              <span className="font-medium">
                {field.label}
                {field.required ? ' *' : ''}
              </span>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={String(form[field.key] ?? '')}
                onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
              >
                <option value="">Select…</option>
                {field.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        if (field.type === 'status' && field.options) {
          return (
            <label key={field.key} className="grid gap-1 text-sm">
              <span className="font-medium">{field.label}</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={String(form.status ?? form[field.key] ?? 'ACTIVE')}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value, [field.key]: e.target.value }))
                }
              >
                {field.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        if (field.type === 'number') {
          return (
            <label key={field.key} className="grid gap-1 text-sm">
              <span className="font-medium">{field.label}</span>
              <Input
                type="number"
                value={String(form[field.key] ?? 0)}
                onChange={(e) => setForm((f) => ({ ...f, [field.key]: Number(e.target.value) }))}
              />
            </label>
          );
        }

        if (field.type === 'color') {
          return (
            <label key={field.key} className="grid gap-1 text-sm">
              <span className="font-medium">{field.label}</span>
              <Input
                type="color"
                value={String(form.color ?? '#22c55e')}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              />
            </label>
          );
        }

        return (
          <label key={field.key} className="grid gap-1 text-sm">
            <span className="font-medium">
              {field.label}
              {field.required ? ' *' : ''}
            </span>
            <Input
              value={String(form[field.key] ?? (field.key === 'label' ? form.label : '') ?? '')}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  [field.key]: e.target.value,
                  ...(field.key === 'label' || field.key === 'subjectName'
                    ? { label: e.target.value }
                    : {}),
                  ...(field.key === 'subjectCode' ? { code: e.target.value } : {}),
                }))
              }
              placeholder={
                field.key === 'code' || field.key === 'subjectCode' ? 'UNIQUE_CODE' : undefined
              }
            />
          </label>
        );
      })}
    </div>
  );
}
