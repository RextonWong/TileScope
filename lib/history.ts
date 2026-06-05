import type { TileAnalysis } from "@/lib/schema";
import type { EditableDefect, TileDimensions } from "@/lib/tile";

export interface HistoryRecord {
  id: string;
  tileId: string;
  timestamp: string;
  analysis: TileAnalysis;
  photos: string[]; // base64 thumbnails (no data: prefix)
  photoMimes: string[];
}

const STORAGE_KEY = "tilescope_history";
const MAX_RECORDS = 20;

export interface EditorRecord {
  id: string;
  tileId: string;
  timestamp: string;
  dimensions: TileDimensions;
  defects: EditableDefect[];
  analysis: TileAnalysis;
  thumb: string; // base64 thumbnail of tile diagram
}

const EDITOR_STORAGE_KEY = "tilescope_editor_history";
const MAX_EDITOR_RECORDS = 15;

export function loadHistory(): HistoryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryRecord[];
  } catch {
    return [];
  }
}

export function saveRecord(record: HistoryRecord): void {
  const history = loadHistory();
  const updated = [record, ...history.filter((r) => r.id !== record.id)].slice(0, MAX_RECORDS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    const trimmed = updated.slice(0, 10);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch { /* storage unavailable */ }
  }
}

export function deleteRecord(id: string): void {
  const history = loadHistory().filter((r) => r.id !== id);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch { /* ignore */ }
}

export function clearHistory(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export async function generateThumbnail(
  base64: string,
  mime: string,
  targetWidth = 240
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = targetWidth / img.naturalWidth;
      const w = targetWidth;
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(base64); return; }
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      const b64 = dataUrl.split(",")[1] ?? base64;
      resolve(b64);
    };
    img.onerror = () => resolve(base64);
    img.src = `data:${mime};base64,${base64}`;
  });
}

function buildExportJson(record: HistoryRecord): object {
  const { analysis, tileId, timestamp } = record;
  return {
    tilescope_version: "1.0",
    exported_at: new Date().toISOString(),
    tile_id: tileId,
    analyzed_at: timestamp,
    summary: {
      grade: analysis.grade,
      use_case: analysis.use_case,
      total_defects: analysis.total_defects,
      viewing_distance_3ft: analysis.viewing_distance_3ft,
      viewing_distance_10ft: analysis.viewing_distance_10ft,
      reasoning: analysis.reasoning,
    },
    defects: analysis.defects,
    detailed_analysis: analysis.detailed_analysis,
    standards: ["ISO 10545-2", "EN 14411", "ANSI A137.1"],
  };
}

function triggerDownload(filename: string, json: object): void {
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportRecordJson(record: HistoryRecord): void {
  triggerDownload(`tilescope-${record.tileId}.json`, buildExportJson(record));
}

export function exportAllJson(records: HistoryRecord[]): void {
  const payload = {
    tilescope_version: "1.0",
    exported_at: new Date().toISOString(),
    record_count: records.length,
    records: records.map(buildExportJson),
  };
  triggerDownload(`tilescope-history-${Date.now()}.json`, payload);
}

// ── Editor history ─────────────────────────────────────────────────────────────

export function loadEditorHistory(): EditorRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EDITOR_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as EditorRecord[];
  } catch {
    return [];
  }
}

export function saveEditorRecord(record: EditorRecord): void {
  const all = loadEditorHistory();
  const updated = [record, ...all.filter((r) => r.id !== record.id)].slice(0, MAX_EDITOR_RECORDS);
  try {
    localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    const trimmed = updated.slice(0, 8);
    try { localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(trimmed)); } catch { /* ignore */ }
  }
}

export function deleteEditorRecord(id: string): void {
  const all = loadEditorHistory().filter((r) => r.id !== id);
  try { localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(all)); } catch { /* ignore */ }
}
