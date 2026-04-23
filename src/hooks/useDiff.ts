import { useEffect, useRef, useState } from "react";
import type {
  DiffRequest,
  DiffResponse,
} from "@/workers/diff.worker";
import type { DiffEntry, DiffSummary } from "@/lib/diffEngine";

export interface DiffState {
  summary: DiffSummary;
  entries: DiffEntry[];
  computing: boolean;
}

const EMPTY_SUMMARY: DiffSummary = { added: 0, removed: 0, changed: 0, total: 0 };

const EMPTY: DiffState = {
  summary: EMPTY_SUMMARY,
  entries: [],
  computing: false,
};

function createWorker(): Worker {
  return new Worker(new URL("../workers/diff.worker.ts", import.meta.url), {
    type: "module",
  });
}

export function useDiff(
  left: unknown,
  right: unknown,
  wantEntries: boolean
): DiffState {
  const [state, setState] = useState<DiffState>(EMPTY);
  const workerRef = useRef<Worker | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    workerRef.current = createWorker();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    if (left === null && right === null) {
      setState(EMPTY);
      return;
    }

    const id = ++seqRef.current;
    setState((prev) => ({ ...prev, computing: true }));

    const handler = (e: MessageEvent<DiffResponse>) => {
      if (e.data.id !== id) return;
      setState({
        summary: e.data.summary,
        entries: e.data.entries,
        computing: false,
      });
      worker.removeEventListener("message", handler);
    };
    worker.addEventListener("message", handler);

    const msg: DiffRequest = {
      id,
      mode: wantEntries ? "full" : "count",
      left,
      right,
    };
    worker.postMessage(msg);

    return () => {
      worker.removeEventListener("message", handler);
    };
  }, [left, right, wantEntries]);

  return state;
}
