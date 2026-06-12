'use client';

import type { UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BrandingSectionCard,
  brandingInputClass,
  brandingTextareaClass,
} from './branding-section-card';
import type { BrandingFormValues } from './use-branding-studio-form';

type Props = {
  register: UseFormRegister<BrandingFormValues>;
  disabled?: boolean;
};

function Phase2Field({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div className="space-y-2 opacity-60">
      <Label className="text-sm font-medium">{label}</Label>
      <Input
        disabled
        placeholder={placeholder}
        className={brandingInputClass}
        title="Coming in Phase 2"
      />
      <p className="text-xs text-muted-foreground">Coming in Phase 2</p>
    </div>
  );
}

export function BrandingIdentitySection({ register, disabled }: Props) {
  return (
    <BrandingSectionCard
      title="Institution identity"
      description="Displayed on login, dashboard, and official documents."
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="displayName" className="text-sm font-medium">
            Institution full name
          </Label>
          <Input
            id="displayName"
            className={brandingInputClass}
            placeholder="Don Bosco College Tura"
            disabled={disabled}
            {...register('displayName', { required: true })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="shortName" className="text-sm font-medium">
            Short name
          </Label>
          <Input
            id="shortName"
            className={brandingInputClass}
            placeholder="DBC Tura"
            disabled={disabled}
            {...register('shortName')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="campusName" className="text-sm font-medium">
            Campus / location
          </Label>
          <Input
            id="campusName"
            className={brandingInputClass}
            placeholder="Tura Campus"
            disabled={disabled}
            {...register('campusName')}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="portalSubtitle" className="text-sm font-medium">
            Campus portal tagline
          </Label>
          <Input
            id="portalSubtitle"
            className={brandingInputClass}
            placeholder="Campus ERP Portal"
            disabled={disabled}
            {...register('portalSubtitle')}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address" className="text-sm font-medium">
            Institution address
          </Label>
          <textarea
            id="address"
            className={brandingTextareaClass}
            placeholder="Full postal address"
            disabled={disabled}
            {...register('address')}
          />
        </div>

        <Phase2Field label="City" placeholder="Tura" />
        <Phase2Field label="State" placeholder="Meghalaya" />
        <Phase2Field label="Country" placeholder="India" />
        <Phase2Field label="Website" placeholder="https://www.example.edu" />
        <Phase2Field label="Support email" placeholder="support@example.edu" />
      </div>
    </BrandingSectionCard>
  );
}
