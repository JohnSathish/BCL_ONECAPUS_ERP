'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { AdvancedAudiencePanel } from '@/components/communication/audience/advanced-audience-panel';
import {
  compactAudienceFilter,
  EMPTY_AUDIENCE_FILTER,
} from '@/components/communication/audience/audience-filter.utils';
import type { AudienceFilter } from '@/types/communication';

export function AudienceBuilder() {
  const router = useRouter();
  const [audienceType, setAudienceType] = useState('STUDENTS');
  const [filter, setFilter] = useState<AudienceFilter>({ ...EMPTY_AUDIENCE_FILTER });

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border/80 bg-card p-5">
      <AdvancedAudiencePanel
        audienceType={audienceType}
        filter={filter}
        onAudienceTypeChange={setAudienceType}
        onFilterChange={setFilter}
        showSavedAudiences
        onUseInCompose={({ audienceType: type, filter: next, segmentId }) => {
          const params = new URLSearchParams();
          params.set('audienceType', type);
          params.set('audienceFilter', JSON.stringify(compactAudienceFilter(next)));
          if (segmentId) params.set('segmentId', segmentId);
          router.push(`/admin/communication/compose?${params.toString()}`);
        }}
      />
    </div>
  );
}
