'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchWebsiteHomepageContent,
  revalidateWebsite,
  updateWebsiteHomepageContent,
} from '@/services/website-cms';
import { apiErrorMessage } from '@/utils/api-error';

type QuickLinkDraft = {
  enabled: boolean;
  label: string;
  href: string;
  openInNewTab: boolean;
};

type QuickLinksDraft = {
  erpLogin: QuickLinkDraft;
  androidApp: QuickLinkDraft;
  iosApp: QuickLinkDraft;
  exploreProgrammes: QuickLinkDraft;
};

const DEFAULTS: QuickLinksDraft = {
  erpLogin: {
    enabled: true,
    label: 'ERP Login',
    href: 'https://erp.donboscocollege.ac.in/login',
    openInNewTab: true,
  },
  androidApp: {
    enabled: true,
    label: 'Android App',
    href: 'https://play.google.com/store/apps/details?id=edu.onecampus.mobile&utm_source=chatgpt.com',
    openInNewTab: true,
  },
  iosApp: {
    enabled: true,
    label: 'iOS App',
    href: 'https://apps.apple.com/in/app/don-bosco-college-tura/id6798552213',
    openInNewTab: true,
  },
  exploreProgrammes: {
    enabled: true,
    label: 'Explore Programmes',
    href: '/academics/programmes',
    openInNewTab: false,
  },
};

