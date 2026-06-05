"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { DropZone } from "@/components/DropZone";
import { AnalysisCanvas } from "@/components/AnalysisCanvas";
import { GradeCard } from "@/components/GradeCard";
import { DefectDetailPanel } from "@/components/DefectDetailPanel";
import { LoadingState } from "@/components/LoadingState";
import { DefectGuide } from "@/components/DefectGuide";
import { HistoryPanel } from "@/components/HistoryPanel";
import { DetailedAnalysisPanel } from "@/components/editor/DetailedAnalysisPanel";
import {
  Grid2X2,
  Zap,
  RotateCcw,
  Download,
  History,
  FileJson,
  BookOpen,
  Camera,
  Pencil,
  Plus,
  X,
  PanelRight,
} from "lucide-react";
import Link from "next/link";
import type { TileAnalysis } from "@/lib/schema";
import { generateThumbnail, saveRecord, exportRecordJson, type HistoryRecord } from "@/lib/history";

type AppMode = "guide" | "analyse" | "editor-cta";
type AppState = "empty" | "loading" | "results";

function detectMime(b64: string): string {
  try {
    const bin = atob(b64.slice(0, 16));
    const b0 = bin.charCodeAt(0), b1 = bin.charCodeAt(1), b2 = bin.charCodeAt(2);
    if (b0 === 0xff && b1 === 0xd8) return "image/jpeg";
    if (b0 === 0x89 && b1 === 0x50 && b2 === 0x4e) return "image/png";
    if (b0 === 0x52 && b1 === 0x49 && b2 === 0x46) return "image/webp";
  } catch { /* fall through */ }
  return "image/jpeg";
}

function b64Bytes(b64: string) { return Math.ceil((b64.length * 3) / 4); }

// ── Photo slot (up to 3) ──────────────────────────────────────────────────────

interface PhotoSlot {
  base64: string | null;
  label: string;
}

