'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { SessionProvider } from '@/components/providers/session-provider';
import { StudentNameFormatProvider } from '@/components/providers/student-name-format-provider';
import { ThemeProvider as InstitutionThemeProvider } from '@/lib/theme/theme-provider';
import { isRetryableQueryError } from '@/lib/http/api-error-types';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: (count, error) => isRetryableQueryError(error) && count < 3,
          },
        },
      }),
  );

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <StudentNameFormatProvider>
            <InstitutionThemeProvider>{children}</InstitutionThemeProvider>
          </StudentNameFormatProvider>
        </SessionProvider>
      </QueryClientProvider>
    </NextThemesProvider>
  );
}
