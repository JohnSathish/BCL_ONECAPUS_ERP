'use client';

import type { CellSelection, CompletionProgramme } from '@/types/curriculum-completion';
import { STATUS_STYLES } from '@/types/curriculum-completion';
import { CompletionCellBadge } from './completion-cell-badge';

type Props = {
  programmes: CompletionProgramme[];
  highlightedSemester?: number | null;
  onSelectCell: (selection: CellSelection) => void;
};

export function CompletionMatrix({ programmes, highlightedSemester, onSelectCell }: Props) {
  if (!programmes.length) {
    return (
      <p className="text-sm text-muted-foreground">No programmes match the current filters.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[960px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left font-medium">
              Programme
            </th>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <th
                key={sem}
                className={`px-2 py-2 text-left font-medium ${
                  highlightedSemester === sem ? 'bg-primary/10 text-primary' : ''
                }`}
              >
                Sem {sem}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {programmes.map((programme) => (
            <tr key={programme.programVersionId} className="border-b border-border/60">
              <td className="sticky left-0 z-10 bg-background px-3 py-2 align-top">
                <div>
                  <p className="font-medium">{programme.programCode}</p>
                  <p className="text-[10px] text-muted-foreground">
                    v{programme.version} · {programme.overallStatus.replace('_', ' ')}
                  </p>
                </div>
              </td>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => {
                const semester = programme.semesters.find((s) => s.semesterSequence === sem);
                if (!semester) {
                  return (
                    <td key={sem} className="px-2 py-2 align-top text-muted-foreground">
                      —
                    </td>
                  );
                }
                return (
                  <td
                    key={sem}
                    className={`px-2 py-2 align-top ${
                      highlightedSemester === sem ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="mb-1">
                      <span
                        className={`rounded border px-1 py-0.5 text-[9px] uppercase ${STATUS_STYLES[semester.semesterStatus]}`}
                      >
                        {semester.semesterStatus.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {semester.cells.map((cell) => (
                        <div key={cell.category} className="flex flex-col gap-0.5">
                          <span className="text-[9px] text-muted-foreground">{cell.category}</span>
                          <CompletionCellBadge
                            cell={cell}
                            compact
                            onClick={() =>
                              onSelectCell({
                                programVersionId: programme.programVersionId,
                                programCode: programme.programCode,
                                semesterSequence: sem,
                                category: cell.category,
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
