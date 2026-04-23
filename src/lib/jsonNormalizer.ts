export interface NormalizeOptions {
  sortKeys: boolean;
  ignoreNulls: boolean;
  ignoreOrdering: boolean;
  ignoreKeys: string[];
  /** common unstable fields like timestamps, ids */
  stripTimestamps: boolean;
  stripIds: boolean;
}

export const defaultNormalizeOptions: NormalizeOptions = {
  sortKeys: true,
  ignoreNulls: false,
  ignoreOrdering: false,
  ignoreKeys: [],
  stripTimestamps: false,
  stripIds: false,
};

const TIMESTAMP_KEY_RE = /(time|date|timestamp|createdat|updatedat|modified)/i;
const ID_KEY_RE = /(^id$|guid|uuid|.+id$)/i;

function shouldDrop(key: string, opts: NormalizeOptions): boolean {
  if (opts.ignoreKeys.includes(key)) return true;
  if (opts.stripTimestamps && TIMESTAMP_KEY_RE.test(key)) return true;
  if (opts.stripIds && ID_KEY_RE.test(key)) return true;
  return false;
}

export function normalizeValue(value: unknown, opts: NormalizeOptions): unknown {
  if (Array.isArray(value)) {
    let arr = value.map((v) => normalizeValue(v, opts));
    if (opts.ignoreNulls) arr = arr.filter((v) => v !== null && v !== undefined);
    if (opts.ignoreOrdering) {
      arr = [...arr].sort((a, b) => {
        const sa = stableStringify(a);
        const sb = stableStringify(b);
        return sa < sb ? -1 : sa > sb ? 1 : 0;
      });
    }
    return arr;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => !shouldDrop(k, opts));
    // Case-insensitive sort so `SP_Act_foo` sits next to `foo` rather
    // than being grouped with all other uppercase-prefixed keys.
    const sortedKeys = opts.sortKeys
      ? [...keys].sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        )
      : keys;
    const out: Record<string, unknown> = {};
    for (const k of sortedKeys) {
      const v = normalizeValue(obj[k], opts);
      if (opts.ignoreNulls && (v === null || v === undefined)) continue;
      out[k] = v;
    }
    return out;
  }
  return value;
}

export function parseAndNormalize(
  text: string,
  opts: NormalizeOptions
): { json: unknown; pretty: string; error?: string } {
  try {
    // Strip UTF-8 BOM and whitespace — common cause of silent parse failure
    // that falls back to raw unsorted text.
    const cleaned = text.replace(/^﻿/, "").trim();
    const parsed = JSON.parse(cleaned);
    // Force sortKeys so upload/download render in identical key order,
    // making line diffs meaningful regardless of source ordering.
    const normalized = normalizeValue(parsed, { ...opts, sortKeys: true });
    return { json: normalized, pretty: JSON.stringify(normalized, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return { json: null, pretty: text, error: err };
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") +
    "}"
  );
}
