"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import {
  Grid2X2,
  ArrowLeft,
  Zap,
  ImageIcon,
  RotateCcw,
  Download,
  ChevronLeft,
  FileJson2,
} from "lucide-react";
import type { TileAnalysis } from "@/lib/schema";
import type { EditableDefect, TileDimensions, TileSurfaceId } from "@/lib/tile";
import {
  DEFAULT_TILE_DIMENSIONS,
  TILE_SURFACE_IDS,
} from "@/lib/tile";
import { renderAllTileSurfaces } from "@/lib/renderTile";
import { TILE_SAMPLE_PRESETS } from "@/lib/tileSamples";
import { gradeTailwind, gradeLabel, useCaseLabel, severityTailwind } from "@/lib/grading";
import { DEFECT_TYPES } from "@/lib/defects";
import { ZONE_LABELS } from "@/lib/tile";
import { type EditorRecord, saveEditorRecord } from "@/lib/history";
import { GradeCard } from "@/components/GradeCard";
import { LoadingState } from "@/components/LoadingState";
import { DefectInspector } from "@/components/editor/DefectInspector";
import { TileGallery } from "@/components/editor/TileGallery";
import { DetailedAnalysisPanel } from "@/components/editor/DetailedAnalysisPanel";

// R3F import — client only, avoids SSR Three.js issues
const Tile3D = dynamic(
  () => import("@/components/editor/Tile3D").then((m) => m.Tile3D),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-neutral-950 flex items-center justify-center text-xs text-neutral-600">
        Loading 3D viewer…
      </div>
    ),
  }
);

type Phase = "edit" | "preview" | "loading" | "results";

function nanoid8() {
  return Math.random().toString(36).substring(2, 10);
}

