'use client';

import type { ReactNode } from 'react';
import { usePermissions } from '@/hooks/use-permissions';

export function CanPerform({
  permission,
  anyOf,
  allOf,
  children,
  fallback = null,
}: {
  permission?: string;
  anyOf?: string[];
  allOf?: string[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can, canAny, canAll } = usePermissions();

  let allowed = true;
  if (permission) allowed = can(permission);
  else if (anyOf?.length) allowed = canAny(...anyOf);
  else if (allOf?.length) allowed = canAll(...allOf);

  return allowed ? <>{children}</> : <>{fallback}</>;
}
