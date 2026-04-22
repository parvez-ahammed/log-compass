import { useEffect, useMemo } from "react";
import { FolderSelector } from "@/components/FolderSelector";
import { JsonViewer } from "@/components/JsonViewer";
import { DiffViewer } from "@/components/DiffViewer";
import { useAppStore } from "@/store/useAppStore";
import { parseAndNormalize } from "@/lib/jsonNormalizer";
import { useAutoLoadTransfer } from "@/hooks/useAutoLoadTransfer";
import { GitCompareArrows } from "lucide-react";

const Index = () => {
  // Force dark mode default
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useAutoLoadTransfer();

  const { upload, download, options } = useAppStore();

  const left = useMemo(
    () =>
      upload.rawText
        ? parseAndNormalize(upload.rawText, options)
        : { json: null, pretty: "", error: undefined as string | undefined },
    [upload.rawText, options]
  );
  const right = useMemo(
    () =>
      download.rawText
        ? parseAndNormalize(download.rawText, options)
        : { json: null, pretty: "", error: undefined as string | undefined },
    [download.rawText, options]
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/40 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-[1600px] px-6 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-primary/15 flex items-center justify-center">
            <GitCompareArrows className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold">TransferData Diff</h1>
            <p className="text-xs text-muted-foreground">
              Compare Upload vs Download API logs locally — nothing leaves your browser.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-5 space-y-4">
        <FolderSelector />

        <div className="grid lg:grid-cols-2 gap-4">
          <JsonViewer
            title="Upload — TransferData.json"
            value={left.pretty}
            loading={upload.loading}
            error={left.error || upload.error}
          />
          <JsonViewer
            title="Download — TransferData.json"
            value={right.pretty}
            loading={download.loading}
            error={right.error || download.error}
          />
        </div>

        <DiffViewer
          leftLabel={upload.sourceLabel || "Upload"}
          rightLabel={download.sourceLabel || "Download"}
          leftText={left.pretty}
          rightText={right.pretty}
          leftJson={left.json}
          rightJson={right.json}
        />

        <footer className="text-center text-xs text-muted-foreground py-6">
          100% client-side · no uploads · drop a folder to begin
        </footer>
      </main>
    </div>
  );
};

export default Index;
