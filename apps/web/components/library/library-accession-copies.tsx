'use client';

import { COPY_TYPES, COPY_TYPE_LABELS, type CopyType } from './library-copy-rules';

export type DraftCopy = {
  key: string;
  copyType: CopyType;
  issueAllowed: boolean;
  location: string;
  condition: string;
  availability: string;
  remarks: string;
  selected: boolean;
  custom: boolean;
};

const CONDITIONS = [
  ['NEW', 'New'],
  ['GOOD', 'Good'],
  ['FAIR', 'Fair'],
  ['DAMAGED', 'Damaged'],
] as const;

const AVAILABILITY = [
  ['RECEIVED', 'Received'],
  ['CATALOGUED', 'Catalogued'],
  ['ON_SHELF', 'On shelf'],
  ['ISSUED', 'Issued'],
  ['LOST', 'Lost'],
  ['DAMAGED', 'Damaged'],
  ['WITHDRAWN', 'Withdrawn'],
] as const;

export function AccessionCopyTable({
  rows,
  numbers,
  issueFor,
  onChange,
  onRemove,
}: {
  rows: DraftCopy[];
  numbers: string[];
  issueFor: (type: CopyType) => boolean;
  onChange: (rows: DraftCopy[]) => void;
  onRemove: (key: string) => void;
}) {
  const selected = rows.filter((row) => row.selected);
  const allSelected = rows.length > 0 && selected.length === rows.length;

  function patch(key: string, change: Partial<DraftCopy>, custom = true) {
    onChange(
      rows.map((row) =>
        row.key === key ? { ...row, ...change, custom: custom || row.custom } : row,
      ),
    );
  }

  function patchSelected(change: Partial<DraftCopy>) {
    onChange(rows.map((row) => (row.selected ? { ...row, ...change, custom: true } : row)));
  }

  function applyAll(change: Partial<DraftCopy>) {
    onChange(rows.map((row) => ({ ...row, ...change, custom: true })));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Set selected type</span>
          <select
            className="h-9 rounded-md border border-slate-200 px-2 text-sm"
            defaultValue=""
            onChange={(event) => {
              const value = event.target.value as CopyType;
              if (!value) return;
              patchSelected({ copyType: value });
              event.target.value = '';
            }}
            disabled={!selected.length}
          >
            <option value="">Copy type</option>
            {COPY_TYPES.map((type) => (
              <option key={type} value={type}>
                {COPY_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Set selected shelf</span>
          <input
            className="h-9 rounded-md border border-slate-200 px-2 text-sm"
            placeholder="Shelf / rack"
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (!value || !selected.length) return;
              patchSelected({ location: value });
              event.target.value = '';
            }}
            disabled={!selected.length}
          />
        </label>
        <button
          type="button"
          className="h-9 rounded-md border border-slate-200 px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          disabled={!rows.length}
          onClick={() => {
            const first = rows[0];
            applyAll({
              copyType: first.copyType,
              issueAllowed: first.issueAllowed,
              location: first.location,
              condition: first.condition,
              availability: first.availability,
            });
          }}
        >
          Apply first copy to all
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) =>
                    onChange(rows.map((row) => ({ ...row, selected: event.target.checked })))
                  }
                  aria-label="Select all copies"
                />
              </th>
              <th className="px-2 py-2">Copy</th>
              <th className="px-2 py-2">Accession</th>
              <th className="px-2 py-2">Barcode</th>
              <th className="px-2 py-2">Copy type</th>
              <th className="px-2 py-2">Issue</th>
              <th className="px-2 py-2">Shelf</th>
              <th className="px-2 py-2">Condition</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Remarks</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.key} className="border-t align-top">
                <td className="px-2 py-2">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={(event) => patch(row.key, { selected: event.target.checked }, false)}
                    aria-label={`Select copy ${index + 1}`}
                  />
                </td>
                <td className="px-2 py-2 text-slate-500">{index + 1}</td>
                <td className="px-2 py-2 font-mono text-xs">
                  {numbers[index] || 'Assigned on save'}
                </td>
                <td className="px-2 py-2 font-mono text-xs">
                  {numbers[index] || 'Same as accession'}
                </td>
                <td className="px-2 py-2">
                  <select
                    className="h-9 w-36 rounded-md border border-slate-200 px-2"
                    value={row.copyType}
                    onChange={(event) => {
                      const copyType = event.target.value as CopyType;
                      patch(row.key, { copyType, issueAllowed: issueFor(copyType) });
                    }}
                  >
                    {COPY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {COPY_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <select
                    className="h-9 w-32 rounded-md border border-slate-200 px-2"
                    value={row.issueAllowed ? 'yes' : 'no'}
                    onChange={(event) =>
                      patch(row.key, { issueAllowed: event.target.value === 'yes' })
                    }
                  >
                    <option value="yes">Allowed</option>
                    <option value="no">Not allowed</option>
                  </select>
                </td>
                <td className="px-2 py-2">
                  <input
                    className="h-9 w-28 rounded-md border border-slate-200 px-2"
                    value={row.location}
                    onChange={(event) => patch(row.key, { location: event.target.value })}
                  />
                </td>
                <td className="px-2 py-2">
                  <select
                    className="h-9 rounded-md border border-slate-200 px-2"
                    value={row.condition}
                    onChange={(event) => patch(row.key, { condition: event.target.value })}
                  >
                    {CONDITIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <select
                    className="h-9 rounded-md border border-slate-200 px-2"
                    value={row.availability}
                    onChange={(event) => patch(row.key, { availability: event.target.value })}
                  >
                    {AVAILABILITY.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <input
                    className="h-9 w-36 rounded-md border border-slate-200 px-2"
                    value={row.remarks}
                    onChange={(event) => patch(row.key, { remarks: event.target.value })}
                  />
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    className="text-xs text-rose-700 hover:underline"
                    onClick={() => onRemove(row.key)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Accession numbers and barcodes are reserved when you save. Removing a row only drops it
        before submission. One copy can be Reference and not issuable while the others stay General.
      </p>
    </div>
  );
}