const ROWS: Array<{
  key: keyof QuickLinksDraft;
  title: string;
  hint: string;
}> = [
  {
    key: 'erpLogin',
    title: 'ERP Login',
    hint: 'Header + hero. Campus portal for staff and students.',
  },
  {
    key: 'androidApp',
    title: 'Android App',
    hint: 'Header + hero. Google Play Store listing URL.',
  },
  {
    key: 'iosApp',
    title: 'iOS App',
    hint: 'Header + hero. Apple App Store listing URL.',
  },
  {
    key: 'exploreProgrammes',
    title: 'Explore Programmes',
    hint: 'Hero only. Usually an on-site programmes page.',
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidHref(href: string): boolean {
  const value = href.trim();
  if (!value) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  if (/^(mailto|tel):/i.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function readLink(value: unknown, fallback: QuickLinkDraft): QuickLinkDraft {
  if (!isRecord(value)) return { ...fallback };
  return {
    enabled:
      typeof value.enabled === 'boolean'
        ? value.enabled
        : typeof value.visible === 'boolean'
          ? value.visible
          : fallback.enabled,
    label:
      typeof value.label === 'string' && value.label.trim() ? value.label.trim() : fallback.label,
    href: typeof value.href === 'string' && value.href.trim() ? value.href.trim() : fallback.href,
    openInNewTab:
      typeof value.openInNewTab === 'boolean'
        ? value.openInNewTab
        : typeof value.newTab === 'boolean'
          ? value.newTab
          : fallback.openInNewTab,
  };
}

function normalizeFromCms(raw: unknown): QuickLinksDraft {
  const source = isRecord(raw) ? raw : {};
  return {
    erpLogin: readLink(source.erpLogin, DEFAULTS.erpLogin),
    androidApp: readLink(source.androidApp ?? source.mobileApp, DEFAULTS.androidApp),
    iosApp: readLink(source.iosApp, DEFAULTS.iosApp),
    exploreProgrammes: readLink(source.exploreProgrammes, DEFAULTS.exploreProgrammes),
  };
}

export function WebsiteQuickLinksSettingsView({
  onMessage,
}: {
  onMessage: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const content = useQuery({
    queryKey: ['website', 'homepage-content'],
    queryFn: fetchWebsiteHomepageContent,
  });
  const [draft, setDraft] = useState<QuickLinksDraft>(DEFAULTS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!content.data) return;
    setDraft(normalizeFromCms(content.data.headerCtas));
  }, [content.data]);

  const validationError = useMemo(() => {
    for (const row of ROWS) {
      const link = draft[row.key];
      if (!link.enabled) continue;
      if (!link.label.trim()) return `${row.title}: label is required when enabled.`;
      if (!link.href.trim()) return `${row.title}: URL is required when enabled.`;
      if (!isValidHref(link.href)) {
        return `${row.title}: enter a valid URL (https://… or /path).`;
      }
    }
    return null;
  }, [draft]);

  const save = useMutation({
    mutationFn: () => {
      if (validationError) throw new Error(validationError);
      return updateWebsiteHomepageContent({
        headerCtas: {
          erpLogin: {
            ...draft.erpLogin,
            label: draft.erpLogin.label.trim(),
            href: draft.erpLogin.href.trim(),
          },
          androidApp: {
            ...draft.androidApp,
            label: draft.androidApp.label.trim(),
            href: draft.androidApp.href.trim(),
          },
          iosApp: {
            ...draft.iosApp,
            label: draft.iosApp.label.trim(),
            href: draft.iosApp.href.trim(),
          },
          exploreProgrammes: {
            ...draft.exploreProgrammes,
            label: draft.exploreProgrammes.label.trim(),
            href: draft.exploreProgrammes.href.trim(),
          },
        },
      });
    },
    onSuccess: async () => {
      setError(null);
      try {
        await revalidateWebsite(['/', '/layout']);
      } catch {
        // Save still succeeded; public CDN may need a short wait.
      }
      onMessage('Website Quick Links saved. Public site will refresh shortly.');
      void queryClient.invalidateQueries({ queryKey: ['website', 'homepage-content'] });
      void queryClient.invalidateQueries({ queryKey: ['website', 'appearance'] });
    },
    onError: (err) => {
      const message = apiErrorMessage(err, 'Could not save Quick Links');
      setError(message);
      onMessage(message);
    },
  });

  if (content.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading Quick Links…</p>;
  }
  if (content.error) {
    return (
      <p className="text-sm text-destructive">
        {apiErrorMessage(content.error, 'Could not load Quick Links')}
      </p>
    );
  }

  return (
    <CompactCard>
      <CompactCardHeader
        title="Website Quick Links / App Downloads"
        description="Control ERP Login, Android App, iOS App, and Explore Programmes on the public homepage header and hero. Disabled buttons are hidden completely."
      />
      <CompactCardBody className="space-y-4">
        {ROWS.map((row) => {
          const link = draft[row.key];
          return (
            <div
              key={row.key}
              className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 md:grid-cols-[140px_1fr]"
            >
              <div className="space-y-2">
                <p className="text-sm font-semibold">{row.title}</p>
                <p className="text-xs text-muted-foreground">{row.hint}</p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={link.enabled}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        [row.key]: { ...prev[row.key], enabled: event.target.checked },
                      }))
                    }
                  />
                  Visible
                </label>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="grid gap-1 text-sm md:col-span-2">
                  <span className="text-muted-foreground">Button label</span>
                  <Input
                    value={link.label}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        [row.key]: { ...prev[row.key], label: event.target.value },
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm md:col-span-2">
                  <span className="text-muted-foreground">URL</span>
                  <Input
                    value={link.href}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        [row.key]: { ...prev[row.key], href: event.target.value },
                      }))
                    }
                    placeholder="https://… or /path"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input
                    type="checkbox"
                    checked={link.openInNewTab}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        [row.key]: { ...prev[row.key], openInNewTab: event.target.checked },
                      }))
                    }
                  />
                  Open in new tab
                </label>
              </div>
            </div>
          );
        })}
        {error || validationError ? (
          <p className="text-sm text-destructive" role="alert">
            {error || validationError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={save.isPending || Boolean(validationError)}
            onClick={() => {
              setError(null);
              save.mutate();
            }}
          >
            {save.isPending ? 'Saving…' : 'Save Quick Links'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending}
            onClick={() => {
              setDraft(DEFAULTS);
              setError(null);
              onMessage('Defaults restored in the form. Click Save to publish them.');
            }}
          >
            Restore defaults
          </Button>
        </div>
      </CompactCardBody>
    </CompactCard>
  );
}
