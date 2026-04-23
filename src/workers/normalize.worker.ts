import { parseAndNormalize, type NormalizeOptions } from "@/lib/jsonNormalizer";

export interface NormalizeRequest {
  id: number;
  text: string;
  opts: NormalizeOptions;
}

export interface NormalizeResponse {
  id: number;
  json: unknown;
  pretty: string;
  error?: string;
}

self.onmessage = (e: MessageEvent<NormalizeRequest>) => {
  const { id, text, opts } = e.data;
  const result = parseAndNormalize(text, opts);
  const response: NormalizeResponse = {
    id,
    json: result.json,
    pretty: result.pretty,
    error: result.error,
  };
  (self as unknown as Worker).postMessage(response);
};

export {};
