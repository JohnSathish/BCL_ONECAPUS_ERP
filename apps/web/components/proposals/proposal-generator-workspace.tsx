'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2,
  Check,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Globe,
  Image as ImageIcon,
  LayoutTemplate,
  Mail,
  Palette,
  Printer,
  Save,
  Sparkles,
  Star,
  Wand2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ProposalStudioCollapsible } from '@/components/proposals/proposal-studio-collapsible';
import {
  PROPOSAL_STUDIO_COLORS,
  PROPOSAL_THEMES,
  resolveTheme,
  type ProposalThemeId,
} from '@/components/proposals/proposal-studio-themes';
import {
  computeProposalScore,
  computeProposalStats,
  computeStepStatus,
  PAGE_NAV_SECTIONS,
  STUDIO_STEPS,
  starsFromScore,
} from '@/components/proposals/proposal-studio-utils';
import { Button } from '@/components/ui/button';
import {
  createProposalPreset,
  deleteProposalPreset,
  exportProposal,
  fetchProposalDefaults,
  fetchProposalPresets,
  previewProposal,
  updateProposalPreset,
} from '@/services/proposals';
import { chatWithAiAssistant } from '@/services/ai-assistant';
import type { ProposalCustomization } from '@/types/proposals';
import { downloadBlob, filenameFromContentDisposition } from '@/utils/download-blob';
import { cn } from '@/utils/cn';

const PROFILE_STORAGE_KEY = 'bcl-proposal-profiles-v1';

type SavedProfile = {
  id: string;
  name: string;
  savedAt: string;
  data: ProposalCustomization;
  source: 'server' | 'local';
};

function buildPricing(
  studentStrength: number,
  perStudentRate: number,
  existing?: ProposalCustomization['pricingLines'],
) {
  const subscription = {
    label: `Annual ERP Subscription (₹${perStudentRate.toLocaleString('en-IN')}/student/academic year)`,
    amount: studentStrength * perStudentRate,
  };
  const otherLines = (existing ?? []).filter(
    (line) => !line.label.toLowerCase().includes('annual erp subscription'),
  );
  if (otherLines.length === 0) {
    return [
      subscription,
      { label: 'Implementation & Onboarding (one-time)', amount: 250000 },
      { label: 'Support & Success Program', amount: 180000 },
    ];
  }
  return [subscription, ...otherLines];
}

function loadProfiles(): SavedProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Array<Omit<SavedProfile, 'source'>>) : [];
    return parsed.map((item) => ({ ...item, source: 'local' as const }));
  } catch {
    return [];
  }
}

function saveProfiles(profiles: SavedProfile[]) {
  localStorage.setItem(
    PROFILE_STORAGE_KEY,
    JSON.stringify(
      profiles.filter((profile) => profile.source === 'local').map(({ source, ...rest }) => rest),
    ),
  );
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

function StarRating({ score }: { score: number }) {
  const stars = starsFromScore(score);
  return (
    <span className="inline-flex gap-0.5 text-amber-400">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn('h-3.5 w-3.5', i < stars ? 'fill-current' : 'opacity-30')} />
      ))}
    </span>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="block text-xs font-medium text-slate-600">{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100',
        props.className,
      )}
    />
  );
}

