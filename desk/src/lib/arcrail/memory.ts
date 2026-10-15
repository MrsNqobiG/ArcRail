/**
 * Process-local stand-in for the Prisma client the explorer engine was written
 * against. One rail, integer rows, no filesystem — safe on serverless and
 * fast enough that a full journey is a handful of in-memory writes.
 */

type Row = Record<string, unknown>;

function matchCond(value: unknown, cond: unknown): boolean {
  if (cond && typeof cond === "object" && !Array.isArray(cond) && !(cond instanceof Date)) {
    const c = cond as Record<string, unknown>;
    if ("not" in c) {
      if (c.not === null) return value != null;
      return value !== c.not;
    }
    if ("startsWith" in c) {
      return typeof value === "string" && value.startsWith(String(c.startsWith));
    }
    return false;
  }
  return value === cond;
}

function matchWhere(row: Row, where?: Row): boolean {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    if (!matchCond(row[k], v)) return false;
  }
  return true;
}

function sortRows(rows: Row[], orderBy?: Row): Row[] {
  if (!orderBy) return rows;
  const [key, dir] = Object.entries(orderBy)[0] ?? [];
  if (!key) return rows;
  const sign = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av instanceof Date && bv instanceof Date) return (av.getTime() - bv.getTime()) * sign;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
    return String(av).localeCompare(String(bv)) * sign;
  });
}

class Table {
  rows: Row[] = [];

  async findUnique(args: { where: Row }): Promise<any> {
    const where = args.where;
    if (where.paymentId_eventId && typeof where.paymentId_eventId === "object") {
      const c = where.paymentId_eventId as Row;
      return (
        this.rows.find((r) => r.paymentId === c.paymentId && r.eventId === c.eventId) ?? null
      );
    }
    const id = where.id;
    return this.rows.find((r) => r.id === id) ?? null;
  }

  async findFirst(args?: { where?: Row; orderBy?: Row }): Promise<any> {
    const rows = sortRows(this.rows.filter((r) => matchWhere(r, args?.where)), args?.orderBy);
    return rows[0] ?? null;
  }

  async findMany(args?: { where?: Row; orderBy?: Row; take?: number }): Promise<any[]> {
    let rows = sortRows(this.rows.filter((r) => matchWhere(r, args?.where)), args?.orderBy);
    if (args?.take) rows = rows.slice(0, args.take);
    return rows;
  }

  async count(args?: { where?: Row }): Promise<number> {
    return this.rows.filter((r) => matchWhere(r, args?.where)).length;
  }

  async create(args: { data: Row }): Promise<any> {
    const now = new Date();
    const row: Row = { createdAt: now, updatedAt: now, ...args.data };
    this.rows.push(row);
    return row;
  }

  async update(args: { where: Row; data: Row }): Promise<any> {
    const row = await this.findUnique({ where: args.where });
    if (!row) throw new Error("404 NOT_FOUND");
    Object.assign(row, args.data, { updatedAt: new Date() });
    return row;
  }

  async deleteMany(_args?: { where?: Row }): Promise<{ count: number }> {
    const count = this.rows.length;
    this.rows = [];
    return { count };
  }

  async aggregate(args: { where?: Row; _sum?: { amountMinor?: boolean } }): Promise<{
    _sum: { amountMinor: number | null };
  }> {
    const rows = this.rows.filter((r) => matchWhere(r, args.where));
    if (!rows.length) return { _sum: { amountMinor: null } };
    const amountMinor = rows.reduce((s, r) => s + Number(r.amountMinor ?? 0), 0);
    return { _sum: { amountMinor } };
  }
}

export const db = {
  payment: new Table(),
  historyEvent: new Table(),
  ledgerEntry: new Table(),
  opsCase: new Table(),
  auditEntry: new Table(),
  railState: new Table(),
};

/** Serialize money mutations so two clicks cannot interleave a journal. */
let tail: Promise<unknown> = Promise.resolve();

export function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
