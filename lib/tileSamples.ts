import type { TileDimensions, EditableDefect } from "./tile";

export interface TileSamplePreset {
  id: string;
  defectTypeId: string;
  label: string;
  shortLabel: string;
  description: string;
  dimensions: TileDimensions;
  defects: EditableDefect[];
}

const STD: TileDimensions = { width_mm: 300, height_mm: 300, thickness_mm: 10 };

export const TILE_SAMPLE_PRESETS: TileSamplePreset[] = [

  // ── Surface defects ─────────────────────────────────────────────────────────

  {
    id: "crack",
    defectTypeId: "crack",
    label: "Crack",
    shortLabel: "Crack",
    description:
      "A linear fracture running through the tile body or glaze. Structural cracks " +
      "immediately disqualify the tile from Grade A. Hairline cracks may be detected " +
      "only under raking light or with magnification.",
    dimensions: STD,
    defects: [
      { id: "s-crack-1", zone: "face", type: "crack", x: 0.38, y: 0.22, severity: "critical" },
    ],
  },

  {
    id: "crazing",
    defectTypeId: "crazing",
    label: "Crazing",
    shortLabel: "Crazing",
    description:
      "A fine network of hairline cracks in the glaze surface resembling a spider web. " +
      "Caused by a mismatch between the thermal expansion coefficients of the glaze and body. " +
      "Allows moisture ingress and reduces stain resistance.",
    dimensions: STD,
    defects: [
      { id: "s-craz-1", zone: "face", type: "crazing", x: 0.5, y: 0.5, severity: "major" },
      { id: "s-craz-2", zone: "face", type: "crazing", x: 0.25, y: 0.35, severity: "minor" },
    ],
  },

  {
    id: "pinhole",
    defectTypeId: "pinhole",
    label: "Pinhole",
    shortLabel: "Pinhole",
    description:
      "Small circular voids or craters in the glaze surface, typically 0.5–2 mm in diameter. " +
      "Caused by gas escaping the tile body during firing. Pinholes trap dirt and " +
      "compromise the hygiene rating of the tile surface.",
    dimensions: STD,
    defects: [
      { id: "s-pin-1", zone: "face", type: "pinhole", x: 0.45, y: 0.40, severity: "minor" },
      { id: "s-pin-2", zone: "face", type: "pinhole", x: 0.62, y: 0.55, severity: "minor" },
      { id: "s-pin-3", zone: "face", type: "pinhole", x: 0.32, y: 0.68, severity: "minor" },
    ],
  },

  {
    id: "blister",
    defectTypeId: "blister",
    label: "Blister",
    shortLabel: "Blister",
    description:
      "A raised bubble or hollow dome on the glaze surface. Caused by volatile gases " +
      "trapped beneath the glaze. Blisters are prone to mechanical damage and reduce " +
      "the surface's load-bearing capacity.",
    dimensions: STD,
    defects: [
      { id: "s-blis-1", zone: "face", type: "blister", x: 0.55, y: 0.45, severity: "major" },
    ],
  },

  {
    id: "dry_spot",
    defectTypeId: "dry_spot",
    label: "Dry Spot",
    shortLabel: "Dry Spot",
    description:
      "An unglazed or under-glazed patch where the glaze failed to fully adhere to " +
      "the tile body. Appears as a matte region on an otherwise glossy surface. " +
      "Exposes the porous tile body to moisture and staining.",
    dimensions: STD,
    defects: [
      { id: "s-dry-1", zone: "face", type: "dry_spot", x: 0.5, y: 0.5, severity: "major" },
    ],
  },

  {
    id: "speck",
    defectTypeId: "speck",
    label: "Speck",
    shortLabel: "Speck",
    description:
      "A foreign particle inclusion or isolated dark or light mark embedded in the " +
      "glaze. Sources include body contamination, kiln refractory fragments, or " +
      "organic matter. Cosmetic defect only, but visible at short inspection distances.",
    dimensions: STD,
    defects: [
      { id: "s-spec-1", zone: "face", type: "speck", x: 0.4, y: 0.38, severity: "minor" },
      { id: "s-spec-2", zone: "face", type: "speck", x: 0.65, y: 0.6, severity: "minor" },
      { id: "s-spec-3", zone: "face", type: "speck", x: 0.3, y: 0.7, severity: "minor" },
    ],
  },

  {
    id: "glaze_devitrification",
    defectTypeId: "glaze_devitrification",
    label: "Glaze Devitrification",
    shortLabel: "Devitrification",
    description:
      "Crystalline haze or cloudy patch on the glaze caused by controlled or uncontrolled " +
      "crystallisation of the glaze melt during cooling. Appears as a white or iridescent " +
      "patch that reduces gloss and clarity.",
    dimensions: STD,
    defects: [
      { id: "s-devit-1", zone: "face", type: "glaze_devitrification", x: 0.5, y: 0.5, severity: "major" },
    ],
  },

  {
    id: "scratch",
    defectTypeId: "scratch",
    label: "Scratch",
    shortLabel: "Scratch",
    description:
      "A linear abrasion mark on the glaze surface caused by mechanical contact with a " +
      "harder material. Typically introduced post-firing during handling, transport, or " +
      "installation. Can compromise the glaze's chemical resistance.",
    dimensions: STD,
    defects: [
      { id: "s-scr-1", zone: "face", type: "scratch", x: 0.35, y: 0.3, severity: "minor" },
    ],
  },

  // ── Edge & Dimensional defects ───────────────────────────────────────────────

  {
    id: "chip",
    defectTypeId: "chip",
    label: "Chip",
    shortLabel: "Chip",
    description:
      "A missing fragment at an edge or corner of the tile, exposing the fired body. " +
      "Typically caused by impact during handling or transport. Chips at visible edges " +
      "are significant aesthetic defects; structural chips can allow moisture penetration.",
    dimensions: STD,
    defects: [
      { id: "s-chip-1", zone: "top_left_corner", type: "chip", x: 0.1, y: 0.1, severity: "major" },
    ],
  },

  {
    id: "rough_edge",
    defectTypeId: "rough_edge",
    label: "Rough Edge",
    shortLabel: "Rough Edge",
    description:
      "Uneven, jagged, or poorly fired edge profile. Can cause installation difficulties, " +
      "uneven grout lines, and tile lippage. Often results from worn cutting equipment or " +
      "insufficient edge firing support.",
    dimensions: STD,
    defects: [
      { id: "s-re-1", zone: "top_edge", type: "rough_edge", x: 0.5, y: 0.5, severity: "minor" },
    ],
  },

  // ── Color & Pattern defects ──────────────────────────────────────────────────

  {
    id: "color_inconsistency",
    defectTypeId: "color_inconsistency",
    label: "Color Inconsistency",
    shortLabel: "Color Variation",
    description:
      "A noticeable shade or tone variation compared to the reference batch. Can manifest " +
      "as a visible boundary between two tonal zones within the same tile. " +
      "Critical for large-format installations where tiles are viewed as a uniform field.",
    dimensions: STD,
    defects: [
      { id: "s-col-1", zone: "face", type: "color_inconsistency", x: 0.55, y: 0.5, severity: "major" },
    ],
  },

  {
    id: "print_misalignment",
    defectTypeId: "print_misalignment",
    label: "Print Misalignment",
    shortLabel: "Print Offset",
    description:
      "A pattern registration offset where the inkjet or screen-print layers are not " +
      "correctly aligned. Results in colour ghosting, blurred edges, or visible layer " +
      "separation. More apparent in tiles with fine geometric or realistic patterns.",
    dimensions: STD,
    defects: [
      { id: "s-pm-1", zone: "face", type: "print_misalignment", x: 0.5, y: 0.5, severity: "major" },
    ],
  },

];
