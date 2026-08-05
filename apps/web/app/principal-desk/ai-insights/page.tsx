'use client';

import { Bot } from 'lucide-react';
import { PrincipalFeaturePlaceholder } from '@/components/principal-desk/principal-feature-placeholder';

export default function PrincipalAiInsightsPage() {
  return (
    <PrincipalFeaturePlaceholder
      title="AI Insights"
      subtitle="Principal Assistant recommendations"
      icon={Bot}
      description="Dedicated AI Assistant workspace is rolling out. Intelligence bullets and campus health cues already appear on your Principal Dashboard."
      related={[
        {
          href: '/principal-desk',
          label: 'Dashboard intelligence',
          description: 'Salutation, AI bullets, health score',
        },
        {
          href: '/principal-desk/health',
          label: 'Institutional Health',
          description: 'Score breakdown by factor',
        },
        {
          href: '/principal-desk/reports',
          label: 'Reports & Analytics',
          description: 'Deep-dive institutional reports',
        },
      ]}
    />
  );
}
