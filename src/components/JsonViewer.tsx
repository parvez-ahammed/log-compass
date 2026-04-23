import { Suspense, lazy, useEffect, useRef, useState } from "react";
import type { editor } from "monaco-editor";
import { Card } from "@/components/ui/card";

const Editor = lazy(() =>
  import("@monaco-editor/react").then((m) => ({ default: m.Editor ?? m.default }))
);

interface JsonViewerProps {
  title: string;
  value: string;
  loading?: boolean;
  error?: string | null;
}

export function JsonViewer({ title, value, loading, error }: JsonViewerProps) {
  const [ready, setReady] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setReady(true));
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    return () => {
      editorRef.current?.getModel()?.dispose();
      editorRef.current = null;
    };
  }, []);

  return (
    <Card className="flex flex-col overflow-hidden h-[420px]">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
        {error && (
          <div className="text-xs text-destructive truncate ml-2">{error}</div>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {loading || !ready ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            }
          >
            <Editor
              value={value || "// no data"}
              language="json"
              theme="vs-dark"
              onMount={(ed) => {
                editorRef.current = ed;
              }}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 12,
                wordWrap: "on",
                scrollBeyondLastLine: false,
                renderLineHighlight: "none",
                lineNumbers: "on",
                largeFileOptimizations: true,
                stopRenderingLineAfter: 10000,
                renderWhitespace: "none",
                occurrencesHighlight: "off",
                renderValidationDecorations: "off",
                folding: true,
                foldingStrategy: "indentation",
                guides: { indentation: false },
              }}
            />
          </Suspense>
        )}
      </div>
    </Card>
  );
}
