"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Clock, Trash2, RotateCcw } from "lucide-react";
import {
  loadHistory,
  deleteRecord,
  clearHistory,
  type HistoryRecord,
} from "@/lib/history";
import { gradeTailwind } from "@/lib/grading";

interface HistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (record: HistoryRecord) => void;
  refreshToken?: number;
}

export function HistoryPanel({ open, onOpenChange, onRestore, refreshToken }: HistoryPanelProps) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);

  const refresh = useCallback(() => {
    setRecords(loadHistory());
  }, []);

  useEffect(() => { refresh(); }, [refresh, refreshToken]);

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open, refresh]);

  const handleDelete = (id: string) => {
    deleteRecord(id);
    refresh();
  };

  const handleClear = () => {
    clearHistory();
    refresh();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={() => onOpenChange(false)}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-neutral-950 border-l border-neutral-800 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-800">
          <Clock size={15} className="text-sky-500" />
          <h2 className="text-sm font-semibold text-neutral-200">Analysis History</h2>
          <span className="ml-auto text-xs text-neutral-600">{records.length} records</span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X size={15} className="text-neutral-400" />
          </button>
        </div>

        {/* Records list */}
        <div className="flex-1 overflow-y-auto">
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
              <Clock size={24} className="text-neutral-700" />
              <p className="text-sm text-neutral-500">No analyses yet.</p>
              <p className="text-xs text-neutral-600">Upload tile photos to get started.</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-neutral-800">
              {records.map((r) => {
                const colors = gradeTailwind(r.analysis.grade);
                return (
                  <div key={r.id} className="flex items-start gap-3 px-4 py-3 hover:bg-neutral-900/50 group">
                    {/* Thumbnail */}
                    {r.photos[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`data:${r.photoMimes[0] ?? "image/jpeg"};base64,${r.photos[0]}`}
                        alt="tile"
                        className="w-14 h-14 object-cover rounded-lg border border-neutral-800 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-neutral-800 rounded-lg border border-neutral-700 flex-shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${colors.badge}`}>
                          Grade {r.analysis.grade}
                        </span>
                        <span className="text-xs text-neutral-600 font-mono truncate">{r.tileId}</span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        {r.analysis.total_defects} defect{r.analysis.total_defects !== 1 ? "s" : ""}
                      </p>
                      <p className="text-[10px] text-neutral-700 mt-0.5">
                        {new Date(r.timestamp).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => { onRestore(r); onOpenChange(false); }}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-sky-500/20 hover:text-sky-400 text-neutral-500 transition-colors"
                        title="Restore"
                      >
                        <RotateCcw size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-red-500/20 hover:text-red-400 text-neutral-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {records.length > 0 && (
          <div className="px-4 py-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={handleClear}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-neutral-700 text-neutral-500 text-xs hover:border-red-500/50 hover:text-red-400 transition-colors"
            >
              <Trash2 size={12} />
              Clear All History
            </button>
          </div>
        )}
      </div>
    </>
  );
}
