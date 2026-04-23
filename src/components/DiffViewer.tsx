import {
  Suspense,
  lazy,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { editor } from "monaco-editor";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Minus, Pencil, Plus } from "lucide-react";
import {
  previewValue,
  structuredDiff,
  type DiffEntry,
} from "@/lib/diffEngine";
import { useDiff } from "@/hooks/useDiff";

const DiffEditor = lazy(() =>
  import("@monaco-editor/react").then((m) => ({
    default: m.DiffEditor ?? m.default,
  }))
);

interface DiffViewerProps {
  leftLabel: string;
  rightLabel: string;
  leftText: string;
  rightText: string;
  leftJson: unknown;
  rightJson: unknown;
  wordDiff?: boolean;
  autoHideUnchanged?: boolean;
}

type Tab = "unified" | "split" | "structured";

export function DiffViewer({
  leftLabel,
  rightLabel,
  leftText,
  rightText,
  leftJson,
  rightJson,
  wordDiff = true,
  autoHideUnchanged = false,
}: DiffViewerProps) {
  const [tab, setTab] = useState<Tab>("unified");

  // Dual-mount strategy: keep both unified + split panes alive once
  // visited. Switching tabs is a CSS class flip, not a Monaco rebuild.
  // Initial visit to each pane still pays the full mount cost.
  const [mounted, setMounted] = useState<Record<"unified" | "split", boolean>>({
    unified: true,
    split: false,
  });

  useEffect(() => {
    if (tab === "unified" || tab === "split") {
      setMounted((prev) =>
        prev[tab] ? prev : { ...prev, [tab]: true }
      );
    }
  }, [tab]);

  const diff = useDiff(leftJson, rightJson, tab === "structured");

  const exportReport = async () => {
    const full =
      diff.entries.length > 0
        ? diff.entries
        : structuredDiff(leftJson, rightJson).entries;

    await new Promise((r) => setTimeout(r, 0));

    const report = {
      generatedAt: new Date().toISOString(),
      leftLabel,
      rightLabel,
      summary: diff.summary,
      changes: full,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transferdata-diff-report.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={tab === "unified" ? "default" : "ghost"}
            className={tab === "unified" ? undefined : "hover:bg-muted hover:text-foreground"}
            onClick={() => startTransition(() => setTab("unified"))}
          >
            Unified diff
          </Button>
          <Button
            size="sm"
            variant={tab === "split" ? "default" : "ghost"}
            className={tab === "split" ? undefined : "hover:bg-muted hover:text-foreground"}
            onClick={() => startTransition(() => setTab("split"))}
          >
            Split diff
          </Button>
          <Button
            size="sm"
            variant={tab === "structured" ? "default" : "ghost"}
            className={tab === "structured" ? undefined : "hover:bg-muted hover:text-foreground"}
            onClick={() => startTransition(() => setTab("structured"))}
          >
            Structured changes
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {diff.computing && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          <Badge variant="outline" className="gap-1 border-[hsl(var(--diff-add))] text-[hsl(var(--diff-add))]">
            <Plus className="h-3 w-3" /> {diff.summary.added}
          </Badge>
          <Badge variant="outline" className="gap-1 border-[hsl(var(--diff-remove))] text-[hsl(var(--diff-remove))]">
            <Minus className="h-3 w-3" /> {diff.summary.removed}
          </Badge>
          <Badge variant="outline" className="gap-1 border-[hsl(var(--diff-change))] text-[hsl(var(--diff-change))]">
            <Pencil className="h-3 w-3" /> {diff.summary.changed}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 hover:bg-muted hover:text-foreground"
            onClick={exportReport}
            disabled={!diff.summary.total}
          >
            <Download className="h-3.5 w-3.5" /> Report
          </Button>
        </div>
      </div>

      {tab !== "structured" && (
        <div className="grid grid-cols-2 border-b border-border text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <div className="px-3 py-1.5 truncate">{leftLabel}</div>
          <div className="px-3 py-1.5 truncate border-l border-border">
            {rightLabel}
          </div>
        </div>
      )}

      <div className="min-h-[420px] h-[640px] overflow-hidden relative">
        {mounted.unified && (
          <div
            className="absolute inset-0"
            style={{ display: tab === "unified" ? "block" : "none" }}
          >
            <MonacoDiffPane
              original={leftText}
              modified={rightText}
              renderSideBySide={false}
              wordDiff={wordDiff}
              autoHideUnchanged={autoHideUnchanged}
              active={tab === "unified"}
            />
          </div>
        )}
        {mounted.split && (
          <div
            className="absolute inset-0"
            style={{ display: tab === "split" ? "block" : "none" }}
          >
            <MonacoDiffPane
              original={leftText}
              modified={rightText}
              renderSideBySide={true}
              wordDiff={wordDiff}
              autoHideUnchanged={autoHideUnchanged}
              active={tab === "split"}
            />
          </div>
        )}
        {tab === "structured" && (
          <StructuredList entries={diff.entries} loading={diff.computing} />
        )}
      </div>
    </Card>
  );
}

interface MonacoDiffPaneProps {
  original: string;
  modified: string;
  renderSideBySide: boolean;
  wordDiff: boolean;
  autoHideUnchanged: boolean;
  active: boolean;
}

function MonacoDiffPane({
  original,
  modified,
  renderSideBySide,
  wordDiff,
  autoHideUnchanged,
  active,
}: MonacoDiffPaneProps) {
  const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const foldedForModelRef = useRef<string | null>(null);

  // Options are stable per pane — renderSideBySide never changes for a
  // given pane (one pane is unified, the other is split). wordDiff is
  // the only dynamic bit. So useUpdate on the wrapper fires at most
  // when wordDiff toggles.
  const editorOptions = useMemo(
    () => ({
      readOnly: true,
      renderSideBySide,
      renderMarginRevertIcon: false,
      enableSplitViewResizing: true,
      diffWordWrap: "off" as const,
      wordWrap: "off" as const,
      minimap: { enabled: false },
      fontSize: 12,
      scrollBeyondLastLine: false,
      renderLineHighlight: "none" as const,
      renderWhitespace: "none" as const,
      occurrencesHighlight: "off" as const,
      renderValidationDecorations: "off" as const,
      largeFileOptimizations: true,
      stopRenderingLineAfter: 10000,
      hideUnchangedRegions: {
        enabled: autoHideUnchanged,
        minimumLineCount: 1,
        contextLineCount: 3,
        revealLineCount: 20,
      },
      diffAlgorithm: "advanced" as const,
      renderIndicators: true,
      ignoreTrimWhitespace: !wordDiff,
    }),
    [renderSideBySide, wordDiff, autoHideUnchanged]
  );

  const applyFold = useCallback(() => {
    if (!autoHideUnchanged) return;
    const ed = editorRef.current;
    if (!ed) return;
    ed.updateOptions({
      hideUnchangedRegions: {
        enabled: true,
        minimumLineCount: 1,
        contextLineCount: 3,
        revealLineCount: 20,
      },
    });
    ed.getModifiedEditor()
      .getAction("diffEditor.collapseAllUnchangedRegions")
      ?.run();
  }, [autoHideUnchanged]);

  // Monaco stops computing layout / updating decorations for offscreen
  // editors only if explicitly told. When a pane becomes active again,
  // force a layout + sync scroll so it renders correctly.
  useEffect(() => {
    if (!active) return;
    const ed = editorRef.current;
    if (!ed) return;
    ed.layout();
  }, [active]);

  // Toggle-on: trigger the collapse action. Toggle-off: option change
  // alone unhides. Reset fingerprint so a later toggle-on re-folds.
  useEffect(() => {
    if (autoHideUnchanged) {
      applyFold();
    } else {
      foldedForModelRef.current = null;
    }
  }, [autoHideUnchanged, applyFold]);

  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
          Loading editor…
        </div>
      }
    >
      <DiffEditor
        original={original}
        modified={modified}
        language="json"
        theme="vs-dark"
        onMount={(ed) => {
          editorRef.current = ed;
          ed.onDidUpdateDiff(() => {
            const model = ed.getModel();
            const key =
              (model?.original.getValueLength() ?? 0) +
              ":" +
              (model?.modified.getValueLength() ?? 0);
            if (foldedForModelRef.current === key) return;
            foldedForModelRef.current = key;
            applyFold();
          });
        }}
        options={editorOptions}
      />
    </Suspense>
  );
}

