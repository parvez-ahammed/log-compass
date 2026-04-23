// Structured diff between two JSON values producing a flat list of changes,
// plus summary counts. Used for the "smart" diff panel in addition to the
// text diff viewer.

export type ChangeType = "added" | "removed" | "changed";

export interface DiffEntry {
  path: string;
  type: ChangeType;
  left?: unknown;
  right?: unknown;
}

export interface DiffSummary {
  added: number;
  removed: number;
  changed: number;
  total: number;
}

export interface DiffResult {
  entries: DiffEntry[];
  summary: DiffSummary;
}

type Seg = string | number;

function materializePath(segs: Seg[]): string {
  let out = "$";
  for (const s of segs) {
    out += typeof s === "number" ? `[${s}]` : `.${s}`;
  }
  return out;
}

export function structuredDiff(left: unknown, right: unknown): DiffResult {
  const entries: DiffEntry[] = [];
  const summary: DiffSummary = { added: 0, removed: 0, changed: 0, total: 0 };
  const segs: Seg[] = [];
  walk(left, right, segs, entries, summary, true);
  return { entries, summary };
}

/**
 * Fast count-only walk. Skips path string allocation and entries array —
 * good for badge counts when structured tab is not open.
 */
export function countDiff(left: unknown, right: unknown): DiffSummary {
  const summary: DiffSummary = { added: 0, removed: 0, changed: 0, total: 0 };
  const segs: Seg[] = [];
  walk(left, right, segs, null, summary, false);
  return summary;
}

function emit(
  out: DiffEntry[] | null,
  summary: DiffSummary,
  segs: Seg[],
  entry: Omit<DiffEntry, "path">,
  collect: boolean
) {
  summary.total++;
  if (entry.type === "added") summary.added++;
  else if (entry.type === "removed") summary.removed++;
  else summary.changed++;
  if (collect && out) {
    out.push({ path: materializePath(segs), ...entry });
  }
}

function walk(
  a: unknown,
  b: unknown,
  segs: Seg[],
  out: DiffEntry[] | null,
  summary: DiffSummary,
  collect: boolean
) {
  if (Object.is(a, b)) return;

  const aIsObj = a !== null && typeof a === "object" && !Array.isArray(a);
  const bIsObj = b !== null && typeof b === "object" && !Array.isArray(b);
  const aIsArr = Array.isArray(a);
  const bIsArr = Array.isArray(b);

  if (aIsObj && bIsObj) {
    const oa = a as Record<string, unknown>;
    const ob = b as Record<string, unknown>;
    const keys = new Set<string>([...Object.keys(oa), ...Object.keys(ob)]);
    const sorted = Array.from(keys).sort();
    for (const k of sorted) {
      segs.push(k);
      if (!(k in oa)) emit(out, summary, segs, { type: "added", right: ob[k] }, collect);
      else if (!(k in ob)) emit(out, summary, segs, { type: "removed", left: oa[k] }, collect);
      else walk(oa[k], ob[k], segs, out, summary, collect);
      segs.pop();
    }
    return;
  }

  if (aIsArr && bIsArr) {
    const aa = a as unknown[];
    const bb = b as unknown[];
    const len = Math.max(aa.length, bb.length);
    for (let i = 0; i < len; i++) {
      segs.push(i);
      if (i >= aa.length) emit(out, summary, segs, { type: "added", right: bb[i] }, collect);
      else if (i >= bb.length) emit(out, summary, segs, { type: "removed", left: aa[i] }, collect);
      else walk(aa[i], bb[i], segs, out, summary, collect);
      segs.pop();
    }
    return;
  }

  // primitive or type-mismatch
  if (a === undefined) emit(out, summary, segs, { type: "added", right: b }, collect);
  else if (b === undefined) emit(out, summary, segs, { type: "removed", left: a }, collect);
  else emit(out, summary, segs, { type: "changed", left: a, right: b }, collect);
}

export function previewValue(v: unknown, max = 80): string {
  if (v === undefined) return "undefined";
  const s = JSON.stringify(v);
  if (s === undefined) return String(v);
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
