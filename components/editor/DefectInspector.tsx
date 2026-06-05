"use client";

import type { EditableDefect, ZoneId } from "@/lib/tile";
import { ZONE_LABELS } from "@/lib/tile";
import { DEFECT_TYPES, DEFECT_CATEGORIES } from "@/lib/defects";
import { severityTailwind } from "@/lib/grading";
import { Trash2, X, RotateCw, Maximize2 } from "lucide-react";

interface DefectInspectorProps {
  defect: EditableDefect | null;
  onUpdate: (updated: EditableDefect) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function DefectInspector({ defect, onUpdate, onDelete, onClose }: DefectInspectorProps) {
  if (!defect) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 flex flex-col items-center gap-2 text-center">
        <p className="text-sm text-neutral-500">Click a zone on the tile to add a defect.</p>
        <p className="text-xs text-neutral-600">Then click a marker to inspect it.</p>
      </div>
    );
  }

  const info = DEFECT_TYPES.find((t) => t.id === defect.type);
  const size = defect.size ?? 1.0;
  const rotation = defect.rotation ?? 0;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center gap-2">
        <span className="text-sm font-semibold text-neutral-200 flex-1 truncate">
          {info?.name ?? defect.type}
        </span>
        <span className="text-xs text-neutral-600">{ZONE_LABELS[defect.zone as ZoneId]}</span>
        <button type="button" onClick={onClose} className="p-1 hover:bg-neutral-800 rounded transition-colors">
          <X size={13} className="text-neutral-500" />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Defect type */}
        <div>
          <label className="text-xs uppercase tracking-wider text-neutral-500 block mb-2">Defect Type</label>
          <div className="flex flex-col gap-2">
            {DEFECT_CATEGORIES.map((cat) => (
              <div key={cat.id}>
                <p className="text-[10px] text-neutral-600 uppercase tracking-wider mb-1">{cat.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {DEFECT_TYPES.filter((d) => d.category === cat.id).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onUpdate({ ...defect, type: t.id })}
                      className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
                        defect.type === t.id
                          ? "bg-sky-500/20 border-sky-500/50 text-sky-300"
                          : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Severity */}
        <div>
          <label className="text-xs uppercase tracking-wider text-neutral-500 block mb-2">Severity</label>
          <div className="flex gap-2">
            {(["minor", "major", "critical"] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => onUpdate({ ...defect, severity: sev })}
                className={`flex-1 text-xs py-2 rounded-xl border font-medium capitalize transition-colors ${
                  defect.severity === sev
                    ? severityTailwind(sev === "major" ? "moderate" : sev === "critical" ? "severe" : "minor")
                    : "border-neutral-700 text-neutral-500 hover:border-neutral-500"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {/* Size */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <Maximize2 size={10} className="text-neutral-600" />
              Marker Size
            </label>
            <span className="text-xs font-mono text-neutral-400">{size.toFixed(1)}×</span>
          </div>
          <input
            type="range"
            min={0.3}
            max={30}
            step={0.5}
            value={size}
            onChange={(e) => onUpdate({ ...defect, size: parseFloat(e.target.value) })}
            className="w-full accent-sky-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-neutral-700 mt-0.5">
            <span>0.3×</span>
            <span>30×</span>
          </div>
        </div>

        {/* Rotation */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <RotateCw size={10} className="text-neutral-600" />
              Rotation
            </label>
            <span className="text-xs font-mono text-neutral-400">{Math.round(rotation)}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            step={5}
            value={rotation}
            onChange={(e) => onUpdate({ ...defect, rotation: parseFloat(e.target.value) })}
            className="w-full accent-sky-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-neutral-700 mt-0.5">
            <span>0°</span>
            <span>360°</span>
          </div>
        </div>

        {/* Zone */}
        <div>
          <label className="text-xs uppercase tracking-wider text-neutral-500 block mb-2">Zone</label>
          <select
            value={defect.zone}
            onChange={(e) => onUpdate({ ...defect, zone: e.target.value as ZoneId })}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-neutral-200 outline-none focus:border-sky-500/60"
          >
            {(["face", "top_edge", "right_edge", "bottom_edge", "left_edge",
               "top_left_corner", "top_right_corner", "bottom_right_corner", "bottom_left_corner"] as ZoneId[]).map((z) => (
              <option key={z} value={z}>{ZONE_LABELS[z]}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs uppercase tracking-wider text-neutral-500 block mb-2">Notes (optional)</label>
          <textarea
            value={defect.notes ?? ""}
            onChange={(e) => onUpdate({ ...defect, notes: e.target.value })}
            placeholder="Add notes…"
            rows={2}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-neutral-200 outline-none focus:border-sky-500/60 resize-none placeholder:text-neutral-600"
          />
        </div>

        {/* Delete */}
        <button
          type="button"
          onClick={() => onDelete(defect.id)}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-neutral-700 text-neutral-500 text-sm hover:border-red-500/50 hover:text-red-400 transition-colors"
        >
          <Trash2 size={13} />
          Remove Defect
        </button>
      </div>
    </div>
  );
}
