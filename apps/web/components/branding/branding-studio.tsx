'use client';

import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AppThemeSettings, BrandingAuditEntry, InstitutionBranding } from '@/types/branding';
import { cn } from '@/utils/cn';
import { BrandingAccreditationSection } from './branding-accreditation-section';
import { BrandingAssetsSection } from './branding-assets-section';
import { BrandingAuditTimeline } from './branding-audit-timeline';
import { BrandingIdentitySection } from './branding-identity-section';
import { BrandingLoginPreview } from './branding-login-preview';
import { BrandingPageHeader } from './branding-page-header';
import { BrandingStickySaveBar } from './branding-sticky-save-bar';
import { BrandingStudioLayout } from './branding-studio-layout';
import { BrandingThemeSection } from './branding-theme-section';
import { ThemeAppearanceSection } from './theme-appearance-section';
import { ThemeButtonsSection } from './theme-buttons-section';
import { ThemeCardsSection } from './theme-cards-section';
import { ThemeCustomCssSection } from './theme-custom-css-section';
import { ThemeHeaderSection } from './theme-header-section';
import { ThemeLayoutSection } from './theme-layout-section';
import { ThemeLivePreview } from './theme-live-preview';
import { ThemePresetsSection } from './theme-presets-section';
import { ThemeSelector } from './theme-selector';
import { ThemeSidebarSection } from './theme-sidebar-section';
import { ThemeTablesSection } from './theme-tables-section';
import { ThemeTypographySection } from './theme-typography-section';
import { useBrandingStudioForm, type StudioTab } from './use-branding-studio-form';

const TABS: { id: StudioTab; label: string }[] = [
  { id: 'branding', label: 'Branding' },
  { id: 'sidebar', label: 'Sidebar' },
  { id: 'header', label: 'Header' },
  { id: 'typography', label: 'Typography' },
  { id: 'cards', label: 'Cards' },
  { id: 'tables', label: 'Tables' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'layout', label: 'Layout' },
  { id: 'appearance', label: 'Dark Mode' },
  { id: 'customCss', label: 'Custom CSS' },
];

type Props = {
  initialData: InstitutionBranding;
  initialTheme: AppThemeSettings;
  audit: BrandingAuditEntry[];
  canManage: boolean;
};

export function BrandingStudio({ initialData, initialTheme, audit, canManage }: Props) {
  const studio = useBrandingStudioForm(initialData, initialTheme);
  const badges = studio.watch('badges') ?? [];
  const themeValues = studio.themeWatch();

  const tabContent = () => {
    switch (studio.activeTab) {
      case 'sidebar':
        return (
          <ThemeSidebarSection
            control={studio.themeControl}
            watch={studio.themeWatch}
            setValue={studio.themeSetValue}
            disabled={!canManage}
          />
        );
      case 'header':
        return (
          <ThemeHeaderSection
            control={studio.themeControl}
            watch={studio.themeWatch}
            setValue={studio.themeSetValue}
            disabled={!canManage}
          />
        );
      case 'cards':
        return (
          <ThemeCardsSection
            control={studio.themeControl}
            watch={studio.themeWatch}
            setValue={studio.themeSetValue}
            disabled={!canManage}
          />
        );
      case 'tables':
        return (
          <ThemeTablesSection
            watch={studio.themeWatch}
            setValue={studio.themeSetValue}
            disabled={!canManage}
          />
        );
      case 'buttons':
        return (
          <ThemeButtonsSection
            control={studio.themeControl}
            watch={studio.themeWatch}
            setValue={studio.themeSetValue}
            disabled={!canManage}
          />
        );
      case 'layout':
        return (
          <>
            <ThemeLayoutSection
              watch={studio.themeWatch}
              setValue={studio.themeSetValue}
              disabled={!canManage}
            />
            <ThemePresetsSection
              activePreset={themeValues.themeName}
              disabled={!canManage}
              applying={studio.applyingPreset}
              onApply={(id) => void studio.applyPreset(id)}
              onImported={() => studio.invalidateAll()}
            />
          </>
        );
      case 'appearance':
        return (
          <ThemeAppearanceSection
            watch={studio.themeWatch}
            setValue={studio.themeSetValue}
            disabled={!canManage}
          />
        );
      case 'typography':
        return (
          <ThemeTypographySection
            register={studio.themeRegister}
            watch={studio.themeWatch}
            setValue={studio.themeSetValue}
            disabled={!canManage}
          />
        );
      case 'customCss':
        return (
          <ThemeCustomCssSection
            watch={studio.themeWatch}
            setValue={studio.themeSetValue}
            disabled={!canManage}
          />
        );
      default:
        return (
          <>
            <BrandingIdentitySection register={studio.register} disabled={!canManage} />
            <BrandingAssetsSection
              logoPreview={studio.logoPreview}
              faviconPreview={studio.faviconPreview}
              displayName={studio.watch('displayName') ?? ''}
              disabled={!canManage}
              logoUploading={studio.logoMutation.isPending}
              faviconUploading={studio.faviconMutation.isPending}
              onLogoUpload={(file) => studio.logoMutation.mutate(file)}
              onFaviconUpload={(file) => studio.faviconMutation.mutate(file)}
              onClearLogoPreview={() => studio.setLogoPreview(undefined)}
            />
            <BrandingThemeSection
              register={studio.register}
              control={studio.control}
              watch={studio.watch}
              setValue={studio.setValue}
              disabled={!canManage}
            />
            <BrandingAccreditationSection
              badges={badges}
              setValue={studio.setValue}
              disabled={!canManage}
            />
          </>
        );
    }
  };

  return (
    <>
      <form onSubmit={studio.onSubmit}>
        <BrandingStudioLayout
          header={
            <>
              <BrandingPageHeader
                canManage={canManage}
                isDirty={studio.formState.isDirty}
                isSaving={studio.saveMutation.isPending}
                saveSuccess={studio.saveSuccess}
                onPreview={() => studio.setPreviewOpen(true)}
                onReset={studio.resetToServer}
                onSave={() => void studio.onSubmit()}
              />
              <div className="relative z-10 mt-4">
                <ThemeSelector
                  currentThemeName={themeValues.themeName}
                  disabled={!canManage}
                  onApplied={() => studio.invalidateAll()}
                />
              </div>
              <div className="mt-6 flex flex-wrap gap-1 rounded-xl border border-border/60 bg-muted/20 p-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => studio.setActiveTab(tab.id)}
                    className={cn(
                      'rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:px-3 sm:text-sm',
                      studio.activeTab === tab.id
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </>
          }
          config={tabContent()}
          preview={
            studio.activeTab === 'branding' ? (
              <BrandingLoginPreview snapshot={studio.previewSnapshot} compact />
            ) : (
              <ThemeLivePreview theme={initialTheme} displayName={studio.watch('displayName')} />
            )
          }
          audit={<BrandingAuditTimeline entries={audit} />}
          stickyBar={
            <BrandingStickySaveBar
              visible={studio.formState.isDirty && canManage}
              canManage={canManage}
              isSaving={studio.saveMutation.isPending}
              onSave={() => void studio.onSubmit()}
              onDiscard={studio.resetToServer}
            />
          }
        />
      </form>

      <Dialog open={studio.previewOpen} onOpenChange={studio.setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto p-0">
          <DialogHeader className="border-b border-border/50 px-6 py-4">
            <DialogTitle>Branding preview</DialogTitle>
          </DialogHeader>
          <div className="p-6">
            <BrandingLoginPreview snapshot={studio.previewSnapshot} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function BrandingStudioLoading() {
  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Loading Theme Studio…
    </div>
  );
}
