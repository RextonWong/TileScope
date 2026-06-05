// Tile zone geometry, editable defect data structures, and surface rendering types

export type ZoneId =
  | "face"
  | "top_edge"
  | "right_edge"
  | "bottom_edge"
  | "left_edge"
  | "top_left_corner"
  | "top_right_corner"
  | "bottom_right_corner"
  | "bottom_left_corner";

export const ZONE_IDS: ZoneId[] = [
  "face",
  "top_edge",
  "right_edge",
  "bottom_edge",
  "left_edge",
  "top_left_corner",
  "top_right_corner",
  "bottom_right_corner",
  "bottom_left_corner",
];

export const ZONE_LABELS: Record<ZoneId, string> = {
  face: "Face",
  top_edge: "Top Edge",
  right_edge: "Right Edge",
  bottom_edge: "Bottom Edge",
  left_edge: "Left Edge",
  top_left_corner: "Top-Left Corner",
  top_right_corner: "Top-Right Corner",
  bottom_right_corner: "Bottom-Right Corner",
  bottom_left_corner: "Bottom-Left Corner",
};

export const DEFAULT_TILE_DIMENSIONS: TileDimensions = {
  width_mm: 300,
  height_mm: 300,
  thickness_mm: 10,
};

// ── Renderable tile surfaces (5 faces sent to Gemini) ───────────────────────

export type TileSurfaceId =
  | "face"
  | "top_edge"
  | "bottom_edge"
  | "left_edge"
  | "right_edge";

export const TILE_SURFACE_IDS: TileSurfaceId[] = [
  "face",
  "top_edge",
  "bottom_edge",
  "left_edge",
  "right_edge",
];

export const TILE_SURFACE_LABELS: Record<TileSurfaceId, string> = {
  face: "Face (Glazed Surface)",
  top_edge: "Top Edge",
  bottom_edge: "Bottom Edge",
  left_edge: "Left Edge",
  right_edge: "Right Edge",
};

export function getTileSurfaceSize(
  surface: TileSurfaceId,
  dims: TileDimensions
): { width_mm: number; height_mm: number } {
  switch (surface) {
    case "face":
      return { width_mm: dims.width_mm, height_mm: dims.height_mm };
    case "top_edge":
    case "bottom_edge":
      return { width_mm: dims.width_mm, height_mm: dims.thickness_mm };
    case "left_edge":
    case "right_edge":
      return { width_mm: dims.height_mm, height_mm: dims.thickness_mm };
  }
}

export type DefectSeverity = "minor" | "major" | "critical";

export interface EditableDefect {
  id: string;
  zone: ZoneId;
  type: string;
  x: number; // 0-1 normalised position within zone (horizontal)
  y: number; // 0-1 normalised position within zone (vertical)
  severity: DefectSeverity;
  size?: number;     // scale multiplier for marker, 0.3–3.0, default 1
  rotation?: number; // degrees 0–360, applied to both 3D marker and rendered image
  notes?: string;
}

export interface TileDimensions {
  width_mm: number;
  height_mm: number;
  thickness_mm: number;
  color?: string; // hex for glazed face, default "#e4e1d8"
}

// ISO 10545-2 / EN 14411 grading based on manual defect entries
export type TileGrade = "A" | "B" | "C";
export type UseCase =
  | "wall"
  | "residential_floor"
  | "light_commercial"
  | "heavy_commercial"
  | "reject";

export interface ManualGradeResult {
  grade: TileGrade;
  use_case: UseCase;
  reasoning: string;
}

export function computeManualGrade(defects: EditableDefect[]): ManualGradeResult {
  if (defects.length === 0) {
    return {
      grade: "A",
      use_case: "heavy_commercial",
      reasoning: "No defects marked — Grade A First Quality.",
    };
  }

  const hasCritical = defects.some((d) => d.severity === "critical");
  const hasStructural = defects.some(
    (d) => d.type === "crack" || d.type === "fish_scale" || d.type === "warping" || d.type === "chip"
  );
  const majorCount = defects.filter((d) => d.severity === "major").length;
  const totalCount = defects.length;

  if (hasCritical || (hasStructural && majorCount >= 1) || totalCount >= 6) {
    return {
      grade: "C",
      use_case: "reject",
      reasoning: `${totalCount} defect${totalCount !== 1 ? "s" : ""} marked including ${hasCritical ? "critical" : "structural"} issue${hasCritical ? "s" : ""} — Grade C / Reject.`,
    };
  }

  if (majorCount >= 2 || (hasStructural && majorCount === 0 && totalCount >= 2)) {
    return {
      grade: "B",
      use_case: "wall",
      reasoning: `${totalCount} defect${totalCount !== 1 ? "s" : ""} including ${majorCount} major — Grade B Second Quality, suitable for wall use.`,
    };
  }

  if (totalCount <= 5 && majorCount <= 1) {
    return {
      grade: "A",
      use_case: totalCount === 0 ? "heavy_commercial" : "residential_floor",
      reasoning: `${totalCount} minor defect${totalCount !== 1 ? "s" : ""} — Grade A First Quality.`,
    };
  }

  return {
    grade: "B",
    use_case: "wall",
    reasoning: `${totalCount} defects — Grade B Second Quality.`,
  };
}
