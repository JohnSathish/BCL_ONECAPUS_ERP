/**
 * @deprecated Prefer `departmentVisual` from `@/lib/department-visuals`.
 * Kept for any remaining photo-banner call sites during migration.
 */
import { shortDepartmentName } from '@/lib/department-visuals';

export { shortDepartmentName };

export function departmentBannerUrl(_input: {
  bannerUrl?: string | null;
  slug: string;
  category: string;
}) {
  // Photo banners retired in favour of solid colour + icon headers.
  return '';
}