function StructuredList({
  entries,
  loading,
}: {
  entries: DiffEntry[];
  loading: boolean;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  if (loading && entries.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Computing structured diff…
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        No structural differences detected.
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto scrollbar-thin">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: "relative",
          width: "100%",
        }}
      >
        {virtualizer.getVirtualItems().map((v) => {
          const e = entries[v.index];
          return (
            <div
              key={v.key}
              data-index={v.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${v.start}px)`,
              }}
              className="px-3 py-2 text-xs grid grid-cols-[auto,1fr] gap-3 items-start border-b border-border"
            >
              <Badge
                variant="outline"
                className={
                  e.type === "added"
                    ? "border-[hsl(var(--diff-add))] text-[hsl(var(--diff-add))]"
                    : e.type === "removed"
                    ? "border-[hsl(var(--diff-remove))] text-[hsl(var(--diff-remove))]"
                    : "border-[hsl(var(--diff-change))] text-[hsl(var(--diff-change))]"
                }
              >
                {e.type}
              </Badge>
              <div className="min-w-0">
                <div className="mono text-foreground/90 truncate">{e.path}</div>
                {e.type === "changed" && (
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <div className="mono text-[11px] rounded bg-[hsl(var(--diff-remove-bg))] px-2 py-1 truncate">
                      − {previewValue(e.left)}
                    </div>
                    <div className="mono text-[11px] rounded bg-[hsl(var(--diff-add-bg))] px-2 py-1 truncate">
                      + {previewValue(e.right)}
                    </div>
                  </div>
                )}
                {e.type === "added" && (
                  <div className="mono text-[11px] mt-1 rounded bg-[hsl(var(--diff-add-bg))] px-2 py-1 truncate">
                    + {previewValue(e.right)}
                  </div>
                )}
                {e.type === "removed" && (
                  <div className="mono text-[11px] mt-1 rounded bg-[hsl(var(--diff-remove-bg))] px-2 py-1 truncate">
                    − {previewValue(e.left)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
