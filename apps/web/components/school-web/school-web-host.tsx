'use client';

import { createContext, useContext } from 'react';
import { schoolWebPath } from '@/lib/school-web/paths';

const SchoolWebHostContext = createContext('');

export function SchoolWebHostProvider({
  host,
  children,
}: {
  host: string;
  children: React.ReactNode;
}) {
  return <SchoolWebHostContext.Provider value={host}>{children}</SchoolWebHostContext.Provider>;
}

export function useSchoolWebHref() {
  const host = useContext(SchoolWebHostContext);
  return (href: string) => schoolWebPath(href, host);
}
