"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Layers, Pencil, RefreshCw } from "lucide-react";
import {
  DEFECT_TYPES,
  DEFECT_CATEGORIES,
  getDefectsByCategory,
  type DefectCategory,
  type DefectTypeInfo,
} from "@/lib/defects";
import { renderDefectViews, type DefectView } from "@/lib/renderTile";

// ── Tile SVG helpers ───────────────────────────────────────────────────────────

const TW = 120;
const TH = 120;
const TILE_BG = "#d4d8e0";
const TILE_GLAZE = "#e8eaf0";
const TILE_EDGE = "#9ba3af";
const GROUT = "#6b7280";

function TileFace({ children }: { children?: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${TW} ${TH}`} className="w-full h-full" style={{ display: "block" }}>
      <rect x={0} y={0} width={TW} height={TH} fill={GROUT} />
      <rect x={3} y={3} width={TW - 6} height={TH - 6} fill={TILE_BG} />
      <rect x={3} y={3} width={TW - 6} height={TH - 6} fill={TILE_GLAZE} opacity={0.7} />
      <rect x={3} y={3} width={(TW - 6) * 0.6} height={(TH - 6) * 0.6} fill="white" opacity={0.08} />
      {children}
      <rect x={3} y={3} width={TW - 6} height={TH - 6} fill="none" stroke={TILE_EDGE} strokeWidth={0.8} />
    </svg>
  );
}

// ── Per-defect SVG shapes ──────────────────────────────────────────────────────

const DEFECT_SHAPES: Record<string, React.ReactNode> = {
  crack: (
    <TileFace>
      <path d="M 35 20 L 55 48 L 45 65 L 72 95" stroke="#374151" strokeWidth={1.5} fill="none" strokeLinecap="round" />
    </TileFace>
  ),
  crazing: (
    <TileFace>
      {["M 30 40 L 50 55 L 70 45","M 50 55 L 55 75","M 30 40 L 28 58","M 70 45 L 80 60 L 65 75","M 28 58 L 45 68 L 55 75","M 40 30 L 30 40","M 60 28 L 70 45"].map((d, i) => (
        <path key={i} d={d} stroke="#374151" strokeWidth={0.8} fill="none" opacity={0.7} />
      ))}
    </TileFace>
  ),
  pinhole: (
    <TileFace>
      <circle cx={45} cy={50} r={3} fill="#4b5563" />
      <circle cx={68} cy={38} r={2} fill="#4b5563" />
      <circle cx={60} cy={70} r={2.5} fill="#4b5563" />
    </TileFace>
  ),
  blister: (
    <TileFace>
      <ellipse cx={60} cy={55} rx={16} ry={10} fill="none" stroke="#4b5563" strokeWidth={1} />
      <ellipse cx={60} cy={55} rx={16} ry={10} fill="white" opacity={0.25} />
      <ellipse cx={56} cy={52} rx={5} ry={3} fill="white" opacity={0.4} />
    </TileFace>
  ),
  dry_spot: (
    <TileFace>
      <ellipse cx={58} cy={55} rx={22} ry={18} fill={TILE_BG} opacity={0.9} stroke="#9ba3af" strokeWidth={0.8} strokeDasharray="3 2" />
    </TileFace>
  ),
  speck: (
    <TileFace>
      <circle cx={50} cy={55} r={4} fill="#1f2937" />
      <circle cx={72} cy={42} r={2.5} fill="#374151" />
      <circle cx={38} cy={70} r={3} fill="#111827" />
    </TileFace>
  ),
  glaze_devitrification: (
    <TileFace>
      <ellipse cx={60} cy={58} rx={28} ry={22} fill="white" opacity={0.18} stroke="#9ca3af" strokeWidth={0.6} strokeDasharray="4 2" />
    </TileFace>
  ),
  scratch: (
    <TileFace>
      <line x1={30} y1={40} x2={85} y2={78} stroke="#4b5563" strokeWidth={1.2} strokeLinecap="round" />
    </TileFace>
  ),
  chip: (
    <TileFace>
      <polygon points="3,3 28,3 3,28" fill={GROUT} />
      <polygon points="3,3 28,3 14,14 3,28" fill="#9ca3af" opacity={0.5} />
    </TileFace>
  ),
  rough_edge: (
    <TileFace>
      <polyline points="3,3 10,8 18,4 26,9 34,5 42,10 50,5 58,9 66,4 74,8 82,4 90,9 98,5 106,9 114,4 117,3" stroke={TILE_EDGE} strokeWidth={2} fill={TILE_BG} />
    </TileFace>
  ),
  color_inconsistency: (
    <TileFace>
      <rect x={3} y={3} width={57} height={114} fill="#c8cdd8" opacity={0.6} />
      <rect x={60} y={3} width={57} height={114} fill="#dde0e8" opacity={0.6} />
      <line x1={60} y1={3} x2={60} y2={117} stroke="#ef4444" strokeWidth={0.8} strokeDasharray="4 2" />
    </TileFace>
  ),
  print_misalignment: (
    <TileFace>
      <rect x={25} y={30} width={70} height={60} fill="none" stroke="#374151" strokeWidth={1} strokeDasharray="4 2" />
      <rect x={30} y={35} width={70} height={60} fill="none" stroke="#0ea5e9" strokeWidth={1} opacity={0.7} />
    </TileFace>
  ),
};

// ── Defect card ────────────────────────────────────────────────────────────────

function DefectCard({ defect, selected, onClick }: { defect: DefectTypeInfo; selected: boolean; onClick: () => void }) {
  const severityColors = {
    low: "text-sky-400 bg-sky-500/10",
    medium: "text-amber-400 bg-amber-500/10",
    high: "text-red-400 bg-red-500/10",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-2 rounded-xl p-2 text-left transition-all ${
        selected ? "bg-sky-500/10 ring-1 ring-sky-500/60" : "hover:bg-neutral-800/60"
      }`}
    >
      <div className="w-full overflow-hidden rounded-lg border border-neutral-800" style={{ aspectRatio: "1/1" }}>
        {DEFECT_SHAPES[defect.id] ?? <TileFace><text x={TW/2} y={TH/2+4} textAnchor="middle" fill="#6b7280" fontSize="8">?</text></TileFace>}
      </div>
      <div className="flex flex-col gap-1 px-0.5">
        <span className={`text-xs font-semibold leading-tight ${selected ? "text-sky-300" : "text-neutral-300"}`}>{defect.name}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium w-fit ${severityColors[defect.severity_indicator]}`}>
          {defect.severity_indicator}
        </span>
      </div>
    </button>
  );
}

// ── Rendered example image ─────────────────────────────────────────────────────

function RenderedExample({ defectId }: { defectId: string }) {
  const [views, setViews] = useState<DefectView[] | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const result = await renderDefectViews(defectId);
      setViews(result);
    } catch {
      setViews(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defectId]);

  if (loading) {
    return (
      <div className="w-full h-24 border border-neutral-800 bg-neutral-900 flex items-center justify-center">
        <span className="text-xs text-neutral-600 animate-pulse">Rendering…</span>
      </div>
    );
  }

  if (!views) {
    return (
      <div className="w-full h-24 border border-neutral-800 bg-neutral-900 flex flex-col items-center justify-center gap-2">
        <span className="text-xs text-neutral-600">Render failed</span>
        <button type="button" onClick={generate} className="text-xs text-sky-400 hover:text-sky-300">Retry</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {views.map((v, i) => (
        <div key={i} className="flex flex-col gap-1">
          {v.label && (
            <span className="text-[10px] uppercase tracking-widest text-neutral-600 font-medium">{v.label}</span>
          )}
          <div className="relative w-full border border-neutral-800 overflow-hidden rounded">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${v.surface.base64}`}
              alt={`${defectId} ${v.label || "example"}`}
              className="w-full h-auto block"
            />
            {i === 0 && (
              <button
                type="button"
                onClick={generate}
                className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-neutral-950/70 text-neutral-400 hover:text-neutral-200 transition-colors"
                title="Regenerate"
              >
                <RefreshCw size={11} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Detail panel ───────────────────────────────────────────────────────────────

function DefectDetailExpanded({ defect }: { defect: DefectTypeInfo }) {
  return (
    <div className="border border-sky-500/30 rounded-2xl bg-neutral-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-800 flex items-center gap-3">
        <ChevronDown size={15} className="text-sky-500 flex-shrink-0" />
        <div>
          <h3 className="font-bold text-neutral-100">{defect.name}</h3>
          <p className="text-xs text-neutral-500 mt-0.5 capitalize">{defect.category.replace("_", " & ")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-neutral-800">
        {/* Left: SVG diagram */}
        <div className="p-5 flex flex-col gap-2">
          <p className="text-xs uppercase tracking-widest text-neutral-600">Diagram</p>
          <div className="w-full max-w-[160px] mx-auto border border-neutral-800 rounded-xl overflow-hidden" style={{ aspectRatio: "1/1" }}>
            {DEFECT_SHAPES[defect.id] ?? <TileFace />}
          </div>
        </div>

        {/* Center: rendered example + import button */}
        <div className="p-5 flex flex-col gap-2">
          <p className="text-xs uppercase tracking-widest text-neutral-600">Rendered example</p>
          <div className="max-w-[180px] mx-auto w-full">
            <RenderedExample defectId={defect.id} />
          </div>
          <p className="text-[10px] text-neutral-700 text-center mt-1">
            Generated from the tile renderer — same engine as the Editor.
          </p>
          <Link
            href={`/editor?defect=${defect.id}`}
            className="mt-1 w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-neutral-700 text-xs font-medium text-neutral-300 hover:border-sky-500/50 hover:text-sky-300 transition-colors"
          >
            <Pencil size={12} />
            Import to Editor
          </Link>
        </div>

        {/* Right: description / cause / detection */}
        <div className="p-5 flex flex-col gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Description</p>
            <p className="text-sm text-neutral-300 leading-relaxed">{defect.description}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Cause</p>
            <p className="text-sm text-neutral-300 leading-relaxed">{defect.cause}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">How AI detects it</p>
            <p className="text-sm text-neutral-300 leading-relaxed">{defect.detection}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main guide component ───────────────────────────────────────────────────────

export function DefectGuide() {
  const [activeFilter, setActiveFilter] = useState<DefectCategory | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredCategories =
    activeFilter === "all"
      ? DEFECT_CATEGORIES
      : DEFECT_CATEGORIES.filter((c) => c.id === activeFilter);

  const selectedDefect = selectedId ? DEFECT_TYPES.find((d) => d.id === selectedId) : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {[{ id: "all" as const, label: "All Defects" }, ...DEFECT_CATEGORIES].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setActiveFilter(f.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              activeFilter === f.id
                ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500"
            }`}
          >
            {f.label ?? "All Defects"}
          </button>
        ))}
      </div>

      {/* Category sections */}
      {filteredCategories.map((cat) => {
        const catDefects = getDefectsByCategory(cat.id);
        return (
          <div key={cat.id} className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                <Layers size={13} className="text-sky-500 flex-shrink-0" />
                {cat.label}
              </h3>
              <p className="text-xs text-neutral-500 pl-5">{cat.description}</p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {catDefects.map((defect) => (
                <DefectCard
                  key={defect.id}
                  defect={defect}
                  selected={selectedId === defect.id}
                  onClick={() => setSelectedId(selectedId === defect.id ? null : defect.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Expanded detail panel */}
      {selectedDefect && <DefectDetailExpanded defect={selectedDefect} />}
    </div>
  );
}
