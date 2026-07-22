import 'server-only';

import { fetchCms, isRecord } from '@/lib/cms-client';
import type { HomepageSectionKey } from '@/lib/homepage-sections';

export type HomepageSectionPayload = {
  id: string;
  sectionKey: HomepageSectionKey | string;
  label: string;
  enabled: boolean;
  position: number;
  settings: Record<string, unknown>;
  payload: Record<string, unknown>;
};

export type HomepageResponse = {
  site: Record<string, unknown>;
  sections: HomepageSectionPayload[];
  content?: Record<string, unknown>;
};

export async function getHomepage(): Promise<HomepageResponse | null> {
  const data = await fetchCms('homepage', {}, 60);
  if (!isRecord(data) || !Array.isArray(data.sections)) return null;
  return {
    site: isRecord(data.site) ? data.site : {},
    content: isRecord(data.content) ? data.content : undefined,
    sections: data.sections
      .map((row) => {
        if (!isRecord(row) || typeof row.sectionKey !== 'string') return null;
        return {
          id: typeof row.id === 'string' ? row.id : row.sectionKey,
          sectionKey: row.sectionKey,
          label: typeof row.label === 'string' ? row.label : row.sectionKey,
          enabled: row.enabled !== false,
          position: typeof row.position === 'number' ? row.position : 0,
          settings: isRecord(row.settings) ? row.settings : {},
          payload: isRecord(row.payload) ? row.payload : {},
        } satisfies HomepageSectionPayload;
      })
      .filter((row): row is HomepageSectionPayload => Boolean(row)),
  };
}

export async function getUpcomingEvents() {
  const data = await fetchCms('events/upcoming', {}, 120);
  if (!Array.isArray(data)) return [];
  return data;
}
