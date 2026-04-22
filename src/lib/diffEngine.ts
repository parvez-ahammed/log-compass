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

export function structuredDiff(left: unknown, right: unknown): DiffResult {
  const entries: DiffEntry[] = [];
  walk(left, right, "$", entries);
  const summary: DiffSummary = {
    added: entries.filter((e) => e.type === "added").length,
    removed: entries.filter((e) => e.type === "removed").length,
    changed: entries.filter((e) => e.type === "changed").length,
    total: entries.length,
  };
  return { entries, summary };
}

function walk(a: unknown, b: unknown, path: string, out: DiffEntry[]) {
  if (Object.is(a, b)) return;

  const aIsObj = a !== null && typeof a === "object" && !Array.isArray(a);
  const bIsObj = b !== null && typeof b === "object" && !Array.isArray(b);
  const aIsArr = Array.isArray(a);
  const bIsArr = Array.isArray(b);

  if (aIsObj && bIsObj) {
    const oa = a as Record<string, unknown>;
    const ob = b as Record<string, unknown>;
    const keys = new Set<string>([...Object.keys(oa), ...Object.keys(ob)]);
    for (const k of Array.from(keys).sort()) {
      const next = `${path}.${k}`;
      if (!(k in oa)) out.push({ path: next, type: "added", right: ob[k] });
      else if (!(k in ob)) out.push({ path: next, type: "removed", left: oa[k] });
      else walk(oa[k], ob[k], next, out);
    }
    return;
  }

  if (aIsArr && bIsArr) {
    const aa = a as unknown[];
    const bb = b as unknown[];
    const len = Math.max(aa.length, bb.length);
    for (let i = 0; i < len; i++) {
      const next = `${path}[${i}]`;
      if (i >= aa.length) out.push({ path: next, type: "added", right: bb[i] });
      else if (i >= bb.length) out.push({ path: next, type: "removed", left: aa[i] });
      else walk(aa[i], bb[i], next, out);
    }
    return;
  }

  // primitive or type-mismatch
  if (a === undefined) out.push({ path, type: "added", right: b });
  else if (b === undefined) out.push({ path, type: "removed", left: a });
  else out.push({ path, type: "changed", left: a, right: b });
}

export function previewValue(v: unknown, max = 80): string {
  if (v === undefined) return "undefined";
  const s = JSON.stringify(v);
  if (s === undefined) return String(v);
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