export function ProposalGeneratorWorkspace() {
  const [sectionOptions, setSectionOptions] = useState<Array<{ key: string; label: string }>>([]);
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [profileName, setProfileName] = useState('');
  const [form, setForm] = useState<ProposalCustomization>({
    institutionName: 'Don Bosco College, Tura',
    proposalVersion: '1.0',
    proposalDate: new Date().toISOString().slice(0, 10),
    studentStrength: 2200,
    perStudentSubscriptionRate: 100,
    contactPerson: 'Dr (Fr) Jogesh B Sangma',
    contactEmail: 'principal@donboscocollege.ac.in',
    contactPhone: '+91-9678402086',
    addressLine: 'Don Bosco College Tura, Sampalgre, West Garo Hills, Meghalaya 794002',
    primaryColor: '#1E40AF',
    secondaryColor: '#2563EB',
    proposalTheme: 'don-bosco',
    pricingLines: buildPricing(2200, 100),
    sectionToggles: [],
  });
  const [previewHtml, setPreviewHtml] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [serverPresetsAvailable, setServerPresetsAvailable] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [livePreview, setLivePreview] = useState(true);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalAmount = useMemo(
    () => (form.pricingLines ?? []).reduce((sum, item) => sum + (item.amount || 0), 0),
    [form.pricingLines],
  );

  const annualSubscriptionTotal = useMemo(() => {
    const strength = form.studentStrength ?? 0;
    const rate = form.perStudentSubscriptionRate ?? 0;
    return strength * rate;
  }, [form.studentStrength, form.perStudentSubscriptionRate]);

  const stats = useMemo(() => computeProposalStats(previewHtml), [previewHtml]);
  const score = useMemo(() => computeProposalScore(form, stats), [form, stats]);
  const stepStatus = useMemo(
    () => computeStepStatus(form, Boolean(previewHtml)),
    [form, previewHtml],
  );

  const applyDefaults = useCallback(
    (defaults: Awaited<ReturnType<typeof fetchProposalDefaults>>) => {
      setSectionOptions(defaults.sectionKeys ?? []);
      const { sectionKeys, ...restDefaults } = defaults;
      setForm((prev) => ({
        ...restDefaults,
        ...prev,
        pricingLines:
          defaults.pricingLines ??
          buildPricing(defaults.studentStrength, defaults.perStudentSubscriptionRate ?? 100),
        sectionToggles: (defaults.sectionKeys ?? []).map((s) => {
          const existing = prev.sectionToggles?.find((t) => t.key === s.key);
          return { key: s.key, enabled: existing?.enabled ?? true };
        }),
      }));
    },
    [],
  );

  const refreshServerPresets = useCallback(async () => {
    const rows = await fetchProposalPresets();
    const mapped: SavedProfile[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      savedAt: row.updatedAt ?? row.createdAt,
      data: row.data,
      source: 'server',
    }));
    setProfiles(mapped);
    setServerPresetsAvailable(true);
  }, []);

  useEffect(() => {
    setProfiles(loadProfiles());
    fetchProposalDefaults()
      .then(applyDefaults)
      .catch(() => undefined);
    refreshServerPresets().catch(() => setServerPresetsAvailable(false));
  }, [applyDefaults, refreshServerPresets]);

  const sanitizePayload = useCallback(() => {
    const { sectionKeys: _sectionKeys, ...payload } = form as ProposalCustomization & {
      sectionKeys?: unknown;
    };
    return payload;
  }, [form]);

  const runPreview = useCallback(async () => {
    setBusy(true);
    try {
      const data = await previewProposal(sanitizePayload());
      setPreviewHtml(data.html);
    } finally {
      setBusy(false);
    }
  }, [sanitizePayload]);

  useEffect(() => {
    if (!livePreview) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runPreview();
    }, 900);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form, livePreview, runPreview]);

  function updateStudentStrength(value: number) {
    setForm((p) => ({
      ...p,
      studentStrength: value,
      pricingLines: buildPricing(value, p.perStudentSubscriptionRate ?? 100, p.pricingLines),
    }));
  }

  function updatePerStudentRate(value: number) {
    setForm((p) => ({
      ...p,
      perStudentSubscriptionRate: value,
      pricingLines: buildPricing(p.studentStrength ?? 0, value, p.pricingLines),
    }));
  }

  function applyTheme(themeId: ProposalThemeId) {
    const theme = resolveTheme(themeId);
    setForm((p) => ({
      ...p,
      proposalTheme: themeId,
      primaryColor: theme.primary,
      secondaryColor: theme.secondary,
    }));
  }

  function toggleSection(key: string, enabled: boolean) {
    setForm((p) => ({
      ...p,
      sectionToggles: (p.sectionToggles ?? []).map((t) => (t.key === key ? { ...t, enabled } : t)),
    }));
  }

  function saveProfile() {
    const name = profileName.trim() || form.institutionName || 'Untitled Profile';
    const existing = profiles.find((p) => p.name === name);
    if (serverPresetsAvailable) {
      const action =
        existing?.source === 'server'
          ? updateProposalPreset(existing.id, { name, data: form })
          : createProposalPreset(name, form);
      action
        .then(() => refreshServerPresets())
        .catch(() => {
          const next: SavedProfile = {
            id: crypto.randomUUID(),
            name,
            savedAt: new Date().toISOString(),
            data: form,
            source: 'local',
          };
          const updated = [next, ...profiles.filter((p) => p.name !== name)];
          setProfiles(updated);
          saveProfiles(updated);
        });
      setProfileName('');
      return;
    }
    const next: SavedProfile = {
      id: crypto.randomUUID(),
      name,
      savedAt: new Date().toISOString(),
      data: form,
      source: 'local',
    };
    const updated = [next, ...profiles.filter((p) => p.name !== name)];
    setProfiles(updated);
    saveProfiles(updated);
    setProfileName('');
  }

  function loadProfile(id: string) {
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return;
    setForm(profile.data);
  }

  async function runExport(format: 'html' | 'pdf' | 'docx') {
    setBusy(true);
    setExportOpen(false);
    try {
      const result = await exportProposal(sanitizePayload(), format);
      const parsed =
        filenameFromContentDisposition(result.contentDisposition) ?? `bcl-proposal.${format}`;
      downloadBlob(result.blob, parsed);
    } finally {
      setBusy(false);
    }
  }

  function jumpToSection(sectionKey: string) {
    const doc = previewRef.current?.contentDocument;
    const target = doc?.getElementById(`section-${sectionKey}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handlePrint() {
    previewRef.current?.contentWindow?.print();
    setExportOpen(false);
  }

  function handleEmailProposal() {
    const subject = encodeURIComponent(
      `BCL OneCampus ERP Proposal — ${form.institutionName ?? 'Institution'}`,
    );
    const body = encodeURIComponent(
      `Dear ${form.contactPerson ?? 'Sir/Madam'},\n\nPlease find our enterprise ERP proposal attached for your review.\n\nRegards,\nBaseCode Labs Pvt. Ltd.\ncontact@basecodelabs.com`,
    );
    window.open(`mailto:${form.contactEmail ?? ''}?subject=${subject}&body=${body}`, '_blank');
    setExportOpen(false);
  }

  async function runAiAssist(
    field: 'executiveSummary' | 'implementation' | 'support' | 'roi',
    action: string,
  ) {
    setAiBusy(true);
    const institution = form.institutionName ?? 'the institution';
    const prompts: Record<typeof field, string> = {
      executiveSummary: `Write a professional executive summary for an ERP proposal to ${institution}. Focus on digital transformation, automation, and measurable outcomes. 2-3 paragraphs.`,
      roi: `Write a concise ROI section for a college ERP proposal to ${institution} with ${form.studentStrength ?? 0} students. Include efficiency gains and cost savings.`,
      implementation: `Write an implementation timeline narrative for BCL OneCampus ERP at ${institution}. Professional tone, phased rollout.`,
      support: `Write a support and success program section for an ERP proposal to ${institution}. Include SLA, training, and ongoing maintenance.`,
    };
    try {
      const response = await chatWithAiAssistant(
        `${action}. ${prompts[field]} Return only the proposal text, no preamble.`,
      );
      const key = field === 'roi' ? 'executiveSummary' : field;
      setForm((p) => ({
        ...p,
        copyOverrides: { ...(p.copyOverrides ?? {}), [key]: response.answer },
      }));
      void runPreview();
    } catch {
      // Keep existing content if AI is unavailable.
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: PROPOSAL_STUDIO_COLORS.background }}>
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E40AF] via-[#2563EB] to-[#1D4ED8] p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-blue-100">
              <FileText className="h-4 w-4" />
              Proposal Studio — Enterprise Edition
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight lg:text-3xl">
              Create world-class ERP proposals for colleges and universities
            </h1>
            <p className="mt-2 text-sm text-blue-100">
              Professional • DOCX • PDF • HTML • Live A4 Preview
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-white/15 text-white hover:bg-white/25"
              disabled={busy}
              onClick={saveProfile}
              size="sm"
              variant="ghost"
            >
              <Save className="mr-1.5 h-4 w-4" />
              Save
            </Button>
            <Button
              className="bg-white text-blue-700 hover:bg-blue-50"
              disabled={busy}
              onClick={() => void runPreview()}
              size="sm"
            >
              <Eye className="mr-1.5 h-4 w-4" />
              Live Preview
            </Button>
            <Button
              className="bg-emerald-500 text-white hover:bg-emerald-600"
              disabled={busy}
              onClick={() => runExport('pdf')}
              size="sm"
            >
              <Download className="mr-1.5 h-4 w-4" />
              Export PDF
            </Button>
            <Button
              className="bg-violet-500 text-white hover:bg-violet-600"
              disabled={busy}
              onClick={() => runExport('docx')}
              size="sm"
            >
              <FileText className="mr-1.5 h-4 w-4" />
              Export DOCX
            </Button>
            <Button
              className="bg-slate-700 text-white hover:bg-slate-800"
              disabled={busy}
              onClick={() => runExport('html')}
              size="sm"
            >
              <Globe className="mr-1.5 h-4 w-4" />
              Export HTML
            </Button>
          </div>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {STUDIO_STEPS.map((step, index) => {
            const status = stepStatus[step.id];
            return (
              <div key={step.id} className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                    status === 'complete' && 'bg-emerald-50 text-emerald-700',
                    status === 'current' && 'bg-blue-50 text-blue-700 ring-2 ring-blue-200',
                    status === 'pending' && 'bg-slate-100 text-slate-500',
                  )}
                >
                  {status === 'complete' ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-current/20 text-[10px]">
                      {index + 1}
                    </span>
                  )}
                  {step.label}
                </div>
                {index < STUDIO_STEPS.length - 1 ? (
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Layout */}
      <div className="mt-4 flex gap-4">
        {/* Config Panel — 420px */}
        <aside className="max-h-[calc(100vh-200px)] w-[420px] shrink-0 space-y-3 overflow-y-auto pr-1">
          <ProposalStudioCollapsible
            defaultOpen
            icon={<Building2 className="h-4 w-4 text-blue-600" />}
            title="Institution Details"
          >
            <FieldLabel>Institution Name</FieldLabel>
            <TextInput
              value={form.institutionName ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, institutionName: e.target.value }))}
            />
            <FieldLabel>Contact Person</FieldLabel>
            <TextInput
              value={form.contactPerson ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))}
            />
            <FieldLabel>Contact Email</FieldLabel>
            <TextInput
              value={form.contactEmail ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))}
            />
            <FieldLabel>Contact Phone</FieldLabel>
            <TextInput
              value={form.contactPhone ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))}
            />
            <FieldLabel>Address</FieldLabel>
            <TextInput
              value={form.addressLine ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, addressLine: e.target.value }))}
            />
          </ProposalStudioCollapsible>

          <ProposalStudioCollapsible
            icon={<FileText className="h-4 w-4 text-blue-600" />}
            title="Proposal Details"
          >
            <FieldLabel>Version</FieldLabel>
            <TextInput
              value={form.proposalVersion ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, proposalVersion: e.target.value }))}
            />
            <FieldLabel>Date</FieldLabel>
            <TextInput
              type="date"
              value={form.proposalDate ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, proposalDate: e.target.value }))}
            />
            <FieldLabel>Student Strength</FieldLabel>
            <TextInput
              type="number"
              value={form.studentStrength ?? 0}
              onChange={(e) => updateStudentStrength(Number(e.target.value || 0))}
            />
          </ProposalStudioCollapsible>

          <ProposalStudioCollapsible
            defaultOpen
            icon={<Palette className="h-4 w-4 text-blue-600" />}
            title="Branding"
          >
            <FieldLabel>Proposal Theme</FieldLabel>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PROPOSAL_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  className={cn(
                    'rounded-lg border p-2 text-left text-xs transition-all hover:shadow-md',
                    form.proposalTheme === theme.id && 'ring-2 ring-blue-400',
                  )}
                  onClick={() => applyTheme(theme.id)}
                  style={{ background: theme.preview }}
                  type="button"
                >
                  <span className="rounded bg-white/90 px-1.5 py-0.5 font-medium text-slate-800">
                    {theme.label}
                  </span>
                </button>
              ))}
            </div>
            <FieldLabel>Institution Logo URL</FieldLabel>
            <TextInput
              value={form.logoUrl ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, logoUrl: e.target.value }))}
              placeholder="https://..."
            />
            <FieldLabel>Background Image URL</FieldLabel>
            <TextInput
              value={form.backgroundImageUrl ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, backgroundImageUrl: e.target.value }))}
              placeholder="University campus photo"
            />
            <FieldLabel>Dashboard Screenshot URL</FieldLabel>
            <TextInput
              value={form.dashboardScreenshotUrl ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, dashboardScreenshotUrl: e.target.value }))}
            />
            <FieldLabel>Mobile Screenshot URL</FieldLabel>
            <TextInput
              value={form.mobileScreenshotUrl ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, mobileScreenshotUrl: e.target.value }))}
            />
            <FieldLabel>Signature URL</FieldLabel>
            <TextInput
              value={form.signatureUrl ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, signatureUrl: e.target.value }))}
            />
            <FieldLabel>QR Code URL</FieldLabel>
            <TextInput
              value={form.qrCodeUrl ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, qrCodeUrl: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <FieldLabel>Primary</FieldLabel>
                <input
                  type="color"
                  className="mt-1 h-9 w-full rounded-lg border"
                  value={form.primaryColor ?? '#1E40AF'}
                  onChange={(e) => setForm((p) => ({ ...p, primaryColor: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel>Accent</FieldLabel>
                <input
                  type="color"
                  className="mt-1 h-9 w-full rounded-lg border"
                  value={form.secondaryColor ?? '#2563EB'}
                  onChange={(e) => setForm((p) => ({ ...p, secondaryColor: e.target.value }))}
                />
              </div>
            </div>
          </ProposalStudioCollapsible>

          <ProposalStudioCollapsible
            defaultOpen
            icon={<LayoutTemplate className="h-4 w-4 text-blue-600" />}
            title="Pricing"
            badge={`₹${totalAmount.toLocaleString('en-IN')}`}
          >
            <FieldLabel>Per-Student Rate (₹/year)</FieldLabel>
            <TextInput
              type="number"
              min={1}
              value={form.perStudentSubscriptionRate ?? 100}
              onChange={(e) => updatePerStudentRate(Number(e.target.value || 0))}
            />
            <p className="text-xs text-emerald-700">
              Annual: ₹{annualSubscriptionTotal.toLocaleString('en-IN')} (
              {form.studentStrength?.toLocaleString('en-IN')} × ₹{form.perStudentSubscriptionRate})
            </p>
            {(form.pricingLines ?? []).map((line, index) => (
              <div key={index} className="grid grid-cols-[1fr_90px] gap-2">
                <TextInput
                  value={line.label}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      pricingLines: (p.pricingLines ?? []).map((item, i) =>
                        i === index ? { ...item, label: e.target.value } : item,
                      ),
                    }))
                  }
                />
                <TextInput
                  type="number"
                  value={line.amount}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      pricingLines: (p.pricingLines ?? []).map((item, i) =>
                        i === index ? { ...item, amount: Number(e.target.value || 0) } : item,
                      ),
                    }))
                  }
                />
              </div>
            ))}
          </ProposalStudioCollapsible>

          <ProposalStudioCollapsible
            icon={<LayoutTemplate className="h-4 w-4 text-blue-600" />}
            title="Modules"
          >
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {sectionOptions.map((section) => {
                const enabled =
                  form.sectionToggles?.find((t) => t.key === section.key)?.enabled ?? true;
                return (
                  <label
                    key={section.key}
                    className="flex items-center gap-2 text-xs text-slate-600"
                  >
                    <input
                      checked={enabled}
                      onChange={(e) => toggleSection(section.key, e.target.checked)}
                      type="checkbox"
                    />
                    {section.label}
                  </label>
                );
              })}
            </div>
          </ProposalStudioCollapsible>

          <ProposalStudioCollapsible
            icon={<Sparkles className="h-4 w-4 text-violet-600" />}
            title="AI Proposal Assistant"
          >
            <p className="text-xs text-slate-500">Generate professional content with one click.</p>
            <div className="grid gap-2">
              {[
                {
                  label: 'Generate Executive Summary',
                  field: 'executiveSummary' as const,
                  action: 'Generate',
                },
                { label: 'Generate ROI', field: 'roi' as const, action: 'Generate ROI section' },
                {
                  label: 'Generate Support Section',
                  field: 'support' as const,
                  action: 'Generate',
                },
                {
                  label: 'Improve Wording',
                  field: 'implementation' as const,
                  action: 'Professional rewrite of implementation section',
                },
              ].map((item) => (
                <button
                  key={item.label}
                  className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-left text-xs font-medium text-violet-800 transition hover:bg-violet-100 disabled:opacity-50"
                  disabled={aiBusy}
                  onClick={() => void runAiAssist(item.field, item.action)}
                  type="button"
                >
                  <Wand2 className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </button>
              ))}
            </div>
          </ProposalStudioCollapsible>

          <ProposalStudioCollapsible
            icon={<FileText className="h-4 w-4 text-blue-600" />}
            title="Content Overrides"
          >
            {(['executiveSummary', 'implementation', 'support'] as const).map((key) => (
              <div key={key}>
                <FieldLabel>
                  {key === 'executiveSummary'
                    ? 'Executive Summary'
                    : key === 'implementation'
                      ? 'Implementation'
                      : 'Support'}
                </FieldLabel>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  rows={3}
                  value={form.copyOverrides?.[key] ?? ''}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      copyOverrides: { ...(p.copyOverrides ?? {}), [key]: e.target.value },
                    }))
                  }
                />
              </div>
            ))}
          </ProposalStudioCollapsible>

          <ProposalStudioCollapsible
            icon={<Save className="h-4 w-4 text-blue-600" />}
            title="Saved Profiles"
          >
            <div className="flex gap-2">
              <TextInput
                placeholder="Profile name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              />
              <Button onClick={saveProfile} size="sm" type="button">
                Save
              </Button>
            </div>
            {profiles.slice(0, 5).map((p) => (
              <button
                key={p.id}
                className="block w-full truncate text-left text-xs text-blue-700 hover:underline"
                onClick={() => loadProfile(p.id)}
                type="button"
              >
                {p.name}
              </button>
            ))}
          </ProposalStudioCollapsible>

          {/* Smart Stats + Score */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-800">Document Intelligence</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-50 p-2">
                <div className="text-slate-500">Pages</div>
                <div className="text-lg font-bold text-blue-700">{stats.pages}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <div className="text-slate-500">Words</div>
                <div className="text-lg font-bold text-blue-700">
                  {stats.words.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <div className="text-slate-500">Images</div>
                <div className="text-lg font-bold text-blue-700">{stats.images}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <div className="text-slate-500">Tables</div>
                <div className="text-lg font-bold text-blue-700">{stats.tables}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700">
              <Check className="h-4 w-4" />
              {stats.printReady ? 'Ready for Print' : 'Building document…'}
            </div>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="text-xs font-semibold text-slate-700">Proposal Quality</div>
              {[
                { label: 'Corporate Branding', value: score.branding },
                { label: 'Readability', value: score.readability },
                { label: 'Print Ready', value: score.printReady },
              ].map((row) => (
                <div key={row.label} className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-600">{row.label}</span>
                  <StarRating score={row.value} />
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Preview Hero — ~75% width */}
        <main className="relative min-w-0 flex-1">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Live A4 Preview</h2>
              <p className="text-xs text-slate-500">Instant refresh • Print-ready layout</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                checked={livePreview}
                onChange={(e) => setLivePreview(e.target.checked)}
                type="checkbox"
              />
              Auto-refresh
            </label>
          </div>

          <div className="relative h-[calc(100vh-170px)] overflow-auto rounded-2xl bg-gradient-to-b from-slate-200/80 to-slate-300/60 p-3 lg:p-4 shadow-inner">
            <AnimatePresence mode="wait">
              {previewHtml ? (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className="mx-auto w-full max-w-none"
                  exit={{ opacity: 0, y: 8 }}
                  initial={{ opacity: 0, y: 8 }}
                  key={previewHtml.slice(0, 80)}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                >
                  <div
                    className="w-full overflow-hidden rounded-sm bg-white shadow-[0_20px_60px_rgba(15,23,42,0.22),0_4px_16px_rgba(15,23,42,0.12)]"
                    style={{ aspectRatio: '210/297' }}
                  >
                    <iframe
                      className="h-full w-full border-0"
                      ref={previewRef}
                      srcDoc={previewHtml}
                      title="Proposal Preview"
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  animate={{ opacity: 1 }}
                  className="flex min-h-[70vh] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white/50 text-center"
                  initial={{ opacity: 0 }}
                >
                  <ImageIcon className="mb-3 h-10 w-10 text-slate-400" />
                  <p className="text-sm font-medium text-slate-600">
                    Live A4 preview will appear here
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Configure your proposal — preview updates automatically
                  </p>
                  <Button className="mt-4" disabled={busy} onClick={() => void runPreview()}>
                    <Eye className="mr-2 h-4 w-4" />
                    Generate Preview
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Page Navigator */}
            {previewHtml ? (
              <div className="absolute bottom-4 left-4 max-w-[200px] rounded-xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
                <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Page Navigator
                </div>
                <div className="max-h-40 space-y-0.5 overflow-y-auto">
                  {PAGE_NAV_SECTIONS.map((section) => (
                    <button
                      key={section.key}
                      className="block w-full rounded-md px-2 py-1 text-left text-[11px] text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                      onClick={() => jumpToSection(section.key)}
                      type="button"
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        <button
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:scale-105 hover:shadow-xl"
          disabled={busy}
          onClick={saveProfile}
          title="Save"
          type="button"
        >
          <Save className="h-5 w-5" />
        </button>
        <button
          className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:scale-105 hover:bg-blue-700 hover:shadow-xl"
          disabled={busy}
          onClick={() => void runPreview()}
          title="Preview"
          type="button"
        >
          <Eye className="h-5 w-5" />
        </button>
        <button
          className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition hover:scale-105 hover:shadow-xl"
          disabled={busy}
          onClick={() => setExportOpen((v) => !v)}
          title="Export"
          type="button"
        >
          <Download className="h-5 w-5" />
        </button>
        <AnimatePresence>
          {exportOpen ? (
            <motion.div
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute bottom-0 right-14 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
            >
              {[
                { label: 'PDF', action: () => runExport('pdf'), icon: Download },
                { label: 'DOCX', action: () => runExport('docx'), icon: FileText },
                { label: 'HTML', action: () => runExport('html'), icon: Globe },
                { label: 'Print', action: handlePrint, icon: Printer },
                { label: 'Email Proposal', action: handleEmailProposal, icon: Mail },
              ].map((item) => (
                <button
                  key={item.label}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  onClick={item.action}
                  type="button"
                >
                  <item.icon className="h-4 w-4 text-slate-500" />
                  {item.label}
                </button>
              ))}
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-400"
                disabled
                type="button"
              >
                <FileText className="h-4 w-4" />
                PowerPoint (Soon)
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
