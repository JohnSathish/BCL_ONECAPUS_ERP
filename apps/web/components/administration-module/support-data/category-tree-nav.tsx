'use client';

import type { SupportDataGroup } from '@/types/support-data';

type Props = {
  groups: SupportDataGroup[];
  selected: string;
  onSelect: (code: string) => void;
};

export function CategoryTreeNav({ groups, selected, onSelect }: Props) {
  return (
    <nav className="space-y-4">
      {groups.map((group) => (
        <div key={group.code}>
          <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.categories.map((cat) => (
              <li key={cat.code}>
                <button
                  type="button"
                  onClick={() => onSelect(cat.code)}
                  className={`w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                    selected === cat.code ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  {cat.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
