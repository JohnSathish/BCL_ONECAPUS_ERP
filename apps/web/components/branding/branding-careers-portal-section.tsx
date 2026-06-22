'use client';

import { useMutation } from '@tanstack/react-query';
import { ImageIcon, Loader2 } from 'lucide-react';
import type { UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { uploadCareersHeroImage, uploadCareersPrincipalPhoto } from '@/services/branding';
import {
  BrandingSectionCard,
  brandingInputClass,
  brandingTextareaClass,
} from './branding-section-card';
import type { BrandingFormValues } from './use-branding-studio-form';

const HERO_SLOTS = [1, 2, 3, 4, 5] as const;

export function BrandingCareersPortalSection({
  disabled,
  register,
  watch,
  setValue,
}: {
  disabled?: boolean;
  register: UseFormRegister<BrandingFormValues>;
  watch: UseFormWatch<BrandingFormValues>;
  setValue: UseFormSetValue<BrandingFormValues>;
}) {
  const extras = watch('portalExtras.careersPortal');
  const principalPhoto = resolveUploadAssetUrl(extras?.principalPhotoUrl);
  const heroImages = extras?.heroImages ?? [];

  const principalMut = useMutation({
    mutationFn: uploadCareersPrincipalPhoto,
    onSuccess: (data) => {
      setValue('portalExtras', data.portalExtras, { shouldDirty: true });
    },
  });

  const heroMut = useMutation({
    mutationFn: ({ file, slot }: { file: File; slot: number }) =>
      uploadCareersHeroImage(file, slot),
    onSuccess: (data) => {
      setValue('portalExtras', data.portalExtras, { shouldDirty: true });
    },
  });

  return (
    <BrandingSectionCard
      title="Careers portal — public website"
      description="Content shown on career.donboscocollege.ac.in (hero banner slider, principal message)."
    >
      {/* Hero slider — prominent first */}
      <div className="mb-8 rounded-xl border border-dashed border-primary/30 bg-muted/30 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Hero banner slider</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload campus photos for the large image on the careers home page (right side on
              desktop). Slot 1 is the first slide. Images auto-rotate every 6 seconds. Recommended:
              landscape JPG/PNG, at least 1600×900 px.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              After uploading, open the careers portal and refresh — stock placeholder images are
              used until at least one slot is filled.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {HERO_SLOTS.map((slot) => {
            const src = resolveUploadAssetUrl(heroImages[slot - 1]);
            return (
              <div key={slot} className="overflow-hidden rounded-lg border bg-background shadow-sm">
                <div className="relative aspect-[16/10] bg-muted">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={`Hero slide ${slot}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
                      <ImageIcon className="h-8 w-8 opacity-40" />
                      <span className="text-xs">Slide {slot}</span>
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                    {slot === 1 ? 'Slide 1 (main)' : `Slide ${slot}`}
                  </span>
                </div>
                <label className="block cursor-pointer border-t px-3 py-2 text-center text-xs font-medium text-primary hover:bg-muted/50">
                  {src ? 'Replace image' : 'Upload image'}
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={disabled || heroMut.isPending}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) heroMut.mutate({ file, slot });
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            );
          })}
        </div>
        {heroMut.isPending ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Uploading hero image…
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="careersPrincipalName">Principal name</Label>
          <Input
            id="careersPrincipalName"
            className={brandingInputClass}
            disabled={disabled}
            {...register('portalExtras.careersPortal.principalName')}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="careersPrincipalTitle">Principal title</Label>
          <Input
            id="careersPrincipalTitle"
            className={brandingInputClass}
            disabled={disabled}
            {...register('portalExtras.careersPortal.principalTitle')}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="careersPrincipalMessage">Principal welcome message</Label>
          <textarea
            id="careersPrincipalMessage"
            className={brandingTextareaClass}
            rows={4}
            disabled={disabled}
            {...register('portalExtras.careersPortal.principalMessage')}
          />
          <p className="text-xs text-muted-foreground">
            Click <strong>Save changes</strong> at the bottom after editing text fields.
          </p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Principal photo</Label>
          <div className="flex flex-wrap items-end gap-4">
            {principalPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={principalPhoto}
                alt="Principal"
                className="h-32 w-32 rounded-full object-cover ring-2 ring-border"
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground">
                No photo
              </div>
            )}
            <div>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={disabled || principalMut.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) principalMut.mutate(file);
                }}
              />
              {principalMut.isPending ? (
                <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </BrandingSectionCard>
  );
}
