// Extract TransferData.json from a .7z archive using 7z-wasm.
// Falls back gracefully if WASM cannot be loaded.

let sevenZipPromise: Promise<any> | null = null;

async function getSevenZip(): Promise<any> {
  if (!sevenZipPromise) {
    sevenZipPromise = (async () => {
      // @ts-expect-error – module ships its own types in newer versions
      const mod = await import("7z-wasm");
      const factory = mod.default || mod;
      return factory();
    })();
  }
  return sevenZipPromise;
}

/**
 * Extract a TransferData.json from a 7z archive File.
 * Returns the JSON text as string.
 */
export async function extractTransferDataFrom7z(file: File): Promise<string> {
  const sevenZip = await getSevenZip();
  const buf = new Uint8Array(await file.arrayBuffer());
  const archiveName = "input.7z";

  // Write the archive into the virtual FS.
  sevenZip.FS.writeFile(archiveName, buf);

  // Extract everything (preserve paths) to /out
  try {
    sevenZip.FS.mkdir("/out");
  } catch {
    // dir exists
  }
  // -y answer Yes to all, x extract with full paths, -o output dir
  sevenZip.callMain(["x", archiveName, "-o/out", "-y"]);

  // Walk /out recursively to find TransferData.json
  const targetPath = findFileRecursive(sevenZip.FS, "/out", /transferdata\.json$/i);
  if (!targetPath) {
    throw new Error("TransferData.json not found inside the archive");
  }
  const data = sevenZip.FS.readFile(targetPath);
  const text = new TextDecoder("utf-8").decode(data);

  // cleanup virtual FS
  try {
    sevenZip.FS.unlink(archiveName);
  } catch {
    /* noop */
  }
  return text;
}

function findFileRecursive(FS: any, dir: string, re: RegExp): string | null {
  const entries: string[] = FS.readdir(dir).filter(
    (n: string) => n !== "." && n !== ".."
  );
  for (const name of entries) {
    const full = dir.replace(/\/$/, "") + "/" + name;
    const stat = FS.stat(full);
    const isDir = FS.isDir(stat.mode);
    if (isDir) {
      const found = findFileRecursive(FS, full, re);
      if (found) return found;
    } else if (re.test(name)) {
      return full;
    }
  }
  return null;
}

/** Read a plain JSON file as text. */
export async function readJsonFile(file: File): Promise<string> {
  return await file.text();
}
