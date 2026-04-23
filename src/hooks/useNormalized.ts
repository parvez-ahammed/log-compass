import { useEffect, useRef, useState } from "react";
import type { NormalizeOptions } from "@/lib/jsonNormalizer";
import type {
  NormalizeRequest,
  NormalizeResponse,
} from "@/workers/normalize.worker";

export interface NormalizedResult {
  json: unknown;
  pretty: string;
  error?: string;
  computing: boolean;
}

const EMPTY: NormalizedResult = {
  json: null,
  pretty: "",
  error: undefined,
  computing: false,
};

function createWorker(): Worker {
  return new Worker(new URL("../workers/normalize.worker.ts", import.meta.url), {
    type: "module",
  });
}

export function useNormalized(
  text: string | null,
  opts: NormalizeOptions
): NormalizedResult {
  const [state, setState] = useState<NormalizedResult>(EMPTY);
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
    if (!text) {
      setState(EMPTY);
      return;
    }
    const worker = workerRef.current;
    if (!worker) return;

    const id = ++seqRef.current;
    setState((prev) => ({ ...prev, computing: true }));

    const handler = (e: MessageEvent<NormalizeResponse>) => {
      if (e.data.id !== id) return;
      setState({
        json: e.data.json,
        pretty: e.data.pretty,
        error: e.data.error,
        computing: false,
      });
      worker.removeEventListener("message", handler);
    };
    worker.addEventListener("message", handler);

    const msg: NormalizeRequest = { id, text, opts };
    worker.postMessage(msg);

    return () => {
      worker.removeEventListener("message", handler);
    };
  }, [text, opts]);

  return state;
}
