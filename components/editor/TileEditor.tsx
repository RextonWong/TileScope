"use client";

import { useState, useCallback } from "react";
import type { EditableDefect, ZoneId } from "@/lib/tile";
import { ZONE_LABELS, DEFAULT_TILE_DIMENSIONS } from "@/lib/tile";
import { DEFECT_TYPES } from "@/lib/defects";
import { severityTailwind } from "@/lib/grading";

// ── Zone layout constants ──────────────────────────────────────────────────────
// The tile is rendered as a 3×3 grid:
//   [TL corner] [Top Edge  ] [TR corner]
//   [Left Edge ] [  FACE   ] [Right Edge]
//   [BL corner] [Bot Edge  ] [BR corner]

const FACE_SIZE = 200;
const EDGE_W = 40;
const CORNER_W = 40;
const GRID_GAP = 2;

const ZONE_RECTS: Record<ZoneId, { x: number; y: number; w: number; h: number }> = {
  top_left_corner:    { x: 0,                       y: 0,                       w: CORNER_W,  h: CORNER_W  },
  top_edge:           { x: CORNER_W + GRID_GAP,     y: 0,                       w: FACE_SIZE, h: EDGE_W    },
  top_right_corner:   { x: CORNER_W + GRID_GAP + FACE_SIZE + GRID_GAP, y: 0,   w: CORNER_W,  h: CORNER_W  },
  left_edge:          { x: 0,                       y: CORNER_W + GRID_GAP,     w: EDGE_W,    h: FACE_SIZE },
  face:               { x: CORNER_W + GRID_GAP,     y: CORNER_W + GRID_GAP,     w: FACE_SIZE, h: FACE_SIZE },
  right_edge:         { x: CORNER_W + GRID_GAP + FACE_SIZE + GRID_GAP, y: CORNER_W + GRID_GAP, w: EDGE_W, h: FACE_SIZE },
  bottom_left_corner: { x: 0,                       y: CORNER_W + GRID_GAP + FACE_SIZE + GRID_GAP, w: CORNER_W, h: CORNER_W },
  bottom_edge:        { x: CORNER_W + GRID_GAP,     y: CORNER_W + GRID_GAP + FACE_SIZE + GRID_GAP, w: FACE_SIZE, h: EDGE_W },
  bottom_right_corner:{ x: CORNER_W + GRID_GAP + FACE_SIZE + GRID_GAP, y: CORNER_W + GRID_GAP + FACE_SIZE + GRID_GAP, w: CORNER_W, h: CORNER_W },
};

const TOTAL_W = CORNER_W + GRID_GAP + FACE_SIZE + GRID_GAP + CORNER_W;
const TOTAL_H = CORNER_W + GRID_GAP + FACE_SIZE + GRID_GAP + CORNER_W;

// Zone fill colors
const ZONE_FILLS: Record<ZoneId, string> = {
  face:               "#e8eaf0",
  top_edge:           "#c8cdd8",
  right_edge:         "#c8cdd8",
  bottom_edge:        "#c8cdd8",
  left_edge:          "#c8cdd8",
  top_left_corner:    "#9ba3af",
  top_right_corner:   "#9ba3af",
  bottom_left_corner: "#9ba3af",
  bottom_right_corner:"#9ba3af",
};

const SEVERITY_COLORS: Record<string, string> = {
  minor: "#0ea5e9",
  major: "#f59e0b",
  critical: "#ef4444",
};

interface TileEditorProps {
  defects: EditableDefect[];
  selectedDefectId: string | null;
  onAddDefect: (zone: ZoneId, x: number, y: number) => void;
  onSelectDefect: (id: string | null) => void;
}

