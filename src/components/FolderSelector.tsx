import { useCallback, useRef, useState } from "react";
import { FolderOpen, RotateCcw, Settings2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { FileSelector } from "@/components/FileSelector";
import { Controls } from "@/components/Controls";
import { useAppStore } from "@/store/useAppStore";
import { detectFolders, groupByKind, toScannedFiles } from "@/lib/fileScanner";
import { cn } from "@/lib/utils";

export function FolderSelector() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { rootName, scanned, setScan, reset } = useAppStore();

  const handleFiles = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      const scanned = toScannedFiles(files);
      const matches = detectFolders(scanned);
      const { upload, download } = groupByKind(matches);
      const rootName =
        scanned[0]?.path.split("/")[0] ?? `${files.length} file(s)`;
      setScan(rootName, scanned, upload, download);
    },
    [setScan]
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    handleFiles(files);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const items = e.dataTransfer.items;
    if (!items) return;

    const files: File[] = [];
    const promises: Promise<void>[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const entry = (item as DataTransferItem & {
        webkitGetAsEntry?: () => FileSystemEntry | null;
      }).webkitGetAsEntry?.();
      if (entry) {
        promises.push(traverseEntry(entry, "", files));
      } else {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    await Promise.all(promises);
    handleFiles(files);
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-1 min-w-[260px] items-center gap-3 rounded-md border border-dashed px-4 py-3 transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/30"
          )}
        >
          <FolderOpen className="h-5 w-5 text-primary" />
          <div className="flex-1 min-w-0">
            {rootName ? (
              <>
                <div className="text-sm font-medium truncate">{rootName}</div>
                <div className="text-xs text-muted-foreground">
                  {scanned.length} file(s) scanned
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-medium">
                  Drop a log root folder here
                </div>
                <div className="text-xs text-muted-foreground">
                  or pick one — looks for{" "}
                  <span className="mono">Upload API Logs</span> /{" "}
                  <span className="mono">Download API Logs</span>
                </div>
              </>
            )}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          // @ts-expect-error – non-standard but widely supported
          webkitdirectory=""
          directory=""
          multiple
          hidden
          onChange={onPick}
        />
        <Button
          size="sm"
          variant="default"
          onClick={() => inputRef.current?.click()}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          Select folder
        </Button>
        {rootName && (
          <Button size="sm" variant="outline" onClick={reset} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        )}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={!rootName}
              title="Configure sources & comparison options"
            >
              <Settings2 className="h-4 w-4" /> Config
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="sm:max-w-md w-[92vw] overflow-y-auto"
          >
            <SheetHeader>
              <SheetTitle>Configuration</SheetTitle>
              <SheetDescription>
                Pick the TransferData sources and tune comparison options.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              <FileSelector side="upload" />
              <FileSelector side="download" />
              <Controls />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </Card>
  );
}

async function traverseEntry(
  entry: FileSystemEntry,
  pathPrefix: string,
  out: File[]
): Promise<void> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    await new Promise<void>((resolve) => {
      fileEntry.file((file) => {
        const rel = pathPrefix + file.name;
        // attach a webkitRelativePath-like field
        Object.defineProperty(file, "webkitRelativePath", {
          value: rel,
          configurable: true,
        });
        out.push(file);
        resolve();
      });
    });
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const readBatch = (): Promise<FileSystemEntry[]> =>
      new Promise((resolve) => reader.readEntries((es) => resolve(es)));
    let batch = await readBatch();
    while (batch.length > 0) {
      await Promise.all(
        batch.map((e) =>
          traverseEntry(e, pathPrefix + dirEntry.name + "/", out)
        )
      );
      batch = await readBatch();
    }
  }
}
