# TileScope — Claude Code Project

## Overview
AI-powered ceramic tile defect inspection POC. Users place defects on a 3D tile editor, generate photorealistic rendered images of each tile surface, and send those to Gemini 2.5 Flash for automated detection and grading against ISO 10545-2 / EN 14411 / ANSI A137.1.

**Live demo:** https://tile-scope.vercel.app  
**Repo:** https://github.com/RextonWong/TileScope

---

## Stack
- **Framework:** Next.js 16.2.6 (App Router, TypeScript, React 19)
- **Styling:** Tailwind CSS 4
- **3D editor:** React Three Fiber (`@react-three/fiber`) + Drei + Three.js
- **AI:** Gemini 2.5 Flash via `@google/genai` (VLM image analysis)
- **PDF export:** `@react-pdf/renderer`
- **Toasts:** `sonner`
- **Validation:** Zod v4
- **Icons:** Lucide React

## Environment Variables
```
GEMINI_API_KEY=your_key_here
```
`.env.local` is gitignored. See `.env.local.example`.

## Commands
```bash
npm run dev      # dev server on localhost:3000
npm run build    # production build (run this to verify no TS errors)
npm run start    # serve production build
```

---

## Architecture — Core Pipeline

```
3D Editor (Tile3D.tsx)
  → user places defects on tile faces
  → renderAllTileSurfaces() generates 5 JPEG images via Canvas API
  → POST /api/analyze-editor  sends images to Gemini
  → TileAnalysis result (grade A/B/C, defect bboxes, reasoning)
  → TileGallery shows bbox overlays on rendered images
```

Photo upload flow (home page):
```
DropZone → POST /api/analyze (up to 5 uploaded photos) → same TileAnalysis output
```

---

## File Structure

### App Routes (`app/`)
| File | Purpose |
|------|---------|
| `app/page.tsx` | Home page — photo upload, DefectGuide, history |
| `app/editor/page.tsx` | 4-phase editor: edit → preview → loading → results |
| `app/api/analyze/route.ts` | Gemini endpoint for uploaded real photos |
| `app/api/analyze-editor/route.ts` | Gemini endpoint for rendered editor images |
| `app/api/report/route.ts` | PDF report generation |

### Components (`components/`)
| File | Purpose |
|------|---------|
| `DropZone.tsx` | Drag-and-drop photo uploader |
| `DefectGuide.tsx` | Expandable cards for all 16 defect types with live-rendered examples and "Import to Editor" |
| `GradeCard.tsx` | Grade A/B/C result display |
| `AnalysisCanvas.tsx` | Photo viewer with Gemini bbox overlays |
| `HistoryPanel.tsx` | Local history of past analyses |
| `LoadingState.tsx` | Spinner shown during Gemini call |
| `DefectDetailPanel.tsx` | Selected defect detail panel |
| `editor/Tile3D.tsx` | R3F 3D tile — clickable faces, defect texture markers, drag to move |
| `editor/TileGallery.tsx` | Surface image gallery with bbox overlays |
| `editor/DefectInspector.tsx` | Right-rail panel: defect type, severity, size (0.3–30×), rotation (0–360°), zone, notes |
| `editor/DetailedAnalysisPanel.tsx` | Expanded Gemini reasoning display |
| `editor/TileEditor.tsx` | Legacy 2D SVG editor (kept, not used in main flow) |

### Lib (`lib/`)
| File | Purpose |
|------|---------|
| `tile.ts` | Core types: `TileDimensions`, `EditableDefect`, `ZoneId`, `TileSurfaceId`, zone/surface helpers |
| `renderTile.ts` | Canvas-based procedural tile renderer — glazed face, fired edges, 16 defect overlays. Exports `renderAllTileSurfaces`, `renderDefectExample`, `renderDefectThumbnailCanvas` |
| `gemini.ts` | Gemini API wrappers: `analyzeTile()` (uploaded photos) and `analyzeTileEditor()` (rendered surfaces) |
| `schema.ts` | Zod schemas and inferred types for `TileAnalysis`, `TileDefect`, `TileGrade`, etc. |
| `defects.ts` | Static data for 16 defect types — id, name, category, description, cause, detection |
| `tileSamples.ts` | 16 `TileSamplePreset` entries (one per defect type) loaded via `?preset=<id>` or `?defect=<typeId>` |
| `grading.ts` | `gradeTailwind()`, `gradeLabel()`, `severityTailwind()`, `useCaseLabel()` helpers |
| `history.ts` | `localStorage`-backed history for both photo scans and editor sessions |
| `rateLimit.ts` | In-memory rate limiter (`checkRateLimit`, `clientIp`) — 10 req/min per IP on editor route |
| `pdf.tsx` | `@react-pdf/renderer` report template |
| `utils.ts` | `cn()` Tailwind class merge utility |

