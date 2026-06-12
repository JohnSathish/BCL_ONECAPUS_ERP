'use client';

import { Input } from '@/components/ui/input';
import {
  categoriesForRule,
  computeSemesterTotals,
  DEFAULT_SEMESTER_CREDIT_TARGET,
  isCategoryMandatory,
  NEP_CATEGORIES,
  type RuleDraft,
} from './structure-types';

type SemesterRuleEditorProps = {
  rules: RuleDraft[];
  onUpdateCount: (sem: number, cat: string, value: number) => void;
  onUpdateContinuity: (sem: number, cat: string, value: string) => void;
  onUpdateCredit: (sem: number, cat: string, value: number) => void;
  onUpdateMandatory: (sem: number, cat: string, value: boolean) => void;
};

export function SemesterRuleEditor({
  rules,
  onUpdateCount,
  onUpdateContinuity,
  onUpdateCredit,
  onUpdateMandatory,
}: SemesterRuleEditorProps) {
  return (
    <div className="space-y-4">
      {rules.map((rule) => {
        const categories = categoriesForRule(rule).filter(
          (cat) =>
            (rule.categoryCounts[cat] ?? 0) > 0 || Object.keys(rule.categoryCounts).length === 0,
        );
        const totals = computeSemesterTotals(rule);
        const target = rule.semesterCreditTarget ?? DEFAULT_SEMESTER_CREDIT_TARGET;
        const totalsValid = totals.credits === target;

        return (
          <div key={rule.semesterSequence} className="rounded-md border border-border p-3 text-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">Semester {rule.semesterSequence}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md bg-muted px-2 py-1">Papers: {totals.papers}</span>
                <span
                  className={`rounded-md px-2 py-1 ${
                    totalsValid
                      ? 'bg-emerald-500/10 text-emerald-700'
                      : 'bg-amber-500/10 text-amber-800'
                  }`}
                >
                  Credits: {totals.credits} / {target}
                </span>
                {!totalsValid ? (
                  <span className="text-amber-700">Semester credit total must be {target}</span>
                ) : null}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-2 py-1">Category</th>
                    <th className="px-2 py-1">Count</th>
                    <th className="px-2 py-1">Credits/paper</th>
                    <th className="px-2 py-1">Mandatory</th>
                    <th className="px-2 py-1">Continuity</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat} className="border-b border-border/60">
                      <td className="px-2 py-2 font-medium">{cat}</td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-20"
                          value={rule.categoryCounts[cat] ?? 0}
                          onChange={(e) =>
                            onUpdateCount(rule.semesterSequence, cat, Number(e.target.value) || 0)
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-20"
                          value={rule.categoryMeta?.[cat]?.creditRule ?? ''}
                          onChange={(e) =>
                            onUpdateCredit(rule.semesterSequence, cat, Number(e.target.value) || 0)
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={isCategoryMandatory(rule.categoryMeta?.[cat])}
                          onChange={(e) =>
                            onUpdateMandatory(rule.semesterSequence, cat, e.target.checked)
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        {rule.semesterSequence > 1 &&
                        (NEP_CATEGORIES as readonly string[]).includes(cat) ? (
                          <select
                            className="h-8 rounded-md border border-border bg-card px-2"
                            value={rule.continuityRules[cat] ?? ''}
                            onChange={(e) =>
                              onUpdateContinuity(rule.semesterSequence, cat, e.target.value)
                            }
                          >
                            <option value="">—</option>
                            <option value="LOCK">Lock</option>
                            <option value="CHANGE_ALLOWED">Change allowed</option>
                          </select>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
