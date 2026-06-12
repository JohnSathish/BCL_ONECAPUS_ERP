'use client';

import { useState } from 'react';
import { CourseCatalogFilterFields } from '@/components/programs/course-catalog-filter-fields';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CourseCatalogFilterState } from '@/hooks/use-course-catalog-filters';
import type { Department } from '@/types/organization';
import type { ProgramVersion } from '@/types/programs';

type ProgramVersionOption = ProgramVersion & {
  program: { code: string; name: string };
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: CourseCatalogFilterState;
  onApply: (filters: CourseCatalogFilterState) => void;
  onClear: () => void;
  departments: Department[];
  programVersions: ProgramVersionOption[];
};

export function CourseCatalogFiltersDialog({
  open,
  onOpenChange,
  filters,
  onApply,
  onClear,
  departments,
  programVersions,
}: Props) {
  const [draft, setDraft] = useState(filters);

  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(filters);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filter course catalog</DialogTitle>
        </DialogHeader>
        <CourseCatalogFilterFields
          filters={draft}
          onFilterChange={(key, value) => setDraft((prev) => ({ ...prev, [key]: value }))}
          departments={departments}
          programVersions={programVersions}
          layout="stacked"
        />
        <div className="mt-6 flex gap-2">
          <Button
            type="button"
            className="flex-1"
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Apply filters
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onClear();
              setDraft({
                departmentId: '',
                courseType: '',
                deliveryType: '',
                programVersionId: '',
                semesterSequence: '',
                category: '',
              });
              onOpenChange(false);
            }}
          >
            Clear
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
