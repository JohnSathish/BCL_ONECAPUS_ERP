'use client';

export const POOL_CATEGORY_TABS = ['MDC', 'AEC', 'SEC', 'VAC', 'VTC'] as const;

export type PoolCategoryTab = (typeof POOL_CATEGORY_TABS)[number];