function EditorPageInner() {
  const searchParams = useSearchParams();

  const [dimensions, setDimensions] = useState<TileDimensions>(DEFAULT_TILE_DIMENSIONS);
  const [defects, setDefects] = useState<EditableDefect[]>([]);
  const [selectedDefectId, setSelectedDefectId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("edit");
  const [surfaceImages, setSurfaceImages] = useState<Record<TileSurfaceId, string> | null>(null);
  const [analysis, setAnalysis] = useState<TileAnalysis | null>(null);
  const [generating, setGenerating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [selectedResultDefect, setSelectedResultDefect] = useState<number | null>(null);
  const tileIdRef = useRef(`tile-${Date.now()}`);

  // Load sample preset from URL (?defect=<typeId> or ?preset=<sampleId>)
  useEffect(() => {
    const defectParam = searchParams.get("defect");
    const presetParam = searchParams.get("preset");
    const id = defectParam ?? presetParam;
    if (!id) return;
    const preset = TILE_SAMPLE_PRESETS.find((p) => p.defectTypeId === id || p.id === id);
    if (!preset) return;
    setDefects(preset.defects);
    setSelectedDefectId(null);
    setPhase("edit");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Defect ops ───────────────────────────────────────────────────────────────

  const handleAddDefect = useCallback((surface: TileSurfaceId, x: number, y: number) => {
    // Map surface to default zone
    const zoneMap: Record<TileSurfaceId, EditableDefect["zone"]> = {
      face: "face",
      top_edge: "top_edge",
      bottom_edge: "bottom_edge",
      left_edge: "left_edge",
      right_edge: "right_edge",
    };
    const newDefect: EditableDefect = {
      id: nanoid8(),
      zone: zoneMap[surface],
      type: "speck",
      x,
      y,
      severity: "minor",
    };
    setDefects((prev) => [...prev, newDefect]);
    setSelectedDefectId(newDefect.id);
  }, []);

  const handleUpdateDefect = useCallback((updated: EditableDefect) => {
    setDefects((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }, []);

  const handleDeleteDefect = useCallback((id: string) => {
    setDefects((prev) => prev.filter((d) => d.id !== id));
    setSelectedDefectId(null);
  }, []);

  const handleMoveDefect = useCallback((id: string, x: number, y: number) => {
    setDefects((prev) => prev.map((d) => (d.id === id ? { ...d, x, y } : d)));
  }, []);

  const selectedDefect = useMemo(
    () => defects.find((d) => d.id === selectedDefectId) ?? null,
    [defects, selectedDefectId]
  );

  // ── Step 1: Render tile surface images ───────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    const toastId = toast.loading("Rendering tile surfaces…");
    try {
      const rendered = await renderAllTileSurfaces(dimensions, defects);
      const imgs = {} as Record<TileSurfaceId, string>;
      for (const s of TILE_SURFACE_IDS) imgs[s] = rendered[s].base64;
      setSurfaceImages(imgs);
      setAnalysis(null);
      setSelectedResultDefect(null);
      setPhase("preview");
      toast.success("Surface images generated — review them below.", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Render failed", { id: toastId });
    } finally {
      setGenerating(false);
    }
  }, [dimensions, defects]);

  // ── Step 2: Send rendered images to Gemini ───────────────────────────────────

  const handleAnalyse = useCallback(async () => {
    if (!surfaceImages) return;
    setPhase("loading");
    try {
      const surfaces = {} as Record<TileSurfaceId, { base64: string; mime: string }>;
      for (const s of TILE_SURFACE_IDS) {
        surfaces[s] = { base64: surfaceImages[s], mime: "image/jpeg" };
      }
      const res = await fetch("/api/analyze-editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surfaces }),
      });
      const data = (await res.json()) as unknown;
      if (!res.ok) {
        const err = data as { error?: string };
        throw new Error(err.error ?? "Analysis failed");
      }
      const result = data as TileAnalysis;
      setAnalysis(result);
      tileIdRef.current = `tile-${Date.now()}`;
      setPhase("results");
      toast.success(
        `Grade ${result.grade} — ${result.total_defects} defect${result.total_defects !== 1 ? "s" : ""} detected.`,
        { duration: 5000 }
      );

      // Save to history
      const record: EditorRecord = {
        id: tileIdRef.current,
        tileId: tileIdRef.current,
        timestamp: new Date().toISOString(),
        dimensions,
        defects,
        analysis: result,
        thumb: surfaceImages.face ?? "",
      };
      saveEditorRecord(record);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
      setPhase("preview");
    }
  }, [surfaceImages, dimensions, defects]);

  const handleDownloadPdf = async () => {
    if (!analysis) return;
    setDownloadingPdf(true);
    const toastId = toast.loading("Generating PDF report…");
    try {
      const photos = surfaceImages
        ? TILE_SURFACE_IDS.map((s) => surfaceImages[s]).filter(Boolean)
        : [];
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis,
          photos,
          photoMimes: photos.map(() => "image/jpeg"),
          tileId: tileIdRef.current,
        }),
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tilescope-editor-${tileIdRef.current}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded.", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF failed", { id: toastId });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleExportJson = () => {
    if (!analysis) return;
    const payload = {
      tilescope_version: "1.0",
      kind: "editor",
      exported_at: new Date().toISOString(),
      tile_id: tileIdRef.current,
      dimensions,
      summary: {
        grade: analysis.grade,
        use_case: analysis.use_case,
        total_defects: analysis.total_defects,
        reasoning: analysis.reasoning,
      },
      defects: analysis.defects,
      detailed_analysis: analysis.detailed_analysis,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tilescope-editor-${tileIdRef.current}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setDefects([]);
    setSelectedDefectId(null);
    setSurfaceImages(null);
    setAnalysis(null);
    setPhase("edit");
    tileIdRef.current = `tile-${Date.now()}`;
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Nav */}
      <nav className="border-b border-neutral-800 px-4 sm:px-6 py-4 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-200 transition-colors">
          <ArrowLeft size={15} />
          <span className="text-sm">Back</span>
        </Link>
        <div className="w-px h-5 bg-neutral-800" />
        <Grid2X2 size={18} className="text-sky-500" />
        <span className="font-bold text-base tracking-tight">TileScope</span>
        <span className="text-xs text-neutral-600 font-medium">/ Tile Editor</span>

        {/* Phase breadcrumb */}
        <div className="ml-auto flex items-center gap-2 text-xs">
          {(["edit", "preview", "results"] as const).map((p, i) => (
            <span key={p} className="flex items-center gap-2">
              {i > 0 && <span className="text-neutral-700">›</span>}
              <span className={phase === p || (phase === "loading" && p === "preview") ? "text-sky-400 font-semibold" : "text-neutral-600"}>
                {p === "edit" ? "1. Edit" : p === "preview" ? "2. Preview" : "3. Results"}
              </span>
            </span>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ── LOADING ── */}
        {phase === "loading" && <LoadingState />}

        {/* ── EDIT PHASE ── */}
        {phase === "edit" && (
          <div className="flex flex-col xl:flex-row gap-4 xl:gap-6">
            {/* Center: 3D editor */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h1 className="text-xl font-bold">Step 1 · Place Defects in 3D</h1>
                <p className="text-sm text-neutral-500">
                  Click any surface of the 3D tile to add a defect marker. Drag existing markers to reposition.
                  Then generate surface images — Gemini scans the rendered images, not the 3D model.
                </p>
              </div>

              <div
                className="rounded-2xl border border-neutral-800 overflow-hidden bg-neutral-900"
                style={{ height: "55vh", minHeight: 380 }}
              >
                <Tile3D
                  dimensions={dimensions}
                  defects={defects}
                  selectedDefectId={selectedDefectId}
                  onAddDefect={handleAddDefect}
                  onSelectDefect={setSelectedDefectId}
                  onMoveDefect={handleMoveDefect}
                />
              </div>

              {/* Defect chips */}
              {defects.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {defects.map((d) => {
                    const info = DEFECT_TYPES.find((t) => t.id === d.type);
                    const sev = d.severity === "critical" ? "severe" : d.severity === "major" ? "moderate" : "minor";
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedDefectId(d.id === selectedDefectId ? null : d.id)}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          d.id === selectedDefectId
                            ? "bg-sky-500/20 border-sky-500/50 text-sky-300"
                            : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${severityTailwind(sev).split(" ").find(c => c.startsWith("bg-")) ?? "bg-neutral-500"}`} />
                        {info?.name ?? d.type}
                        <span className="text-neutral-600">·</span>
                        <span className="text-neutral-500">{ZONE_LABELS[d.zone as keyof typeof ZONE_LABELS]}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Tile settings */}
              <details className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden group">
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer text-sm font-semibold text-neutral-300 hover:text-neutral-100 transition-colors select-none list-none">
                  <span className="flex-1">Tile Settings</span>
                  <span className="text-xs text-neutral-600">{dimensions.width_mm}×{dimensions.height_mm}×{dimensions.thickness_mm} mm</span>
                  <span className="text-neutral-600 text-xs">▼</span>
                </summary>
                <div className="px-4 pb-4 grid grid-cols-3 gap-3 border-t border-neutral-800 pt-3">
                  {/* Width */}
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500">Width (mm)</span>
                    <input
                      type="number" min={50} max={1200} step={10}
                      value={dimensions.width_mm}
                      onChange={(e) => setDimensions((d) => ({ ...d, width_mm: Math.max(50, Math.min(1200, Number(e.target.value))) }))}
                      className="bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm text-neutral-200 outline-none focus:border-sky-500/60 w-full"
                    />
                  </label>
                  {/* Height */}
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500">Height (mm)</span>
                    <input
                      type="number" min={50} max={1200} step={10}
                      value={dimensions.height_mm}
                      onChange={(e) => setDimensions((d) => ({ ...d, height_mm: Math.max(50, Math.min(1200, Number(e.target.value))) }))}
                      className="bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm text-neutral-200 outline-none focus:border-sky-500/60 w-full"
                    />
                  </label>
                  {/* Thickness */}
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500">Thickness (mm)</span>
                    <input
                      type="number" min={4} max={30} step={1}
                      value={dimensions.thickness_mm}
                      onChange={(e) => setDimensions((d) => ({ ...d, thickness_mm: Math.max(4, Math.min(30, Number(e.target.value))) }))}
                      className="bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm text-neutral-200 outline-none focus:border-sky-500/60 w-full"
                    />
                  </label>
                  {/* Colour presets */}
                  <div className="col-span-3 flex flex-col gap-1.5 pt-1">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500">Glaze Colour</span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: "Cream",      hex: "#e4e1d8" },
                        { label: "White",      hex: "#f5f5f3" },
                        { label: "Ivory",      hex: "#f0e8d4" },
                        { label: "Light Grey", hex: "#d8d8d8" },
                        { label: "Mid Grey",   hex: "#b0b0b0" },
                        { label: "Charcoal",   hex: "#5a5a5a" },
                        { label: "Terracotta", hex: "#c4714a" },
                        { label: "Sage",       hex: "#b5c4b1" },
                      ].map(({ label, hex }) => (
                        <button
                          key={hex}
                          type="button"
                          title={label}
                          onClick={() => setDimensions((d) => ({ ...d, color: hex }))}
                          className={`w-7 h-7 rounded-lg border-2 transition-all ${
                            (dimensions.color ?? "#e4e1d8") === hex
                              ? "border-sky-400 scale-110"
                              : "border-neutral-700 hover:border-neutral-400"
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </details>

              {/* CTA */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-500 text-neutral-950 font-bold text-sm hover:bg-sky-400 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px]"
                >
                  <ImageIcon size={16} />
                  {generating ? "Rendering…" : "Generate Surface Images"}
                </button>
                {defects.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setDefects([]); setSelectedDefectId(null); }}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl border border-neutral-700 text-neutral-400 hover:border-neutral-500 transition-colors text-sm min-h-[48px]"
                  >
                    <RotateCcw size={14} />
                    Clear All
                  </button>
                )}
                <p className="text-xs text-neutral-600">
                  {defects.length === 0
                    ? "Add defects to the tile, then render to generate ceramic surface images."
                    : `${defects.length} defect${defects.length !== 1 ? "s" : ""} placed. Render → AI scans the images.`}
                </p>
              </div>
            </div>

            {/* Right rail: DefectInspector */}
            <div className="xl:w-72 shrink-0">
              <DefectInspector
                defect={selectedDefect}
                onUpdate={handleUpdateDefect}
                onDelete={handleDeleteDefect}
                onClose={() => setSelectedDefectId(null)}
              />
            </div>
          </div>
        )}

        {/* ── PREVIEW PHASE ── */}
        {phase === "preview" && surfaceImages && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-6">
              <div className="flex-1">
                <h2 className="text-xl sm:text-2xl font-bold mb-1">Step 2 · Generated Surface Photos</h2>
                <p className="text-neutral-500 text-sm">
                  These images were rendered from your editor. Gemini will analyse{" "}
                  <span className="text-sky-400">these photos</span>, not the 3D model — just like it would
                  analyse a real tile photograph in a production environment.
                </p>
              </div>
              <div className="text-xs text-neutral-600 sm:text-right shrink-0">
                <div>{dimensions.width_mm} × {dimensions.height_mm} × {dimensions.thickness_mm} mm</div>
                <div>{defects.length} defect{defects.length !== 1 ? "s" : ""} placed</div>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
              <TileGallery dimensions={dimensions} surfaceImages={surfaceImages} />
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleAnalyse}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-500 text-neutral-950 font-bold text-sm hover:bg-sky-400 active:scale-[0.98] transition-all min-h-[48px]"
              >
                <Zap size={16} />
                Step 3 · Analyse with AI
              </button>
              <button
                type="button"
                onClick={() => setPhase("edit")}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-neutral-700 text-neutral-300 font-semibold hover:border-neutral-500 transition-colors min-h-[44px]"
              >
                <ChevronLeft size={16} />
                Back to Editor
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-neutral-800 text-neutral-400 font-semibold hover:border-neutral-600 hover:text-neutral-200 transition-colors min-h-[44px]"
              >
                <ImageIcon size={15} />
                {generating ? "Regenerating…" : "Regenerate"}
              </button>
            </div>
          </div>
        )}

        {/* ── RESULTS PHASE ── */}
        {phase === "results" && analysis && surfaceImages && (
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
              <div className="flex-1">
                <h2 className="text-xl sm:text-2xl font-bold mb-1">AI Analysis Complete</h2>
                <p className="text-neutral-500 text-sm">
                  Tile ID: <span className="font-mono text-neutral-400">{tileIdRef.current}</span>
                  <span className="mx-2 text-neutral-700">·</span>
                  {dimensions.width_mm} × {dimensions.height_mm} × {dimensions.thickness_mm} mm
                </p>
              </div>
              <div className="w-full sm:w-72 shrink-0">
                <GradeCard analysis={analysis} />
              </div>
            </div>

            {/* Surface gallery with Gemini bbox overlays */}
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-neutral-300 mb-1">Detected defects — click to inspect</h3>
              <p className="text-xs text-neutral-600 mb-4">
                Coloured boxes show where Gemini detected each defect.{" "}
                <span className="text-sky-400">Sky</span> = minor ·{" "}
                <span className="text-amber-400">Amber</span> = moderate ·{" "}
                <span className="text-red-400">Red</span> = severe
              </p>
              <TileGallery
                dimensions={dimensions}
                surfaceImages={surfaceImages}
                analysis={analysis}
                selectedDefectId={selectedResultDefect}
                onSelectDefect={setSelectedResultDefect}
              />
            </div>

            {/* Selected defect detail */}
            {selectedResultDefect !== null && (() => {
              const d = analysis.defects.find((x) => x.id === selectedResultDefect);
              if (!d) return null;
              const sev = d.severity;
              return (
                <div className={`rounded-2xl border p-4 flex flex-col gap-1 ${severityTailwind(sev).includes("sky") ? "border-sky-500/20 bg-sky-500/5" : sev === "moderate" ? "border-amber-500/20 bg-amber-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                  <span className="text-xs uppercase tracking-widest text-neutral-500">Defect #{d.id} — {d.type.replace("_", " ")}</span>
                  <span className={`text-sm font-semibold ${sev === "minor" ? "text-sky-300" : sev === "moderate" ? "text-amber-300" : "text-red-300"}`}>
                    {sev} severity · {d.zone} zone · {Math.round(d.confidence * 100)}% confidence
                  </span>
                </div>
              );
            })()}

            {/* Defect inventory */}
            {analysis.defects.length > 0 && (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
                <div className="px-5 py-3 border-b border-neutral-800">
                  <h3 className="text-sm font-semibold text-neutral-200">Defect Inventory</h3>
                </div>
                <div className="divide-y divide-neutral-800">
                  {analysis.defects.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedResultDefect(d.id === selectedResultDefect ? null : d.id)}
                      className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${d.id === selectedResultDefect ? "bg-sky-500/10" : "hover:bg-neutral-800/50"}`}
                    >
                      <span className="text-xs font-mono text-neutral-600 w-8 shrink-0">#{d.id}</span>
                      <span className="text-sm text-neutral-200 flex-1 capitalize">{d.type.replace("_", " ")}</span>
                      <span className="text-xs text-neutral-500">{d.zone}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${severityTailwind(d.severity)}`}>
                        {d.severity}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {analysis.detailed_analysis && (
              <DetailedAnalysisPanel headline={analysis.reasoning} detail={analysis.detailed_analysis} />
            )}

            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="flex items-center gap-2 px-5 sm:px-6 py-3 rounded-xl bg-sky-500 text-neutral-950 font-semibold hover:bg-sky-400 active:scale-[0.98] transition-all disabled:opacity-50 min-h-[44px]"
              >
                <Download size={16} />
                {downloadingPdf ? "Generating…" : "Download PDF"}
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-neutral-700 text-neutral-200 font-semibold hover:border-sky-500/50 transition-colors min-h-[44px]"
              >
                <FileJson2 size={16} />
                Export JSON
              </button>
              <button
                type="button"
                onClick={() => setPhase("edit")}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-neutral-700 text-neutral-300 font-semibold hover:border-neutral-500 transition-colors min-h-[44px]"
              >
                <ArrowLeft size={16} />
                Back to Editor
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-neutral-700 text-neutral-300 font-semibold hover:border-neutral-500 transition-colors min-h-[44px]"
              >
                <RotateCcw size={16} />
                New Tile
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950" />}>
      <EditorPageInner />
    </Suspense>
  );
}
