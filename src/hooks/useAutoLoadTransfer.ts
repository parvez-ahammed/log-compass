import { useEffect, useMemo } from "react";
import { extractTransferDataFrom7z, readJsonFile } from "@/lib/extract7z";
import { useAppStore, type Side } from "@/store/useAppStore";

function useLoadSide(side: Side) {
  const folders = useAppStore((s) =>
    side === "upload" ? s.uploadFolders : s.downloadFolders
  );
  const selected = useAppStore((s) =>
    side === "upload" ? s.selectedUpload : s.selectedDownload
  );
  const setSide = useAppStore((s) => s.setSide);

  // folders.find returns a fresh reference-comparable result on every render.
  // Memoize to stop the effect from re-running (and re-loading the file) on
  // unrelated store updates.
  const current = useMemo(
    () => folders.find((f) => f.folderPath === selected),
    [folders, selected]
  );

  useEffect(() => {
    if (!current) return;
    const tf = current.transferFile;
    if (!tf) {
      setSide(side, {
        rawText: null,
        sourceLabel: null,
        loading: false,
        error: "TransferData.json not found in this folder",
      });
      return;
    }

    let cancelled = false;
    const run = async () => {
      setSide(side, { loading: true, error: null, rawText: null });
      try {
        const text = tf.path.toLowerCase().endsWith(".7z")
          ? await extractTransferDataFrom7z(tf.file)
          : await readJsonFile(tf.file);
        if (cancelled) return;
        setSide(side, {
          rawText: text,
          sourceLabel: tf.path,
          loading: false,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setSide(side, { loading: false, error: msg });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [current, side, setSide]);
}

export function useAutoLoadTransfer() {
  useLoadSide("upload");
  useLoadSide("download");
}
