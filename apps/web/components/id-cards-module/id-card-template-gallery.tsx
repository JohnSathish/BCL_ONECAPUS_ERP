'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  ImagePlus,
  LayoutTemplate,
  Palette,
  Printer,
  Sparkles,
  Star,
  Wand2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Cr80CardBack, Cr80CardFront } from '@/components/id-cards/cr80-card-renderer';
import {
  BUILTIN_ID_CARD_TEMPLATES,
  TEMPLATE_GALLERY_CATEGORIES,
  libraryCodeFromLayout,
} from '@/components/id-cards/builtin-template-library';
import type { BuiltinIdCardTemplate } from '@/types/id-card-template-library';
import { openCr80PrintPreview } from '@/components/id-cards/print-cr80-id-card';
import { brandedSampleModel } from '@/components/id-cards/sample-id-card-models';
import {
  defaultBackgroundLayer,
  layoutForBackgroundTemplate,
} from '@/components/id-cards/id-card-background-utils';
import { IdCardBackgroundTemplateWizard } from '@/components/id-cards/id-card-background-uploader';
import { tenantNeedsGallerySetup } from '@/components/id-cards/id-card-template-utils';
import { resolveInstitutionSignatureUrl } from '@/components/id-cards/resolve-institution-signature-url';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import {
  createIdCardTemplate,
  duplicateIdCardTemplate,
  fetchIdCardSettings,
  fetchIdCardTemplates,
  setDefaultIdCardTemplate,
  type IdCardTemplate,
} from '@/services/id-cards';
import type { IdCardTemplateCategory } from '@/types/id-card-template-library';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

function isStaffLike(holderType: string) {
  return (
    holderType === 'STAFF' ||
    holderType === 'CONTRACT' ||
    holderType === 'VISITING' ||
    holderType === 'RESEARCH'
  );
}

function TemplatePreviewMini({
  template,
  model,
  signatureUrl,
}: {
  template: BuiltinIdCardTemplate;
  model: ReturnType<typeof brandedSampleModel>;
  signatureUrl?: string | null;
}) {
  return (
    <div className="relative mx-auto origin-top scale-[0.42] transform">
      <div className="overflow-hidden rounded-lg shadow-md ring-1 ring-black/10">
        <Cr80CardFront
          model={model}
          layout={template.layout}
          holderType={template.holderType}
          printMode
          signatureUrl={signatureUrl}
        />
      </div>
    </div>
  );
}

function tenantTemplateForLibrary(templates: IdCardTemplate[] | undefined, code: string) {
  return templates?.find((t) => t.code === code || libraryCodeFromLayout(t.layout) === code);
}

