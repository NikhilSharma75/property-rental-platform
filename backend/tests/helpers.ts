import { vi } from "vitest";

/** Chainable stand-in for a Supabase query builder. Awaiting it resolves to `result`; every call is recorded. */
export function queryBuilder(result: { data: unknown; error: { message?: string; code?: string } | null; count?: number | null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "in", "is", "not", "gt", "gte", "lt", "lte", "or", "ilike", "range", "order", "upsert", "insert", "update", "delete", "limit", "maybeSingle", "single"]) {
    builder[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return builder; };
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return { builder, calls };
}

export function mockSupabase(result: { data: unknown; error: { message?: string; code?: string } | null; count?: number | null }) {
  const { builder, calls } = queryBuilder(result);
  const from = vi.fn(() => builder);
  return { from, calls };
}

type Result = { data?: unknown; error?: { message?: string; code?: string } | null; count?: number | null };

/**
 * Per-table query mock. Each `from(table)` call takes the next queued result for that table
 * (the last one repeats), and every builder call is recorded so tests can assert on filters and writes.
 *
 *   const db = tableMock({ users: [{ data: { id: "u1" } }], audit_log: [{ error: null }] });
 *   state.from = db.from;
 *   ...
 *   expect(db.callsFor("users").some((c) => c.method === "update")).toBe(true);
 */
export function tableMock(queues: Record<string, Result[]>) {
  const used: Record<string, number> = {};
  const invocations: { table: string; calls: { method: string; args: unknown[] }[] }[] = [];

  const from = vi.fn((table: string) => {
    const queue = queues[table] ?? [{ data: null, error: null }];
    const i = Math.min(used[table] ?? 0, queue.length - 1);
    used[table] = (used[table] ?? 0) + 1;
    const r = queue[i];
    const { builder, calls } = queryBuilder({ data: r.data ?? null, error: r.error ?? null, count: r.count ?? null });
    invocations.push({ table, calls });
    return builder;
  });

  return {
    from,
    invocations,
    callsFor: (table: string) => invocations.filter((x) => x.table === table).flatMap((x) => x.calls),
    wasCalled: (table: string, method: string) => invocations.some((x) => x.table === table && x.calls.some((c) => c.method === method)),
  };
}
