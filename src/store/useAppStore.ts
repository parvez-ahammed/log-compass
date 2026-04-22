import { create } from "zustand";
import type { FolderMatch, ScannedFile } from "@/lib/fileScanner";
import {
  defaultNormalizeOptions,
  type NormalizeOptions,
} from "@/lib/jsonNormalizer";

export type Side = "upload" | "download";

interface SideState {
  rawText: string | null;
  sourceLabel: string | null;
  loading: boolean;
  error: string | null;
}

const emptySide: SideState = {
  rawText: null,
  sourceLabel: null,
  loading: false,
  error: null,
};

interface AppState {
  rootName: string | null;
  scanned: ScannedFile[];
  uploadFolders: FolderMatch[];
  downloadFolders: FolderMatch[];
  selectedUpload: string | null;
  selectedDownload: string | null;

  upload: SideState;
  download: SideState;

  options: NormalizeOptions;
  ignoreKeysInput: string;

  setScan: (
    rootName: string,
    scanned: ScannedFile[],
    uploads: FolderMatch[],
    downloads: FolderMatch[]
  ) => void;
  selectFolder: (side: Side, folderPath: string) => void;
  setSide: (side: Side, patch: Partial<SideState>) => void;
  setOptions: (patch: Partial<NormalizeOptions>) => void;
  setIgnoreKeysInput: (s: string) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  rootName: null,
  scanned: [],
  uploadFolders: [],
  downloadFolders: [],
  selectedUpload: null,
  selectedDownload: null,
  upload: { ...emptySide },
  download: { ...emptySide },
  options: { ...defaultNormalizeOptions },
  ignoreKeysInput: "",

  setScan: (rootName, scanned, uploads, downloads) =>
    set({
      rootName,
      scanned,
      uploadFolders: uploads,
      downloadFolders: downloads,
      selectedUpload: uploads[0]?.folderPath ?? null,
      selectedDownload: downloads[0]?.folderPath ?? null,
      upload: { ...emptySide },
      download: { ...emptySide },
    }),

  selectFolder: (side, folderPath) =>
    set((s) =>
      side === "upload"
        ? { selectedUpload: folderPath, upload: { ...emptySide } }
        : { selectedDownload: folderPath, download: { ...emptySide } }
    ),

  setSide: (side, patch) =>
    set((s) => ({
      [side]: { ...s[side], ...patch },
    }) as Partial<AppState>),

  setOptions: (patch) =>
    set((s) => ({ options: { ...s.options, ...patch } })),

  setIgnoreKeysInput: (s) => set({ ignoreKeysInput: s }),

  reset: () =>
    set({
      rootName: null,
      scanned: [],
      uploadFolders: [],
      downloadFolders: [],
      selectedUpload: null,
      selectedDownload: null,
      upload: { ...emptySide },
      download: { ...emptySide },
    }),
}));
