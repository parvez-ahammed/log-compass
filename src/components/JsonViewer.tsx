import Editor from "@monaco-editor/react";
import { Card } from "@/components/ui/card";

interface JsonViewerProps {
  title: string;
  value: string;
  loading?: boolean;
  error?: string | null;
}

export function JsonViewer({ title, value, loading, error }: JsonViewerProps) {
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
        {loading ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : (
          <Editor
            value={value || "// no data"}
            language="json"
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              wordWrap: "on",
              scrollBeyondLastLine: false,
              renderLineHighlight: "none",
              lineNumbers: "on",
            }}
          />
        )}
      </div>
    </Card>
  );
}
