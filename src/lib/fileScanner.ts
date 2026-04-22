// Scans a list of files (from <input webkitdirectory> or drag&drop)
// to locate "Upload API Logs" and "Download API Logs" subfolders and the
// TransferData.json[.7z] inside each.

export type FolderKind = "upload" | "download";

export interface ScannedFile {
  /** full relative path including root folder */
  path: string;
  /** the File object */
  file: File;
}

export interface FolderMatch {
  /** folder path (the Upload/Download API Logs directory) */
  folderPath: string;
  /** kind detected */
  kind: FolderKind;
  /** transfer data file inside this folder, if any */
  transferFile?: ScannedFile;
  /** all files inside this folder */
  files: ScannedFile[];
}

const UPLOAD_RE = /(^|\/)upload[\s_-]*api[\s_-]*logs?(\/|$)/i;
const DOWNLOAD_RE = /(^|\/)download[\s_-]*api[\s_-]*logs?(\/|$)/i;
// Matches files like "TransferData.json", "TransferData.json.7z",
// or prefixed variants like "20260422183855_943_TransferData.json[.7z]".
const TRANSFER_RE = /transferdata\.json(\.7z)?$/i;

export function getRelativePath(file: File): string {
  // Browser sets webkitRelativePath when using <input webkitdirectory>
  const rel: string = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  return rel;
}

export function toScannedFiles(files: FileList | File[]): ScannedFile[] {
  const arr = Array.from(files as ArrayLike<File>);
  return arr.map((file) => ({ path: getRelativePath(file), file }));
}

function folderOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

/** Find all Upload/Download API Logs folders. */
export function detectFolders(files: ScannedFile[]): FolderMatch[] {
  const folderMap = new Map<string, FolderMatch>();

  for (const f of files) {
    const dir = folderOf(f.path);
    if (!dir) continue;

    // Walk up the path to find the matching ancestor folder
    const segments = dir.split("/");
    for (let i = segments.length; i > 0; i--) {
      const ancestor = segments.slice(0, i).join("/");
      const tail = ancestor.toLowerCase();
      let kind: FolderKind | null = null;
      if (UPLOAD_RE.test("/" + tail + "/")) kind = "upload";
      else if (DOWNLOAD_RE.test("/" + tail + "/")) kind = "download";
      if (!kind) continue;

      let match = folderMap.get(ancestor);
      if (!match) {
        match = { folderPath: ancestor, kind, files: [] };
        folderMap.set(ancestor, match);
      }
      match.files.push(f);
      if (TRANSFER_RE.test(f.path) && !match.transferFile) {
        match.transferFile = f;
      }
      break;
    }
  }

  return Array.from(folderMap.values()).sort((a, b) =>
    a.folderPath.localeCompare(b.folderPath)
  );
}

export function groupByKind(matches: FolderMatch[]): Record<FolderKind, FolderMatch[]> {
  return {
    upload: matches.filter((m) => m.kind === "upload"),
    download: matches.filter((m) => m.kind === "download"),
  };
}
