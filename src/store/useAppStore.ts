import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
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

  /** Highlight intra-line changed tokens in orange (WORDS compare method). */
  wordDiff: boolean;

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
  setWordDiff: (v: boolean) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
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
      wordDiff: true,

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

      setWordDiff: (v) => set({ wordDiff: v }),

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
    }),
    {
      name: "log-compass-settings",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Persist only user preferences. Transient state (scanned files,
      // loaded rawText, folder selections) stays in-memory — File objects
      // aren't serializable and stale folder paths would break reloads.
      partialize: (s) => ({
        options: s.options,
        ignoreKeysInput: s.ignoreKeysInput,
        wordDiff: s.wordDiff,
      }),
    }
  )
);
