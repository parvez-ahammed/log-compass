import { useRef } from "react";
import { ArrowDownToLine, ArrowUpToLine, FileJson, Loader2, Upload } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAppStore, type Side } from "@/store/useAppStore";
import { extractTransferDataFrom7z, readJsonFile } from "@/lib/extract7z";

interface FileSelectorProps {
  side: Side;
}

export function FileSelector({ side }: FileSelectorProps) {
  const fallbackRef = useRef<HTMLInputElement>(null);

  const folders = useAppStore((s) =>
    side === "upload" ? s.uploadFolders : s.downloadFolders
  );
  const selected = useAppStore((s) =>
    side === "upload" ? s.selectedUpload : s.selectedDownload
  );
  const sideState = useAppStore((s) => s[side]);
  const selectFolder = useAppStore((s) => s.selectFolder);
  const setSide = useAppStore((s) => s.setSide);

  const onFallbackPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSide(side, { loading: true, error: null });
    try {
      const text = file.name.toLowerCase().endsWith(".7z")
        ? await extractTransferDataFrom7z(file)
        : await readJsonFile(file);
      setSide(side, {
        rawText: text,
        sourceLabel: file.name,
        loading: false,
        error: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSide(side, { loading: false, error: msg });
    } finally {
      // Allow re-picking the same file.
      e.target.value = "";
    }
  };

  const Icon = side === "upload" ? ArrowUpToLine : ArrowDownToLine;
  const label = side === "upload" ? "Upload API Logs" : "Download API Logs";

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-accent" />
        <div className="text-sm font-medium flex-1">{label}</div>
        {sideState.loading && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="mt-2">
        {folders.length > 0 ? (
          <Select
            value={selected ?? undefined}
            onValueChange={(v) => selectFolder(side, v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select folder" />
            </SelectTrigger>
            <SelectContent>
              {folders.map((f) => (
                <SelectItem key={f.folderPath} value={f.folderPath}>
                  <span className="mono text-xs">{f.folderPath}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="text-xs text-muted-foreground py-2">
            No matching folder detected
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground min-h-[20px]">
        {sideState.sourceLabel && !sideState.error && (
          <>
            <FileJson className="h-3.5 w-3.5 text-primary" />
            <span className="mono truncate">{sideState.sourceLabel}</span>
          </>
        )}
        {sideState.error && (
          <span className="text-destructive truncate">⚠ {sideState.error}</span>
        )}
      </div>

      {sideState.error && (
        <div className="mt-2">
          <input
            ref={fallbackRef}
            type="file"
            accept=".json,.7z,application/json"
            hidden
            onChange={onFallbackPick}
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-2 hover:bg-muted hover:text-foreground"
            onClick={() => {
              const el = fallbackRef.current;
              if (!el) return;
              el.value = "";
              el.click();
            }}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload JSON / .7z manually
          </Button>
        </div>
      )}
    </Card>
  );
}
