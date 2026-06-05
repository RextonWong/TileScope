import { z } from "zod";

export const DefectTypeIdSchema = z.enum([
  // Surface
  "crack",
  "crazing",
  "pinhole",
  "blister",
  "dry_spot",
  "speck",
  "glaze_devitrification",
  "fish_scale",
  "scratch",
  // Edge & Dimensional
  "chip",
  "rough_edge",
  "warping",
  "lippage",
  // Color & Pattern
  "color_inconsistency",
  "print_misalignment",
  "glaze_mark",
]);

export const DefectSeveritySchema = z.enum(["minor", "moderate", "severe"]);

export const TileDefectSchema = z.object({
  id: z.number().int(),
  // [ymin, xmin, ymax, xmax] normalised 0-1000
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  type: DefectTypeIdSchema,
  severity: DefectSeveritySchema,
  confidence: z.number().min(0).max(1),
  zone: z.enum(["face", "edge", "corner"]).optional().default("face"),
});

export const TileGradeSchema = z.enum(["A", "B", "C"]);

export const UseCaseSchema = z.enum([
  "wall",
  "residential_floor",
  "light_commercial",
  "heavy_commercial",
  "reject",
]);

export const DetailedTileAnalysisSchema = z.object({
  overall: z.string(),
  notable_defects: z.array(z.string()),
  grade_criteria_applied: z.string(),
  use_case_rationale: z.string(),
  recommendations: z.string(),
});

export const TileAnalysisSchema = z.object({
  is_tile: z.boolean(),
  defects: z.array(TileDefectSchema),
  total_defects: z.number().int(),
  grade: TileGradeSchema,
  use_case: UseCaseSchema,
  viewing_distance_3ft: z.boolean(),
  viewing_distance_10ft: z.boolean(),
  reasoning: z.string(),
  detailed_analysis: DetailedTileAnalysisSchema,
});

export type DefectTypeId = z.infer<typeof DefectTypeIdSchema>;
export type DefectSeverity = z.infer<typeof DefectSeveritySchema>;
export type TileDefect = z.infer<typeof TileDefectSchema>;
export type TileGrade = z.infer<typeof TileGradeSchema>;
export type UseCase = z.infer<typeof UseCaseSchema>;
export type DetailedTileAnalysis = z.infer<typeof DetailedTileAnalysisSchema>;
export type TileAnalysis = z.infer<typeof TileAnalysisSchema>;
