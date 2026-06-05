"use client";

import { useEffect, useRef, useState } from "react";
import type { TileDimensions, TileSurfaceId } from "@/lib/tile";
import { getTileSurfaceSize, TILE_SURFACE_LABELS } from "@/lib/tile";
import type { TileAnalysis } from "@/lib/schema";
import { defectBboxColor } from "@/lib/grading";

interface TileGalleryProps {
  dimensions: TileDimensions;
  surfaceImages: Record<TileSurfaceId, string>;
  analysis?: TileAnalysis | null;
  selectedDefectId?: number | null;
  onSelectDefect?: (id: number | null) => void;
}

// Layout: face (large, square), then 4 thin edge strips
const LAYOUT: { surface: TileSurfaceId; fullWidth?: boolean }[] = [
  { surface: "face", fullWidth: true },
  { surface: "top_edge" },
  { surface: "bottom_edge" },
  { surface: "left_edge" },
  { surface: "right_edge" },
];

function bboxToPixels(bbox: number[], w: number, h: number) {
  const [ymin, xmin, ymax, xmax] = bbox;
  return {
    x: (xmin / 1000) * w,
    y: (ymin / 1000) * h,
    width: ((xmax - xmin) / 1000) * w,
    height: ((ymax - ymin) / 1000) * h,
  };
}

// ── Single surface tile (image + defect bbox overlay) ──────────────────────

interface SurfaceTileProps {
  surface: TileSurfaceId;
  dimensions: TileDimensions;
  image: string;
  defects?: TileAnalysis["defects"];
  selectedDefectId?: number | null;
  onSelectDefect?: (id: number | null) => void;
}

function SurfaceTile({ surface, dimensions, image, defects, selectedDefectId, onSelectDefect }: SurfaceTileProps) {
  const size = getTileSurfaceSize(surface, dimensions);
  const ar = size.width_mm / size.height_mm;
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const cv = overlayRef.current;
    const wrap = containerRef.current;
    if (!cv || !wrap) return;
    const draw = () => {
      const r = wrap.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      const dpr = window.devicePixelRatio || 1;
      cv.width = r.width * dpr;
      cv.height = r.height * dpr;
      cv.style.width = `${r.width}px`;
      cv.style.height = `${r.height}px`;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, r.width, r.height);
      if (!defects) return;
      // Only show defects that match this surface zone
      const zoneMatch = (zone: string) => {
        if (surface === "face") return zone === "face" || zone === "corner";
        return zone === "edge";
      };
      for (const d of defects) {
        if (!zoneMatch(d.zone)) continue;
        const isSel = selectedDefectId === d.id;
        const color = defectBboxColor(d.severity);
        const rect = bboxToPixels(d.bbox, r.width, r.height);
        ctx.strokeStyle = color;
        ctx.lineWidth = isSel ? 2.5 : 1.5;
        ctx.globalAlpha = isSel ? 1 : 0.85;
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.font = `bold ${Math.max(9, Math.min(12, rect.width / 3))}px ui-sans-serif, sans-serif`;
        const labelY = rect.y > 14 ? rect.y - 3 : rect.y + 12;
        ctx.fillText(`#${d.id}`, rect.x + 2, labelY);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [defects, selectedDefectId, surface]);

  // Force redraw tick when image changes
  useEffect(() => { tick((t) => t + 1); }, [image]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!defects || !onSelectDefect) return;
    const wrap = containerRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const hit = defects.find((d) => {
      const b = bboxToPixels(d.bbox, r.width, r.height);
      return mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height;
    });
    onSelectDefect(hit ? hit.id : null);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
          {TILE_SURFACE_LABELS[surface]}
        </span>
        <span className="text-[10px] text-neutral-600 font-mono">
          {size.width_mm} × {size.height_mm} mm
        </span>
      </div>
      <div
        ref={containerRef}
        onClick={handleClick}
        className="relative overflow-hidden border border-neutral-800 bg-neutral-900 cursor-pointer hover:border-neutral-700 transition-colors"
        style={{ aspectRatio: `${ar}` }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/jpeg;base64,${image}`}
            alt={`${surface} surface`}
            className="w-full h-full block"
            style={{ objectFit: "fill" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-neutral-700">
            Rendering…
          </div>
        )}
        <canvas ref={overlayRef} className="absolute inset-0 pointer-events-none" />
      </div>
    </div>
  );
}

// ── Main gallery ──────────────────────────────────────────────────────────────

export function TileGallery({ dimensions, surfaceImages, analysis, selectedDefectId, onSelectDefect }: TileGalleryProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Face — full width */}
      <SurfaceTile
        surface="face"
        dimensions={dimensions}
        image={surfaceImages.face ?? ""}
        defects={analysis?.defects}
        selectedDefectId={selectedDefectId}
        onSelectDefect={onSelectDefect}
      />

      {/* 4 edges — 2×2 grid */}
      <div className="grid grid-cols-2 gap-4">
        {(["top_edge", "bottom_edge", "left_edge", "right_edge"] as TileSurfaceId[]).map((s) => (
          <SurfaceTile
            key={s}
            surface={s}
            dimensions={dimensions}
            image={surfaceImages[s] ?? ""}
            defects={analysis?.defects}
            selectedDefectId={selectedDefectId}
            onSelectDefect={onSelectDefect}
          />
        ))}
      </div>
    </div>
  );
}