const PHOTO_LABELS = ["Face View", "Edge / Side View", "Corner View"];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [mode, setMode] = useState<AppMode>("guide");
  const [state, setState] = useState<AppState>("empty");
  const [photos, setPhotos] = useState<PhotoSlot[]>([{ base64: null, label: PHOTO_LABELS[0] }]);
  const [analysis, setAnalysis] = useState<TileAnalysis | null>(null);
  const [selectedDefectId, setSelectedDefectId] = useState<number | null>(null);
  const [hoveredDefectId, setHoveredDefectId] = useState<number | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyToken, setHistoryToken] = useState(0);

  const tileIdRef = useRef(`tile-${Date.now()}`);
  const currentRecordRef = useRef<HistoryRecord | null>(null);

  const filledPhotos = photos.filter((p) => p.base64 !== null);
  const canAnalyse = filledPhotos.length >= 1;

  const addPhotoSlot = () => {
    if (photos.length >= 3) return;
    setPhotos((prev) => [...prev, { base64: null, label: PHOTO_LABELS[prev.length] }]);
  };

  const removePhotoSlot = (i: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
  };

  const setPhotoAt = (i: number, val: string | null) => {
    setPhotos((prev) => prev.map((p, idx) => idx === i ? { ...p, base64: val } : p));
  };

  const handleAnalyse = useCallback(async () => {
    const filled = photos.filter((p) => p.base64 !== null);
    if (filled.length === 0) return;

    for (const p of filled) {
      if (p.base64 && b64Bytes(p.base64) / 1_048_576 > 3) {
        toast.warning("Large image detected. Analysis may be slow.", { duration: 5000 });
        break;
      }
    }

    setState("loading");
    setSelectedDefectId(null);
    setHoveredDefectId(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: filled.map((p) => ({
            base64: p.base64,
            mime: p.base64 ? detectMime(p.base64) : "image/jpeg",
            label: p.label,
          })),
        }),
      });
      const data = await res.json() as unknown;
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Analysis failed");

      const result = data as TileAnalysis;
      setAnalysis(result);
      setState("results");
      tileIdRef.current = `tile-${Date.now()}`;

      // Save to history
      Promise.all(
        filled.map((p) => generateThumbnail(p.base64!, detectMime(p.base64!)))
      ).then((thumbs) => {
        const record: HistoryRecord = {
          id: tileIdRef.current,
          tileId: tileIdRef.current,
          timestamp: new Date().toISOString(),
          analysis: result,
          photos: thumbs,
          photoMimes: filled.map((p) => detectMime(p.base64!)),
        };
        currentRecordRef.current = record;
        saveRecord(record);
        setHistoryToken((t) => t + 1);
      });

      if (result.total_defects === 0) {
        toast.success("Grade A — No defects detected! Tile appears perfect.", { duration: 5000 });
      } else {
        toast.success(
          `Grade ${result.grade} — ${result.total_defects} defect${result.total_defects !== 1 ? "s" : ""} found.`,
          { duration: 5000 }
        );
      }
    } catch (err) {
      toast.error(`Analysis failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setState("empty");
    }
  }, [photos]);

  const handleReset = () => {
    setState("empty");
    setAnalysis(null);
    setPhotos([{ base64: null, label: PHOTO_LABELS[0] }]);
    setSelectedDefectId(null);
    setHoveredDefectId(null);
    setDetailOpen(false);
    currentRecordRef.current = null;
  };

  const handleRestore = (record: HistoryRecord) => {
    setAnalysis(record.analysis);
    setPhotos(record.photos.map((b64, i) => ({ base64: b64, label: PHOTO_LABELS[i] ?? `Photo ${i + 1}` })));
    tileIdRef.current = record.tileId;
    currentRecordRef.current = record;
    setState("results");
    setMode("analyse");
    setSelectedDefectId(null);
    setDetailOpen(false);
  };

  const handleExportJson = () => {
    if (currentRecordRef.current) exportRecordJson(currentRecordRef.current);
  };

  const handleDownloadPdf = async () => {
    if (!analysis) return;
    setDownloadingPdf(true);
    const toastId = toast.loading("Generating PDF report…");
    try {
      const filled = photos.filter((p) => p.base64 !== null);
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis,
          photos: filled.map((p) => p.base64),
          photoMimes: filled.map((p) => detectMime(p.base64!)),
          tileId: tileIdRef.current,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tilescope-${tileIdRef.current}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded.", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF generation failed", { id: toastId });
    } finally {
      setDownloadingPdf(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && state === "empty" && canAnalyse && mode === "analyse") {
        handleAnalyse();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, canAnalyse, mode]);

  // Primary photo for canvas display (face view)
  const primaryPhoto = photos.find((p) => p.base64 !== null);
  const primaryMime = primaryPhoto?.base64 ? detectMime(primaryPhoto.base64) : "image/jpeg";

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">

      {/* Nav */}
      <nav className="border-b border-neutral-800 px-4 sm:px-6 py-4 flex items-center gap-3">
        <Grid2X2 size={20} className="text-sky-500 flex-shrink-0" />
        <span className="font-bold text-lg tracking-tight">TileScope</span>
        <span className="hidden sm:inline text-xs text-neutral-600 font-medium ml-1">Tile Defect Inspection AI</span>
        <Link
          href="/editor"
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-500/40 text-sky-400 hover:border-sky-500 hover:bg-sky-500/10 text-xs font-medium transition-colors"
        >
          <Pencil size={14} />
          Tile Editor
        </Link>
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 text-xs font-medium transition-colors"
        >
          <History size={14} />
          History
        </button>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-10">

        {/* ── HERO (only when no analysis is showing) ── */}
        {state === "empty" && (
          <div className="text-center flex flex-col items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">TileScope</h1>
            <p className="text-neutral-400 text-sm sm:text-base max-w-xl leading-relaxed">
              AI-powered ceramic tile quality inspection per ISO 10545-2, EN 14411, and ANSI A137.1.
              Detect defects, compute grades, and generate PDF reports.
            </p>

            {/* Mode tabs */}
            <div className="flex rounded-xl border border-neutral-800 overflow-hidden mt-2">
              <ModeTab id="guide" icon={<BookOpen size={14} />} label="Defect Guide" active={mode === "guide"} onClick={() => setMode("guide")} />
              <ModeTab id="analyse" icon={<Camera size={14} />} label="Photo Analysis" active={mode === "analyse"} onClick={() => setMode("analyse")} />
              <ModeTab id="editor-cta" icon={<Pencil size={14} />} label="Tile Editor" active={mode === "editor-cta"} onClick={() => setMode("editor-cta")} />
            </div>
          </div>
        )}

        {/* ── LOADING ── */}
        {state === "loading" && <LoadingState />}

        {/* ── RESULTS ── */}
        {state === "results" && analysis && (
          <div className="flex flex-col gap-6 sm:gap-8">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
              <div className="flex-1">
                <h2 className="text-xl sm:text-2xl font-bold mb-1">Analysis Complete</h2>
                <p className="text-neutral-500 text-sm">
                  Tile ID: <span className="font-mono text-neutral-400">{tileIdRef.current}</span>
                </p>
              </div>
              <div className="w-full sm:w-72">
                <GradeCard analysis={analysis} />
              </div>
            </div>

            {/* Photo + defect overlay */}
            <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 items-start">
              <div className="flex-1 min-w-0 flex flex-col gap-4">
                {photos.filter((p) => p.base64 !== null).map((p, i) => (
                  <AnalysisCanvas
                    key={i}
                    image={p.base64!}
                    mimeType={detectMime(p.base64!)}
                    defects={analysis.defects.filter((d) =>
                      i === 0
                        ? d.zone === "face" || d.zone === undefined
                        : i === 1
                        ? d.zone === "edge"
                        : d.zone === "corner"
                    )}
                    label={p.label}
                    selectedId={selectedDefectId}
                    hoveredId={hoveredDefectId}
                    onDefectHover={setHoveredDefectId}
                    onDefectClick={(id) => {
                      setSelectedDefectId((prev) => prev === id ? null : id);
                      setDetailOpen(true);
                    }}
                  />
                ))}
              </div>
              <div className={`w-full xl:w-80 xl:flex-shrink-0 ${detailOpen ? "block" : "hidden xl:block"}`}>
                <DefectDetailPanel
                  analysis={analysis}
                  selectedId={selectedDefectId}
                  onSelectDefect={(id) => { setSelectedDefectId(id); setDetailOpen(true); }}
                />
              </div>
            </div>

            {/* Toggle detail panel on mobile */}
            <button
              type="button"
              onClick={() => setDetailOpen((o) => !o)}
              className="xl:hidden flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-neutral-800 text-neutral-400 text-sm hover:border-neutral-600 transition-colors"
            >
              <PanelRight size={15} />
              {detailOpen ? "Hide" : "Show"} Defect Details
            </button>

            {/* Detailed AI report */}
            {analysis.detailed_analysis && (
              <DetailedAnalysisPanel
                headline={analysis.reasoning}
                detail={analysis.detailed_analysis}
              />
            )}

            {/* Action buttons */}
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="flex items-center gap-2 px-5 sm:px-6 py-3 rounded-xl bg-sky-500 text-neutral-950 font-semibold hover:bg-sky-400 active:scale-[0.98] transition-all disabled:opacity-50 min-h-[44px]"
              >
                <Download size={16} />
                {downloadingPdf ? "Generating…" : "Download Report"}
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="flex items-center gap-2 px-5 sm:px-6 py-3 rounded-xl border border-neutral-700 text-neutral-300 font-semibold hover:border-sky-500/50 active:scale-[0.98] transition-all min-h-[44px]"
              >
                <FileJson size={16} />
                Export JSON
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-2 px-5 sm:px-6 py-3 rounded-xl border border-neutral-700 text-neutral-300 font-semibold hover:border-neutral-500 active:scale-[0.98] transition-all min-h-[44px]"
              >
                <RotateCcw size={16} />
                Analyse Another Tile
              </button>
            </div>
          </div>
        )}

        {/* ── MODE 1: DEFECT GUIDE ── */}
        {state === "empty" && mode === "guide" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-neutral-100">Tile Defect Reference Guide</h2>
              <p className="text-sm text-neutral-500">
                Browse all 16 defect types across Surface, Edge & Dimensional, and Color & Pattern categories.
                Click a defect card to see its description, cause, and AI detection method.
              </p>
            </div>
            <DefectGuide />
          </div>
        )}

        {/* ── MODE 2: PHOTO ANALYSIS ── */}
        {state === "empty" && mode === "analyse" && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-neutral-100">Photo Analysis</h2>
              <p className="text-sm text-neutral-500">
                Upload 1–3 photos of your tile. Face view is required; add edge and corner views for more complete defect detection.
              </p>
            </div>

            {/* Photo slots */}
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {photos.map((p, i) => (
                  <div key={i} className="relative">
                    <DropZone
                      label={p.label}
                      value={p.base64}
                      onChange={(val) => setPhotoAt(i, val)}
                    />
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => removePhotoSlot(i)}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center hover:bg-red-500/80 transition-colors z-10"
                      >
                        <X size={10} className="text-neutral-400" />
                      </button>
                    )}
                  </div>
                ))}
                {photos.length < 3 && (
                  <button
                    type="button"
                    onClick={addPhotoSlot}
                    className="rounded-xl border-2 border-dashed border-neutral-700 hover:border-sky-500/50 hover:bg-sky-500/5 min-h-[180px] flex flex-col items-center justify-center gap-2 text-neutral-600 hover:text-sky-400 transition-colors"
                  >
                    <Plus size={20} />
                    <span className="text-xs">Add {PHOTO_LABELS[photos.length]}</span>
                  </button>
                )}
              </div>

              {/* Analyse button */}
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleAnalyse}
                  disabled={!canAnalyse}
                  className="flex items-center gap-2 px-8 py-4 rounded-xl bg-sky-500 text-neutral-950 font-bold text-base hover:bg-sky-400 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed min-h-[56px]"
                >
                  <Zap size={18} />
                  Analyse Tile
                </button>
                {canAnalyse && (
                  <p className="text-xs text-neutral-600">or press Enter</p>
                )}
              </div>
            </div>

            {/* Standards note */}
            <div className="flex items-center gap-3 flex-wrap">
              {["ISO 10545-2", "EN 14411", "ANSI A137.1"].map((s) => (
                <span key={s} className="text-xs px-3 py-1 rounded-full bg-sky-950/50 border border-sky-900 text-sky-400 font-medium">
                  {s}
                </span>
              ))}
              <span className="text-xs text-neutral-600">AI grading based on these standards</span>
            </div>
          </div>
        )}

        {/* ── MODE 3: EDITOR CTA ── */}
        {state === "empty" && mode === "editor-cta" && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-neutral-100">Tile Face Editor</h2>
              <p className="text-sm text-neutral-500">
                Manually mark defects on a tile diagram and get an instant ISO grade.
                Useful for manual inspection workflows or testing grading logic.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  title: "9 Tile Zones",
                  desc: "Mark defects on Face, 4 Edges, and 4 Corners of the tile.",
                  icon: "🔲",
                },
                {
                  title: "Live Grade",
                  desc: "Grade recomputes in real-time as you add or remove defects.",
                  icon: "📊",
                },
                {
                  title: "PDF Export",
                  desc: "Generate a full ISO-compliant inspection report with one click.",
                  icon: "📄",
                },
              ].map((f) => (
                <div key={f.title} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 flex flex-col gap-2">
                  <span className="text-2xl">{f.icon}</span>
                  <h3 className="font-semibold text-neutral-200">{f.title}</h3>
                  <p className="text-sm text-neutral-500">{f.desc}</p>
                </div>
              ))}
            </div>

            <Link
              href="/editor"
              className="self-start flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-500 text-neutral-950 font-bold hover:bg-sky-400 active:scale-[0.98] transition-all"
            >
              <Pencil size={16} />
              Open Tile Editor
            </Link>
          </div>
        )}

      </main>

      <HistoryPanel
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onRestore={handleRestore}
        refreshToken={historyToken}
      />
    </div>
  );
}

function ModeTab({
  id,
  icon,
  label,
  active,
  onClick,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-sky-500 text-neutral-950"
          : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