export function IdCardTemplateGallery() {
  const router = useRouter();
  const qc = useQueryClient();
  const { branding } = useInstitutionBranding();
  const templatesQ = useQuery({
    queryKey: ['id-cards', 'templates'],
    queryFn: fetchIdCardTemplates,
  });
  const settingsQ = useQuery({ queryKey: ['id-cards', 'settings'], queryFn: fetchIdCardSettings });

  const signatureUrl = useMemo(
    () => resolveInstitutionSignatureUrl(settingsQ.data?.institutionSignatureUrl),
    [settingsQ.data?.institutionSignatureUrl],
  );
  const showSetupBanner = tenantNeedsGallerySetup(templatesQ.data);

  const [category, setCategory] = useState<IdCardTemplateCategory | 'ALL'>('ALL');
  const [previewTemplate, setPreviewTemplate] = useState<BuiltinIdCardTemplate | null>(null);
  const [message, setMessage] = useState('');
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [bgWizardOpen, setBgWizardOpen] = useState(false);

  const createFromBackgroundMut = useMutation({
    mutationFn: async (payload: {
      name: string;
      holderType: string;
      front: { imageUrl: string; naturalWidth: number | null; naturalHeight: number | null } | null;
      back: { imageUrl: string; naturalWidth: number | null; naturalHeight: number | null } | null;
    }) => {
      const layout = layoutForBackgroundTemplate(payload.holderType);
      if (payload.front) layout.frontBackground = defaultBackgroundLayer(payload.front);
      if (payload.back) layout.backBackground = defaultBackgroundLayer(payload.back);
      layout.meta = { ...layout.meta, creationMethod: 'background-upload' };
      return createIdCardTemplate({
        code: `bg-${Date.now().toString(36).slice(-8)}`,
        name: payload.name,
        holderType: payload.holderType,
        layout: layout as unknown as Record<string, unknown>,
        setAsDefault: false,
      });
    },
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ['id-cards', 'templates'] });
      setMessage('Background template created — add dynamic fields in the designer.');
      setBgWizardOpen(false);
      if (result?.id) {
        router.push(`/admin/id-cards/templates/designer?templateId=${result.id}`);
      }
    },
    onError: (err) => setMessage(apiErrorMessage(err, 'Could not create template')),
  });

  const filtered = useMemo(() => {
    if (category === 'ALL') return BUILTIN_ID_CARD_TEMPLATES;
    return BUILTIN_ID_CARD_TEMPLATES.filter((t) => t.category === category);
  }, [category]);

  const activeTemplates = filtered.filter((t) => !t.comingSoon);
  const futureTemplates = filtered.filter((t) => t.comingSoon);

  const tenantCustomTemplates = useMemo(() => {
    const libraryCodes = new Set(BUILTIN_ID_CARD_TEMPLATES.map((t) => t.code));
    return (templatesQ.data ?? []).filter(
      (t) => !libraryCodes.has(t.code) && !libraryCodeFromLayout(t.layout),
    );
  }, [templatesQ.data]);

  const instantiateMutation = useMutation({
    mutationFn: async ({
      template,
      mode,
    }: {
      template: BuiltinIdCardTemplate;
      mode: 'default' | 'customize' | 'duplicate';
    }) => {
      const existing = tenantTemplateForLibrary(templatesQ.data, template.code);
      if (mode === 'default') {
        if (existing) {
          return setDefaultIdCardTemplate(existing.id);
        }
        const created = await createIdCardTemplate({
          code: template.code,
          name: template.name,
          holderType: template.holderType,
          layout: template.layout as unknown as Record<string, unknown>,
          setAsDefault: true,
        });
        return created;
      }

      const customCode =
        mode === 'duplicate' && existing
          ? `${template.code}_COPY_${Date.now().toString(36).slice(-4).toUpperCase()}`
          : `${template.code}-${Date.now().toString(36).slice(-4)}`;

      if (mode === 'duplicate' && existing) {
        return duplicateIdCardTemplate(existing.id);
      }

      return createIdCardTemplate({
        code: customCode,
        name: mode === 'customize' ? `${template.name} (Custom)` : `${template.name} (Copy)`,
        holderType: template.holderType,
        layout: template.layout as unknown as Record<string, unknown>,
        setAsDefault: false,
      });
    },
    onSuccess: async (result, vars) => {
      await qc.invalidateQueries({ queryKey: ['id-cards', 'templates'] });
      setMessage(`${vars.template.name} ready.`);
      if (vars.mode === 'customize' && result?.id) {
        router.push(`/admin/id-cards/templates/designer?templateId=${result.id}`);
      }
    },
    onError: (err) => setMessage(apiErrorMessage(err, 'Action failed')),
  });

  const runAction = async (
    template: BuiltinIdCardTemplate,
    mode: 'default' | 'customize' | 'duplicate' | 'print',
  ) => {
    if (template.comingSoon) return;
    setBusyCode(template.code);
    try {
      if (mode === 'print') {
        const model = brandedSampleModel(template.holderType, branding);
        await openCr80PrintPreview({
          model,
          layout: template.layout,
          holderType: template.holderType,
          signatureUrl,
        });
        setMessage(`Print preview opened for ${template.name}.`);
        return;
      }
      await instantiateMutation.mutateAsync({ template, mode });
    } finally {
      setBusyCode(null);
    }
  };

  const previewModel = previewTemplate
    ? brandedSampleModel(previewTemplate.holderType, branding)
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <LayoutTemplate className="h-5 w-5" />
            <h2 className="text-lg font-semibold">ID Card Template Gallery</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Choose from {activeTemplates.length}+ professional CR80 templates. Your college logo,
            name, colors, and address are applied automatically from tenant branding.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/id-cards/templates/designer">
            <Palette className="mr-2 h-4 w-4" />
            Open Designer
          </Link>
        </Button>
      </div>

      {showSetupBanner ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-medium text-amber-950 dark:text-amber-100">
            Choose a professional template to get started
          </p>
          <p className="mt-1 text-amber-900/80 dark:text-amber-200/80">
            Your tenant is still on a legacy layout. Pick a template below and click{' '}
            <strong>Set Default</strong> — takes under a minute.
          </p>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-2 text-sm">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Method 1
          </p>
          <h3 className="mt-1 font-semibold">Blank Template</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Start from a built-in layout and customize fields, colors, and positions in the
            designer.
          </p>
          <Button asChild className="mt-3" variant="outline" size="sm">
            <Link href="/admin/id-cards/templates/designer">
              <Palette className="mr-2 h-4 w-4" />
              Open Blank Designer
            </Link>
          </Button>
        </div>
        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Method 2 · Recommended
          </p>
          <h3 className="mt-1 font-semibold">Upload Background Template</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Design in Photoshop, Canva, or Figma — upload front/back PNG or JPG, then place dynamic
            fields on top.
          </p>
          <Button className="mt-3" size="sm" onClick={() => setBgWizardOpen(true)}>
            <ImagePlus className="mr-2 h-4 w-4" />
            Upload Background Template
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {TEMPLATE_GALLERY_CATEGORIES.map((cat) => (
          <Button
            key={cat.id}
            type="button"
            size="sm"
            variant={category === cat.id ? 'default' : 'outline'}
            onClick={() => setCategory(cat.id)}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {activeTemplates.map((template) => {
          const tenantTpl = tenantTemplateForLibrary(templatesQ.data, template.code);
          const isDefault = Boolean(tenantTpl?.isDefault);
          const model = brandedSampleModel(template.holderType, branding);
          const busy = busyCode === template.code;

          return (
            <div
              key={template.code}
              className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm"
            >
              <div className="border-b border-border/60 bg-gradient-to-b from-muted/30 to-background px-3 pb-0 pt-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold leading-tight">{template.name}</h3>
                    <p className="text-[11px] text-muted-foreground">{template.styleLabel}</p>
                  </div>
                  {isDefault ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      <Star className="h-3 w-3 fill-current" />
                      Default
                    </span>
                  ) : null}
                </div>
                <div className="h-[148px] overflow-hidden rounded-t-lg bg-slate-100/80 dark:bg-slate-900/40">
                  <TemplatePreviewMini
                    template={template}
                    model={model}
                    signatureUrl={signatureUrl}
                  />
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3 p-3">
                <p className="line-clamp-2 text-xs text-muted-foreground">{template.description}</p>
                <div className="flex flex-wrap gap-1">
                  {template.bestFor.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-auto grid grid-cols-2 gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setPreviewTemplate(template)}
                  >
                    Preview
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={isDefault ? 'outline' : 'default'}
                    disabled={busy}
                    onClick={() => void runAction(template, 'default')}
                  >
                    {isDefault ? 'Default' : 'Set Default'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void runAction(template, 'customize')}
                  >
                    <Wand2 className="mr-1 h-3.5 w-3.5" />
                    Customize
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void runAction(template, 'duplicate')}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Duplicate
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="col-span-2"
                    disabled={busy}
                    onClick={() => void runAction(template, 'print')}
                  >
                    <Printer className="mr-1 h-3.5 w-3.5" />
                    Print Preview
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {futureTemplates.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Coming Soon</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {futureTemplates.map((template) => (
              <div
                key={template.code}
                className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-3 opacity-80"
              >
                <p className="font-medium">{template.name}</p>
                <p className="text-xs text-muted-foreground">{template.description}</p>
                <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  Coming Soon
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tenantCustomTemplates.length > 0 ? (
        <section>
          <h3 className="mb-3 text-sm font-semibold">Your Custom Templates</h3>
          <div className="grid gap-2">
            {tenantCustomTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
              >
                <div>
                  <p className="font-medium">{tpl.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {tpl.holderType}
                    {tpl.isDefault ? ' · Default' : ''}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/id-cards/templates/designer?templateId=${tpl.id}`}>
                      Edit
                    </Link>
                  </Button>
                  {!tpl.isDefault ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        void setDefaultIdCardTemplate(tpl.id).then(() => {
                          void qc.invalidateQueries({ queryKey: ['id-cards', 'templates'] });
                          setMessage(`${tpl.name} set as default.`);
                        });
                      }}
                    >
                      Set Default
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Dialog
        open={Boolean(previewTemplate)}
        onOpenChange={(open) => !open && setPreviewTemplate(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.name}</DialogTitle>
            <DialogDescription>{previewTemplate?.description}</DialogDescription>
          </DialogHeader>
          {previewTemplate && previewModel ? (
            <div className="flex flex-wrap items-start justify-center gap-6 py-2">
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Front
                </span>
                <div className="rounded-xl bg-muted/40 p-3">
                  <Cr80CardFront
                    model={previewModel}
                    layout={previewTemplate.layout}
                    holderType={previewTemplate.holderType}
                    printMode
                    signatureUrl={signatureUrl}
                  />
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Back
                </span>
                <div className="rounded-xl bg-muted/40 p-3">
                  <Cr80CardBack
                    model={previewModel}
                    layout={previewTemplate.layout}
                    holderType={previewTemplate.holderType}
                    printMode
                    signatureUrl={signatureUrl}
                  />
                </div>
              </div>
            </div>
          ) : null}
          {previewTemplate ? (
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => void runAction(previewTemplate, 'print')}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print Preview
              </Button>
              <Button type="button" onClick={() => void runAction(previewTemplate, 'customize')}>
                Customize This Template
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <IdCardBackgroundTemplateWizard
        open={bgWizardOpen}
        onOpenChange={setBgWizardOpen}
        creating={createFromBackgroundMut.isPending}
        onCreate={async (payload) => {
          await createFromBackgroundMut.mutateAsync(payload);
        }}
      />
    </div>
  );
}

export function galleryAccentClass(template: BuiltinIdCardTemplate) {
  return cn(
    template.styleLabel.includes('Gold') && 'ring-amber-400/30',
    template.styleLabel.includes('Modern') && 'ring-violet-400/20',
  );
}

export { isStaffLike };