export function TileEditor({
  defects,
  selectedDefectId,
  onAddDefect,
  onSelectDefect,
}: TileEditorProps) {
  const [hoveredZone, setHoveredZone] = useState<ZoneId | null>(null);

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const scaleX = TOTAL_W / rect.width;
      const scaleY = TOTAL_H / rect.height;
      const svgX = (e.clientX - rect.left) * scaleX;
      const svgY = (e.clientY - rect.top) * scaleY;

      // Check if clicking an existing defect marker
      for (const zone of Object.keys(ZONE_RECTS) as ZoneId[]) {
        const zr = ZONE_RECTS[zone];
        if (svgX >= zr.x && svgX <= zr.x + zr.w && svgY >= zr.y && svgY <= zr.y + zr.h) {
          const nx = (svgX - zr.x) / zr.w;
          const ny = (svgY - zr.y) / zr.h;

          // Check if we clicked a defect marker
          const hit = defects.find((d) => {
            if (d.zone !== zone) return false;
            const zr2 = ZONE_RECTS[zone];
            const dx = zr2.x + d.x * zr2.w;
            const dy = zr2.y + d.y * zr2.h;
            return Math.abs(svgX - dx) < 8 && Math.abs(svgY - dy) < 8;
          });

          if (hit) {
            onSelectDefect(hit.id === selectedDefectId ? null : hit.id);
          } else {
            onAddDefect(zone, nx, ny);
          }
          return;
        }
      }
    },
    [defects, selectedDefectId, onAddDefect, onSelectDefect]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const scaleX = TOTAL_W / rect.width;
      const scaleY = TOTAL_H / rect.height;
      const svgX = (e.clientX - rect.left) * scaleX;
      const svgY = (e.clientY - rect.top) * scaleY;

      for (const zone of Object.keys(ZONE_RECTS) as ZoneId[]) {
        const zr = ZONE_RECTS[zone];
        if (svgX >= zr.x && svgX <= zr.x + zr.w && svgY >= zr.y && svgY <= zr.y + zr.h) {
          setHoveredZone(zone);
          return;
        }
      }
      setHoveredZone(null);
    },
    []
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-neutral-500">
        Click a zone to add a defect. Click an existing defect marker to select it.
      </p>
      <div className="relative w-full max-w-sm mx-auto">
        <svg
          viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
          className="w-full h-auto cursor-crosshair"
          onClick={handleSvgClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredZone(null)}
        >
          {/* Zone rectangles */}
          {(Object.keys(ZONE_RECTS) as ZoneId[]).map((zone) => {
            const zr = ZONE_RECTS[zone];
            const isHovered = hoveredZone === zone;
            return (
              <g key={zone}>
                <rect
                  x={zr.x}
                  y={zr.y}
                  width={zr.w}
                  height={zr.h}
                  fill={isHovered ? "#0ea5e9" : ZONE_FILLS[zone]}
                  opacity={isHovered ? 0.3 : 1}
                  stroke="#6b7280"
                  strokeWidth={0.8}
                />
                {/* Zone label for larger zones */}
                {(zone === "face" || zone === "top_edge" || zone === "left_edge" || zone === "right_edge" || zone === "bottom_edge") && (
                  <text
                    x={zr.x + zr.w / 2}
                    y={zr.y + zr.h / 2 + 3}
                    textAnchor="middle"
                    fontSize={zone === "face" ? 9 : 6}
                    fill="#6b7280"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {zone === "face" ? "FACE" : ZONE_LABELS[zone].replace(" Edge", "").replace(" Corner", "")}
                  </text>
                )}
              </g>
            );
          })}

          {/* Defect markers */}
          {defects.map((d) => {
            const zr = ZONE_RECTS[d.zone as ZoneId];
            if (!zr) return null;
            const mx = zr.x + d.x * zr.w;
            const my = zr.y + d.y * zr.h;
            const color = SEVERITY_COLORS[d.severity] ?? "#6b7280";
            const isSelected = d.id === selectedDefectId;
            const info = DEFECT_TYPES.find((t) => t.id === d.type);
            return (
              <g key={d.id}>
                <circle
                  cx={mx}
                  cy={my}
                  r={isSelected ? 7 : 5}
                  fill={color}
                  stroke="white"
                  strokeWidth={isSelected ? 1.5 : 1}
                  opacity={0.9}
                  style={{ pointerEvents: "none" }}
                />
                {isSelected && (
                  <text
                    x={mx}
                    y={my - 10}
                    textAnchor="middle"
                    fontSize={7}
                    fill={color}
                    fontWeight="bold"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {info?.name ?? d.type}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Zone tooltip */}
        {hoveredZone && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-neutral-900 border border-neutral-700 rounded-full text-xs text-sky-400 pointer-events-none whitespace-nowrap">
            {ZONE_LABELS[hoveredZone]} — click to add defect
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 justify-center text-xs text-neutral-500 flex-wrap">
        {(["minor", "major", "critical"] as const).map((sev) => (
          <div key={sev} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[sev] }} />
            <span className="capitalize">{sev}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
