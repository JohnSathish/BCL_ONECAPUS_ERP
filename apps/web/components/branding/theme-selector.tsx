'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Command } from 'cmdk';
import { Check, ChevronDown, Loader2, Palette, Search } from 'lucide-react';
import { applyThemePreset, fetchThemePresets } from '@/services/branding';
import { cacheThemePayload } from '@/lib/theme/css-variables';
import { useThemeStore } from '@/lib/theme/theme-store';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/utils/cn';

type Props = {
  currentThemeName?: string;
  disabled?: boolean;
  className?: string;
  onApplied?: () => void;
};

type PanelPosition = {
  top: number;
  left: number;
  width: number;
};

export function ThemeSelector({ currentThemeName, disabled, className, onApplied }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const tenantId = useAuthStore((s) => s.session?.user.tenantId ?? '');
  const setStoreTheme = useThemeStore((s) => s.setTheme);
  const clearDraft = useThemeStore((s) => s.clearDraft);

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ['theme-presets'],
    queryFn: fetchThemePresets,
    staleTime: 10 * 60_000,
  });

  const applyMutation = useMutation({
    mutationFn: applyThemePreset,
    onSuccess: (result) => {
      setStoreTheme(result);
      clearDraft();
      if (tenantId) cacheThemePayload(tenantId, result);
      void queryClient.invalidateQueries({ queryKey: ['theme-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['institution-branding'] });
      void queryClient.invalidateQueries({ queryKey: ['institution-branding-audit'] });
      onApplied?.();
      setOpen(false);
    },
  });

  const current = presets.find((p) => p.id === currentThemeName) ?? presets[0];

  const filtered = useMemo(() => {
    if (!query.trim()) return presets;
    const q = query.toLowerCase();
    return presets.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.id.includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.mood?.toLowerCase().includes(q),
    );
  }, [presets, query]);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPanelPosition({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const dropdownPanel =
    open && panelPosition && mounted
      ? createPortal(
          <div
            ref={panelRef}
            style={{
              top: panelPosition.top,
              left: panelPosition.left,
              width: panelPosition.width,
            }}
            className="fixed z-[200] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xl ring-1 ring-border/40"
          >
            <Command shouldFilter={false} className="bg-card">
              <div className="flex items-center border-b border-border bg-card px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search themes…"
                  className="flex h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <Command.List className="max-h-64 overflow-y-auto bg-card p-1">
                {isLoading ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Loading themes…
                  </div>
                ) : null}
                {!isLoading && filtered.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No themes found
                  </div>
                ) : null}
                {filtered.map((preset) => {
                  const active = preset.id === currentThemeName;
                  const meta = [preset.category, preset.mood].filter(Boolean).join(' · ');
                  return (
                    <Command.Item
                      key={preset.id}
                      value={preset.id}
                      onSelect={() => {
                        if (disabled || active) return;
                        applyMutation.mutate(preset.id);
                      }}
                      className={cn(
                        'relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none',
                        'aria-selected:bg-muted hover:bg-muted',
                        active && 'bg-primary/10',
                      )}
                    >
                      <span
                        className="h-5 w-5 shrink-0 rounded-md border border-border/40"
                        style={{
                          background: `linear-gradient(135deg, ${preset.sidebarBg} 50%, ${preset.primaryColor} 50%)`,
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{preset.label}</span>
                        {meta ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {meta}
                          </span>
                        ) : null}
                      </span>
                      {active ? <Check className="h-4 w-4 text-primary" /> : null}
                    </Command.Item>
                  );
                })}
              </Command.List>
            </Command>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={cn('relative w-full max-w-sm', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || applyMutation.isPending}
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) updatePanelPosition();
            return next;
          });
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-left shadow-sm transition hover:border-primary/40"
      >
        <Palette className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {current ? (
            <>
              <span
                className="h-4 w-4 shrink-0 rounded-full border border-border/40"
                style={{ backgroundColor: current.sidebarBg }}
              />
              <span className="truncate text-sm font-medium">{current.label}</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Select Theme</span>
          )}
        </span>
        {applyMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown
            className={cn('h-4 w-4 text-muted-foreground transition', open && 'rotate-180')}
          />
        )}
      </button>

      {dropdownPanel}
    </div>
  );
}