### Types (`types/`)
| File | Purpose |
|------|---------|
| `next-dynamic.d.ts` | Shim for missing `next/dynamic` type declaration in this Next.js install |

---

## Key Types

### `EditableDefect` (`lib/tile.ts`)
```typescript
interface EditableDefect {
  id: string;
  zone: ZoneId;         // face | top_edge | bottom_edge | left_edge | right_edge | *_corner
  type: string;         // one of 16 defect type ids
  x: number;            // 0–1 normalised position (horizontal)
  y: number;            // 0–1 normalised position (vertical)
  severity: "minor" | "major" | "critical";
  size?: number;        // marker scale 0.3–30, default 1
  rotation?: number;    // degrees 0–360, applied to 3D marker + rendered image
  notes?: string;
}
```

### `TileDimensions` (`lib/tile.ts`)
```typescript
interface TileDimensions {
  width_mm: number;
  height_mm: number;
  thickness_mm: number;
  color?: string;  // hex for glazed face, default "#e4e1d8"
}
```

### `TileAnalysis` (`lib/schema.ts`)
Zod-validated Gemini response. Key fields: `grade` (A/B/C), `use_case`, `defects[]` (each with `bbox`, `type`, `severity`, `confidence`), `reasoning`, `detailed_analysis`.

**Note:** Gemini uses `"minor" | "moderate" | "severe"` for severity — different from the editor's `"minor" | "major" | "critical"`. Don't mix these up.

---

## Rendering Pipeline (`lib/renderTile.ts`)

5 surfaces rendered per tile: `face`, `top_edge`, `bottom_edge`, `left_edge`, `right_edge`.

- **Face:** cream/off-white glazed surface via `paintGlazedFace()` — respects `dims.color`
- **Edges:** terracotta fired body via `paintFiredEdge()`
- Defect overlays: deterministic via `mulberry32` RNG seeded on `defect.id + type`
- Rotation from `defect.rotation` is applied as `ctx.rotate()` around the defect position
- `renderDefectThumbnailCanvas(type, size)` → `HTMLCanvasElement` (used for 3D marker textures)
- `renderDefectExample(type)` → picks right surface (`top_edge` for `rough_edge`, etc.)

Edge defects shown on edge surfaces only: `chip`, `rough_edge`, `crack`, `warping`, `lippage`.
All other defects render on face only.

---

## 3D Editor (`components/editor/Tile3D.tsx`)

- React Three Fiber, loaded with `next/dynamic` + `ssr: false`
- Tile geometry: `boxGeometry [L, W, T]` in world units where `1 unit = 100mm`
- 5 `FaceConfig` entries with positions/rotations mapping tile geometry to UV coordinates
- Defect markers: canvas texture thumbnail (from `renderDefectThumbnailCanvas`) + severity ring
- Marker scale driven by `defect.size ?? 1`; rotation from `defect.rotation ?? 0`
- Drag to reposition (disables OrbitControls during drag)
- Texture cache: `Map<string, THREE.CanvasTexture>` keyed by defect type — created once, reused

---

## API Notes

### `POST /api/analyze-editor`
```json
{ "surfaces": { "face": { "base64": "...", "mime": "image/jpeg" }, ... } }
```
Returns `TileAnalysis`. Rate limit: 10/min per IP.

### `POST /api/analyze`
Multipart form with up to 5 photo files. Returns `TileAnalysis`.

### `POST /api/report`
```json
{ "analysis": TileAnalysis, "photos": ["base64..."], "photoMimes": ["image/jpeg"], "tileId": "..." }
```
Returns PDF blob.

---

## Grading Standards
- **Grade A** — First Quality, no significant visible defects
- **Grade B** — Second Quality, minor defects acceptable for walls
- **Grade C** — Reject or heavy-commercial only

Standards applied: ISO 10545-2, EN 14411, ANSI A137.1

---

## Known Patterns / Gotchas
- `next/dynamic` type declaration is missing from this Next.js install — the shim lives in `types/next-dynamic.d.ts`
- `tsconfig.json` includes `"types/**/*.d.ts"` explicitly for the shim to be picked up
- Always run `npm run build` after changes to verify TypeScript — no separate type-check script
- `DefectSeverity` in the editor (`minor/major/critical`) ≠ Gemini's severity (`minor/moderate/severe`) — never conflate them
- `renderDefectThumbnailCanvas` must only be called in the browser (uses `document.createElement`) — safe in R3F components since they're `ssr: false`
