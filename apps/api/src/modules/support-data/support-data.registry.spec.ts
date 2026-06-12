import {
  getCategoryDef,
  listCategories,
  SUPPORT_DATA_CATEGORIES,
} from './support-data.registry';
import { LookupAdapter } from './adapters/lookup.adapter';

describe('support-data.registry', () => {
  it('lists academic, staff, and student groups', () => {
    const groups = listCategories();
    expect(groups.map((g) => g.code)).toEqual(
      expect.arrayContaining(['academic', 'staff', 'students']),
    );
  });

  it('resolves departments as dedicated category', () => {
    const def = getCategoryDef('departments');
    expect(def?.source).toBe('dedicated');
    expect(def?.fields.some((f) => f.key === 'departmentType')).toBe(true);
  });

  it('resolves staff-types as lookup category', () => {
    const def = getCategoryDef('staff-types');
    expect(def?.source).toBe('lookup');
    expect(def?.lookupType).toBe('STAFF_TYPE');
  });

  it('includes designations with category field', () => {
    const def = getCategoryDef('designations');
    expect(def?.fields.some((f) => f.key === 'category')).toBe(true);
  });

  it('registers all phase-1 categories uniquely', () => {
    const codes = SUPPORT_DATA_CATEGORIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain('additional-roles');
    expect(codes).toContain('nep-categories');
  });
});

describe('support-data list filtering', () => {
  it('lookup adapter filters inactive when activeOnly true', async () => {
    const prisma = {
      masterLookup: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: '1',
            code: 'A',
            label: 'Active',
            sortOrder: 0,
            isActive: true,
            metadata: null,
          },
        ]),
      },
    };
    const audit = { log: jest.fn() };
    const adapter = new LookupAdapter(prisma as never, audit as never);
    const rows = await adapter.list('tenant-1', 'STAFF_TYPE', {
      activeOnly: true,
    });
    expect(prisma.masterLookup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true, archivedAt: null }),
      }),
    );
    expect(rows).toHaveLength(1);
  });
});
