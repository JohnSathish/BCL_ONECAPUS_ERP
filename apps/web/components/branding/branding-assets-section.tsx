'use client';

import { BrandingSectionCard } from './branding-section-card';
import { BrandingBrowserTabMock, BrandingUploadZone } from './branding-upload-zone';

type Props = {
  logoPreview?: string;
  faviconPreview?: string;
  displayName: string;
  disabled?: boolean;
  logoUploading?: boolean;
  faviconUploading?: boolean;
  onLogoUpload: (file: File) => void;
  onFaviconUpload: (file: File) => void;
  onClearLogoPreview?: () => void;
};

export function BrandingAssetsSection({
  logoPreview,
  faviconPreview,
  displayName,
  disabled,
  logoUploading,
  faviconUploading,
  onLogoUpload,
  onFaviconUpload,
  onClearLogoPreview,
}: Props) {
  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <BrandingSectionCard
          title="Institution logo"
          description="Primary logo for login, sidebar, and documents."
          className="h-full"
        >
          <BrandingUploadZone
            label="Primary logo"
            hint="Recommended: 512×512 px or larger, transparent PNG/SVG."
            recommendedSize="512×512 px"
            previewUrl={logoPreview}
            disabled={disabled}
            isUploading={logoUploading}
            onUpload={onLogoUpload}
            onClearPreview={onClearLogoPreview}
          />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <BrandingUploadZone label="Dark mode logo" comingSoon compact />
            <BrandingUploadZone label="Print / document logo" comingSoon compact />
          </div>
        </BrandingSectionCard>

        <BrandingSectionCard
          title="Favicon & browser branding"
          description="Icon shown in browser tabs and bookmarks."
          className="h-full"
        >
          <BrandingUploadZone
            label="Favicon"
            hint="Square icon, 32×32 px minimum."
            recommendedSize="32×32 px"
            previewUrl={faviconPreview}
            disabled={disabled}
            isUploading={faviconUploading}
            compact
            onUpload={onFaviconUpload}
          />
          <div className="mt-4">
            <BrandingBrowserTabMock faviconUrl={faviconPreview} title={displayName} />
          </div>
          <div className="mt-4">
            <BrandingUploadZone label="PWA app icon" comingSoon compact />
          </div>
        </BrandingSectionCard>
      </div>
    </>
  );
}
