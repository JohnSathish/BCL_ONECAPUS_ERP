'use client';

import { useCallback, useMemo } from 'react';

import {
  bindAutoAssignedSelections,
  buildAutoSlotKeys,
  buildSelectableSlotKeys,
  buildSlotKeys,
  isAutoAssignedCategory,
  slugifySubject,
  slotCategory,
} from '@/components/students-module/add-student/utils/subject-basket';
import type { SubjectBasketMeta } from '@/components/students-module/add-student/types/draft';
import type { CatalogSectionRow } from '@/types/academic-engine';
import type { AdmissionPoolsResponse } from '@/types/students';

export { buildSlotKeys, buildAutoSlotKeys, buildSelectableSlotKeys };

export function useSubjectBasket(params: {
  pools?: AdmissionPoolsResponse;
  catalog: CatalogSectionRow[];
  slotKeys: string[];
  autoSlotKeys: string[];
  selectableSlotKeys: string[];
  majorSubjectSlug?: string;
  minorSubjectSlug?: string;
  semesterSequence?: number;
}) {
  const sectionsByCategory = useMemo(() => {
    const map = new Map<string, CatalogSectionRow[]>();
    for (const row of params.catalog) {
      const cat = row.courseOffering.category;
      if (!cat || isAutoAssignedCategory(cat)) continue;
      const list = map.get(cat) ?? [];
      list.push(row);
      map.set(cat, list);
    }
    return map;
  }, [params.catalog]);

  const withAutoAssigned = useCallback(
    (current: Record<string, string>) =>
      bindAutoAssignedSelections(
        current,
        params.autoSlotKeys,
        params.catalog,
        params.pools,
        params.majorSubjectSlug ?? '',
        params.minorSubjectSlug ?? '',
        params.semesterSequence ?? 1,
      ),
    [
      params.autoSlotKeys,
      params.catalog,
      params.pools,
      params.majorSubjectSlug,
      params.minorSubjectSlug,
      params.semesterSequence,
    ],
  );

  const autoAssign = useCallback(
    (current: Record<string, string>) => {
      const next = withAutoAssigned(current);
      for (const slotKey of params.selectableSlotKeys) {
        if (next[slotKey]) continue;
        const cat = slotCategory(slotKey);
        const sections = sectionsByCategory.get(cat) ?? [];
        const pick = sections.find(
          (s) => (s.seatLedger?.confirmedCount ?? 0) < (s.capacity || 999),
        );
        if (pick) next[slotKey] = pick.id;
      }
      return next;
    },
    [params.selectableSlotKeys, sectionsByCategory, withAutoAssigned],
  );

  const metaFromSelections = useCallback(
    (selections: Record<string, string>): SubjectBasketMeta => {
      let creditsSelected = 0;
      for (const sectionId of Object.values(selections)) {
        const row = params.catalog.find((c) => c.id === sectionId);
        if (row) creditsSelected += Number(row.courseOffering.course.credits ?? 0);
      }

      for (const slotKey of params.autoSlotKeys) {
        if (selections[slotKey]) continue;
        const category = slotCategory(slotKey);
        const slug = category === 'MAJOR' ? params.majorSubjectSlug : params.minorSubjectSlug;
        if (!slug) continue;
        const poolRows =
          category === 'MAJOR' ? (params.pools?.major ?? []) : (params.pools?.minor ?? []);
        const target = slugifySubject(slug);
        const offering = poolRows.find((row) => {
          const course = row.course;
          if (!course) return false;
          const courseSlug = course.subjectSlug
            ? slugifySubject(course.subjectSlug)
            : course.department?.name
              ? slugifySubject(course.department.name)
              : slugifySubject(course.title ?? '');
          return courseSlug === target;
        });
        if (offering?.course?.credits != null) {
          creditsSelected += Number(offering.course.credits);
        }
      }

      const categoriesComplete = params.slotKeys
        .filter((k) => selections[k])
        .map((k) => slotCategory(k));
      const uniqueCats = [...new Set(categoriesComplete)];
      for (const slotKey of params.autoSlotKeys) {
        const category = slotCategory(slotKey);
        const slug = category === 'MAJOR' ? params.majorSubjectSlug : params.minorSubjectSlug;
        if (slug && !uniqueCats.includes(category)) uniqueCats.push(category);
      }
      const requiredPool = [...new Set(params.selectableSlotKeys.map((k) => slotCategory(k)))];
      const missingPoolCategories = requiredPool.filter((cat) => !uniqueCats.includes(cat));

      return {
        creditsSelected,
        creditsTarget: params.pools?.creditTarget ?? 0,
        categoriesComplete: uniqueCats,
        missingPoolCategories,
      };
    },
    [
      params.slotKeys,
      params.selectableSlotKeys,
      params.autoSlotKeys,
      params.catalog,
      params.pools,
      params.majorSubjectSlug,
      params.minorSubjectSlug,
    ],
  );

  return {
    sectionsByCategory,
    autoAssign,
    metaFromSelections,
    withAutoAssigned,
    slotKeys: params.slotKeys,
    autoSlotKeys: params.autoSlotKeys,
    selectableSlotKeys: params.selectableSlotKeys,
  };
}
