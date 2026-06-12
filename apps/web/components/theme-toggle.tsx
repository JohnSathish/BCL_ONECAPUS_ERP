'use client';

import { useThemeContext } from '@/lib/theme/theme-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Moon, Sun } from 'lucide-react';
import { useTheme as useNextTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { updateUserAppearanceMode } from '@/services/user-preferences';
import { cn } from '@/utils/cn';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useNextTheme();
  const { darkModeEnabled } = useThemeContext();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);

  const prefsMutation = useMutation({
    mutationFn: updateUserAppearanceMode,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
    },
  });

  useEffect(() => setMounted(true), []);

  if (!darkModeEnabled) return null;

  const isDark = (mounted ? resolvedTheme : 'light') === 'dark';

  return (
    <button
      type="button"
      onClick={() => {
        const next = isDark ? 'light' : 'dark';
        setTheme(next);
        prefsMutation.mutate(next);
      }}
      className={cn(
        'rounded-xl border border-border/80 bg-card/80 p-2.5 backdrop-blur transition hover:bg-muted/50',
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
