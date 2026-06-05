"use client";

import type { TileAnalysis, TileDefect } from "@/lib/schema";
import { DEFECT_TYPES } from "@/lib/defects";
import { severityTailwind, useCaseLabel } from "@/lib/grading";
import { ShieldCheck, AlertTriangle, Info } from "lucide-react";

interface DefectDetailPanelProps {
  analysis: TileAnalysis;
  selectedId: number | null;
  onSelectDefect: (id: number) => void;
}

export function DefectDetailPanel({ analysis, selectedId, onSelectDefect }: DefectDetailPanelProps) {
  const selected = analysis.defects.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 flex flex-col overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center gap-2">
        <ShieldCheck size={14} className="text-sky-500" />
        <h3 className="text-sm font-semibold text-neutral-200">
          Defect Details
        </h3>
        <span className="ml-auto text-xs text-neutral-600">
          {analysis.total_defects} found
        </span>
      </div>

      {selected ? (
        <DefectDetail defect={selected} />
      ) : (
        <DefectList defects={analysis.defects} selectedId={selectedId} onSelect={onSelectDefect} />
      )}
    </div>
  );
}

function DefectDetail({ defect }: { defect: TileDefect }) {
  const info = DEFECT_TYPES.find((t) => t.id === defect.type);
  const sevColors = severityTailwind(defect.severity);

  return (
    <div className="p-4 flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base font-bold text-neutral-100">#{defect.id} — {info?.name ?? defect.type}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${sevColors}`}>
            {defect.severity}
          </span>
        </div>
        <span className="text-xs text-neutral-500">{info?.category?.replace("_", " ") ?? ""} · zone: {defect.zone} · {Math.round(defect.confidence * 100)}% confidence</span>
      </div>

      {info && (
        <>
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-600 mb-1">Description</p>
            <p className="text-sm text-neutral-300 leading-relaxed">{info.description}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-600 mb-1">Cause</p>
            <p className="text-sm text-neutral-300 leading-relaxed">{info.cause}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-600 mb-1">AI Detection</p>
            <p className="text-sm text-neutral-300 leading-relaxed">{info.detection}</p>
          </div>
        </>
      )}
    </div>
  );
}

function DefectList({
  defects,
  selectedId,
  onSelect,
}: {
  defects: TileDefect[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (defects.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center gap-2 text-center">
        <Info size={20} className="text-neutral-600" />
        <p className="text-sm text-neutral-500">No defects detected.</p>
        <p className="text-xs text-neutral-600">This tile passed all checks.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-neutral-800 overflow-y-auto">
      {defects.map((d) => {
        const info = DEFECT_TYPES.find((t) => t.id === d.type);
        const isSelected = d.id === selectedId;
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onSelect(d.id)}
            className={`flex items-start gap-3 px-4 py-3 text-left hover:bg-neutral-800/50 transition-colors ${isSelected ? "bg-sky-500/10" : ""}`}
          >
            <AlertTriangle
              size={13}
              className={`mt-0.5 flex-shrink-0 ${d.severity === "severe" ? "text-red-400" : d.severity === "moderate" ? "text-amber-400" : "text-sky-400"}`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${isSelected ? "text-sky-300" : "text-neutral-300"}`}>
                  #{d.id} {info?.name ?? d.type}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${severityTailwind(d.severity)}`}>
                  {d.severity}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5 truncate">{d.zone} · {Math.round(d.confidence * 100)}% conf.</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
