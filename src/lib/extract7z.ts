// Extract TransferData.json from a .7z archive using 7z-wasm.
// Falls back gracefully if WASM cannot be loaded.

let sevenZipPromise: Promise<any> | null = null;

async function getSevenZip(): Promise<any> {
  if (!sevenZipPromise) {
    sevenZipPromise = (async () => {
      const mod: any = await import("7z-wasm");
      const factory = mod.default || mod;
      return factory({
        locateFile: (path: string) => {
          if (path.endsWith(".wasm")) return "/wasm/7zz.wasm";
          return path;
        },
      });
    })();
  }
  return sevenZipPromise;
}

/**
 * Extract TransferData JSON text from a compressed archive File.
 * Handles gzip (what this logging system actually emits despite the
 * misleading `.7z` extension) and real 7z archives.
 */
export async function extractTransferDataFrom7z(file: File): Promise<string> {
  // Peek magic bytes without reading whole file — gzip path can stream
  // directly from disk instead of allocating a full-size Uint8Array.
  const headBuf = await file.slice(0, 2).arrayBuffer();
  const head = new Uint8Array(headBuf);

  if (head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b) {
    const ds = new DecompressionStream("gzip");
    const stream = file.stream().pipeThrough(ds);
    return await new Response(stream).text();
  }

  // Real 7z: must materialize full buffer for MEMFS write.
  const buf = new Uint8Array(await file.arrayBuffer());
  const sevenZip = await getSevenZip();
  const archiveName = "input.7z";
  sevenZip.FS.writeFile(archiveName, buf);
  try {
    sevenZip.FS.mkdir("/out");
  } catch {
    // dir exists
  }
  sevenZip.callMain(["x", archiveName, "-o/out", "-y"]);

  const targetPath =
    findFileRecursive(sevenZip.FS, "/out", /transferdata\.json$/i) ??
    findFileRecursive(sevenZip.FS, "/out", /\.json$/i);
  if (!targetPath) {
    throw new Error("TransferData.json not found inside the archive");
  }
  const data = sevenZip.FS.readFile(targetPath);
  const text = new TextDecoder("utf-8").decode(data);
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
