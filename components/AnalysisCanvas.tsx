"use client";

import { useRef, useEffect, useCallback } from "react";
import type { TileDefect } from "@/lib/schema";
import { defectBboxColor } from "@/lib/grading";
import { DEFECT_TYPES } from "@/lib/defects";

interface AnalysisCanvasProps {
  image: string;
  mimeType: string;
  defects: TileDefect[];
  label?: string;
  selectedId: number | null;
  hoveredId: number | null;
  onDefectHover: (id: number | null) => void;
  onDefectClick: (id: number) => void;
  onImageLoad?: () => void;
}

function bboxToPixels(
  bbox: [number, number, number, number],
  w: number,
  h: number
) {
  const [ymin, xmin, ymax, xmax] = bbox;
  return {
    x: (xmin / 1000) * w,
    y: (ymin / 1000) * h,
    width: ((xmax - xmin) / 1000) * w,
    height: ((ymax - ymin) / 1000) * h,
  };
}

export function AnalysisCanvas({
  image,
  mimeType,
  defects,
  label,
  selectedId,
  hoveredId,
  onDefectHover,
  onDefectClick,
  onImageLoad,
}: AnalysisCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = containerRef.current;
    const cw = container?.clientWidth ?? img.naturalWidth;
    const scale = cw / img.naturalWidth;
    const ch = img.naturalHeight * scale;
    canvas.width = cw;
    canvas.height = ch;

    ctx.drawImage(img, 0, 0, cw, ch);

    for (const defect of defects) {
      const box = bboxToPixels(defect.bbox, cw, ch);
      const isActive = defect.id === selectedId || defect.id === hoveredId;
      const color = defectBboxColor(defect.severity);

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = isActive ? 2.5 : 1.5;
      ctx.globalAlpha = isActive ? 1 : 0.75;

      // Draw bbox
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.width, box.height);
      ctx.stroke();

      // Fill on hover/select
      if (isActive) {
        const hex = color.replace("#", "");
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.15)`;
        ctx.fillRect(box.x, box.y, box.width, box.height);
      }

      // Label
      const info = DEFECT_TYPES.find((t) => t.id === defect.type);
      const labelText = `#${defect.id} ${info?.name ?? defect.type}`;
      const fontSize = isActive ? 11 : 9;
      ctx.font = `${isActive ? "bold" : "normal"} ${fontSize}px sans-serif`;
      ctx.globalAlpha = isActive ? 1 : 0.85;
      ctx.fillStyle = "#0a0a0a";
      const textW = ctx.measureText(labelText).width;
      const labelX = box.x;
      const labelY = box.y > 14 ? box.y - 2 : box.y + box.height + 12;
      ctx.fillRect(labelX - 2, labelY - fontSize, textW + 6, fontSize + 4);
      ctx.fillStyle = color;
      ctx.fillText(labelText, labelX + 1, labelY);

      ctx.restore();
    }
  }, [defects, selectedId, hoveredId]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      draw();
      onImageLoad?.();
    };
    img.src = `data:${mimeType};base64,${image}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, mimeType]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const ro = new ResizeObserver(() => draw());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const my = ((e.clientY - rect.top) / rect.height) * canvas.height;

      for (const defect of defects) {
        const box = bboxToPixels(defect.bbox, canvas.width, canvas.height);
        if (mx >= box.x && mx <= box.x + box.width && my >= box.y && my <= box.y + box.height) {
          onDefectHover(defect.id);
          return;
        }
      }
      onDefectHover(null);
    },
    [defects, onDefectHover]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const my = ((e.clientY - rect.top) / rect.height) * canvas.height;

      for (const defect of defects) {
        const box = bboxToPixels(defect.bbox, canvas.width, canvas.height);
        if (mx >= box.x && mx <= box.x + box.width && my >= box.y && my <= box.y + box.height) {
          onDefectClick(defect.id);
          return;
        }
      }
    },
    [defects, onDefectClick]
  );

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-xs text-neutral-500 uppercase tracking-wider">{label}</span>
      )}
      <div ref={containerRef} className="w-full rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800">
        <canvas
          ref={canvasRef}
          className="w-full h-auto block cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => onDefectHover(null)}
          onClick={handleClick}
        />
      </div>
    </div>
  );
}
