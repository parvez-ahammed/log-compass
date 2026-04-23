import { useMemo, useState } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Minus, Pencil, Plus } from "lucide-react";
import { previewValue, structuredDiff } from "@/lib/diffEngine";

interface DiffViewerProps {
  leftLabel: string;
  rightLabel: string;
  leftText: string;
  rightText: string;
  leftJson: unknown;
  rightJson: unknown;
  wordDiff?: boolean;
}

const TEXT_DIFF_LIMIT = 200_000; // chars per side
const STRUCTURED_LIMIT = 2000; // entries shown

export function DiffViewer({
  leftLabel,
  rightLabel,
  leftText,
  rightText,
  leftJson,
  rightJson,
  wordDiff = true,
}: DiffViewerProps) {
  const [tab, setTab] = useState<"unified" | "split" | "structured">("unified");

  const tooLarge =
    leftText.length > TEXT_DIFF_LIMIT || rightText.length > TEXT_DIFF_LIMIT;

  const structured = useMemo(() => {
    if (leftJson === null && rightJson === null) {
      return { entries: [], summary: { added: 0, removed: 0, changed: 0, total: 0 } };
    }
    return structuredDiff(leftJson, rightJson);
  }, [leftJson, rightJson]);

  const truncatedEntries = structured.entries.slice(0, STRUCTURED_LIMIT);

  const exportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      leftLabel,
      rightLabel,
      summary: structured.summary,
      changes: structured.entries,
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
            onClick={() => setTab("unified")}
          >
            Unified diff
          </Button>
          <Button
            size="sm"
            variant={tab === "split" ? "default" : "ghost"}
            onClick={() => setTab("split")}
          >
            Split diff
          </Button>
          <Button
            size="sm"
            variant={tab === "structured" ? "default" : "ghost"}
            onClick={() => setTab("structured")}
          >
            Structured changes
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 border-[hsl(var(--diff-add))] text-[hsl(var(--diff-add))]">
            <Plus className="h-3 w-3" /> {structured.summary.added}
          </Badge>
          <Badge variant="outline" className="gap-1 border-[hsl(var(--diff-remove))] text-[hsl(var(--diff-remove))]">
            <Minus className="h-3 w-3" /> {structured.summary.removed}
          </Badge>
          <Badge variant="outline" className="gap-1 border-[hsl(var(--diff-change))] text-[hsl(var(--diff-change))]">
            <Pencil className="h-3 w-3" /> {structured.summary.changed}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={exportReport}
            disabled={!structured.entries.length}
          >
            <Download className="h-3.5 w-3.5" /> Report
          </Button>
        </div>
      </div>

      <div className="min-h-[380px] max-h-[640px] overflow-auto scrollbar-thin">
        {tab !== "structured" ? (
          tooLarge ? (
            <div className="p-6 text-sm text-muted-foreground">
              Files are large ({leftText.length.toLocaleString()} /{" "}
              {rightText.length.toLocaleString()} chars). Switched to structured
              view for performance — click "Structured changes".
            </div>
          ) : (
            <ReactDiffViewer
              oldValue={leftText}
              newValue={rightText}
              splitView={tab === "split"}
              useDarkTheme
              // WORDS highlights which tokens inside a changed line differ
              // (rendered orange below). LINES shows only whole-line adds/
              // removes without intra-line detail.
              compareMethod={wordDiff ? DiffMethod.WORDS : DiffMethod.LINES}
              leftTitle={leftLabel}
              rightTitle={rightLabel}
              styles={{
                variables: {
                  dark: {
                    diffViewerBackground: "hsl(222 16% 11%)",
                    addedBackground: "hsl(142 60% 18%)",
                    addedColor: "hsl(142 70% 80%)",
                    removedBackground: "hsl(0 60% 18%)",
                    removedColor: "hsl(0 70% 85%)",
                    // GitHub-style intra-line: deeper shade of parent line
                    // color. Readers instantly map word-highlight → line
                    // type without a third color to decode.
                    wordAddedBackground: "hsl(142 80% 32%)",
                    wordRemovedBackground: "hsl(0 80% 35%)",
                    gutterBackground: "hsl(222 14% 14%)",
                    gutterColor: "hsl(215 14% 60%)",
                    codeFoldBackground: "hsl(222 14% 16%)",
                  },
                },
                contentText: {
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  fontSize: 12,
                },
              }}
            />
          )
        ) : (
          <ScrollArea className="h-[600px]">
            {truncatedEntries.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No structural differences detected.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {truncatedEntries.map((e, i) => (
                  <li
                    key={i}
                    className="px-3 py-2 text-xs grid grid-cols-[auto,1fr] gap-3 items-start"
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
                      <div className="mono text-foreground/90 truncate">
                        {e.path}
                      </div>
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
                  </li>
                ))}
                {structured.entries.length > STRUCTURED_LIMIT && (
                  <li className="px-3 py-2 text-xs text-muted-foreground">
                    Showing first {STRUCTURED_LIMIT} of{" "}
                    {structured.entries.length} changes. Export the report for
                    the full list.
                  </li>
                )}
              </ul>
            )}
          </ScrollArea>
        )}
      </div>
    </Card>
  );
}
