const LIST_ACTIONS = new Set(['findMany', 'count', 'aggregate', 'groupBy']);

/** True when a Prisma where clause already chooses NORMAL or DEMO. */
export function mentionsAccountType(where: unknown): boolean {
  if (!where || typeof where !== 'object') return false;
  if (Array.isArray(where)) return where.some(mentionsAccountType);
  const record = where as Record<string, unknown>;
  if ('accountType' in record) return true;
  return ['AND', 'OR', 'NOT'].some(
    (key) => key in record && mentionsAccountType(record[key]),
  );
}

/** Hide DEMO rows from list and count queries unless the caller asked for them. */
export function withNormalAccount<T>(where: T | undefined): T {
  if (mentionsAccountType(where)) return (where ?? ({} as T)) as T;
  return { AND: [where ?? {}, { accountType: 'NORMAL' }] } as T;
}

type ListDelegate = {
  __demoPatched?: boolean;
  findMany?: (args?: { where?: unknown }) => Promise<unknown>;
  count?: (args?: { where?: unknown }) => Promise<unknown>;
  aggregate?: (args?: { where?: unknown }) => Promise<unknown>;
  groupBy?: (args?: { where?: unknown }) => Promise<unknown>;
};

/** Class lists, strength counts, and staff directories skip DEMO accounts. */
export function patchDemoAccountExclusion(client: object) {
  const target = client as {
    student?: ListDelegate;
    staffProfile?: ListDelegate;
  };
  for (const model of ['student', 'staffProfile'] as const) {
    const delegate = target[model];
    if (!delegate || delegate.__demoPatched) continue;
    for (const action of LIST_ACTIONS) {
      const original = delegate[action as keyof ListDelegate];
      if (typeof original !== 'function') continue;
      const bound = original.bind(delegate);
      (delegate as Record<string, unknown>)[action] = (args?: {
        where?: unknown;
      }) => bound({ ...(args ?? {}), where: withNormalAccount(args?.where) });
    }
    delegate.__demoPatched = true;
  }
}
