'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetchSlotCategoryRules, saveSlotCategoryRules } from '@/services/timetable';

const DAY_SHIFT_DEFAULTS = [
  { dayOfWeek: 1, periodNo: 1, label: 'P1', startTime: '09:45', endTime: '10:30' },
  { dayOfWeek: 1, periodNo: 2, label: 'P2', startTime: '10:30', endTime: '11:15' },
  { dayOfWeek: 1, periodNo: 3, label: 'P3', startTime: '11:15', endTime: '12:00' },
  { dayOfWeek: 1, periodNo: 4, label: 'P4', startTime: '12:00', endTime: '12:45' },
  {
    dayOfWeek: 1,
    periodNo: 0,
    label: 'Lunch',
    startTime: '12:45',
    endTime: '13:15',
    isLunch: true,
  },
  { dayOfWeek: 1, periodNo: 5, label: 'P5', startTime: '13:15', endTime: '14:00' },
  { dayOfWeek: 1, periodNo: 6, label: 'P6', startTime: '14:00', endTime: '14:45' },
  { dayOfWeek: 1, periodNo: 7, label: 'P7', startTime: '14:45', endTime: '15:30' },
];

type SlotRuleRow = {
  dayOfWeek: number;
  periodNo?: number;
  label: string;
  startTime: string;
  endTime: string;
  isBreak?: boolean;
  isLunch?: boolean;
};

export function TimetableSettingsPanel({ planId }: { planId: string }) {
  const [rules, setRules] = useState<SlotRuleRow[]>([]);

  const rulesQ = useQuery({
    queryKey: ['timetable', 'slot-rules', planId],
    queryFn: () => fetchSlotCategoryRules(planId),
    enabled: Boolean(planId),
  });

  useEffect(() => {
    if (rulesQ.data?.length) {
      setRules(
        rulesQ.data.map((row) => ({
          dayOfWeek: row.dayOfWeek,
          periodNo: row.periodNo ?? undefined,
          label: row.label,
          startTime: String(row.startTime).slice(0, 5),
          endTime: String(row.endTime).slice(0, 5),
          isBreak: row.isBreak,
          isLunch: row.isLunch,
        })),
      );
    }
  }, [rulesQ.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveSlotCategoryRules(
        planId,
        rules.map((rule) => ({
          ...rule,
          startTime: `${rule.startTime}:00`,
          endTime: `${rule.endTime}:00`,
        })),
      ),
    onSuccess: () => rulesQ.refetch(),
  });

  const applyDayShiftTemplate = () => {
    const expanded: SlotRuleRow[] = [];
    for (let day = 1; day <= 6; day += 1) {
      for (const slot of DAY_SHIFT_DEFAULTS) {
        if (day === 6 && (slot.periodNo ?? 0) > 4 && !slot.isLunch) continue;
        expanded.push({ ...slot, dayOfWeek: day });
      }
    }
    setRules(expanded);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Shift Period Templates</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={!planId} onClick={applyDayShiftTemplate}>
            Apply Day Shift Defaults
          </Button>
          <Button
            size="sm"
            disabled={!planId || saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            Save Rules
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Day Shift: P1 09:45–10:30 through P7 14:45–15:30. Lunch 12:45–13:15. Saturday uses P1–P4
          only (half-day ending 12:45).
        </p>
        {!planId ? (
          <p className="text-sm text-muted-foreground">
            Select a plan to configure slot templates.
          </p>
        ) : (
          <div className="max-h-96 overflow-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-2 py-2 text-left">Day</th>
                  <th className="px-2 py-2 text-left">Period</th>
                  <th className="px-2 py-2 text-left">Start</th>
                  <th className="px-2 py-2 text-left">End</th>
                </tr>
              </thead>
              <tbody>
                {rules.slice(0, 80).map((rule, index) => (
                  <tr key={index} className="border-t border-border">
                    <td className="px-2 py-1">{rule.dayOfWeek}</td>
                    <td className="px-2 py-1">{rule.label}</td>
                    <td className="px-2 py-1">
                      <Input
                        className="h-8"
                        value={rule.startTime}
                        onChange={(event) =>
                          setRules((prev) =>
                            prev.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, startTime: event.target.value } : row,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        className="h-8"
                        value={rule.endTime}
                        onChange={(event) =>
                          setRules((prev) =>
                            prev.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, endTime: event.target.value } : row,
                            ),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
