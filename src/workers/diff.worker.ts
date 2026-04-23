import {
  countDiff,
  structuredDiff,
  type DiffEntry,
  type DiffSummary,
} from "@/lib/diffEngine";

export interface DiffRequest {
  id: number;
  mode: "count" | "full";
  left: unknown;
  right: unknown;
}

export interface DiffResponse {
  id: number;
  summary: DiffSummary;
  entries: DiffEntry[];
}

self.onmessage = (e: MessageEvent<DiffRequest>) => {
  const { id, mode, left, right } = e.data;
  let summary: DiffSummary;
  let entries: DiffEntry[] = [];
  if (mode === "full") {
    const r = structuredDiff(left, right);
    summary = r.summary;
    entries = r.entries;
  } else {
    summary = countDiff(left, right);
  }
  const response: DiffResponse = { id, summary, entries };
  (self as unknown as Worker).postMessage(response);
};

export {};
