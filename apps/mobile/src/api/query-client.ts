import { QueryClient } from '@tanstack/react-query';

export const schoolQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});
