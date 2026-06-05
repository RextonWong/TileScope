import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { TileAnalysisSchema } from "./schema";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is not set");
  return new GoogleGenAI({ apiKey });
}

const DEFECT_LIST = `
Surface Defects:
  crack                — linear fracture through tile body or glaze
  crazing              — fine network of hairline cracks (spider-web glaze cracks)
  pinhole              — small circular void / crater in the glaze
  blister              — raised bubble or hollow in the glaze surface
  dry_spot             — unglazed patch where glaze failed to adhere
  speck                — foreign particle inclusion or isolated dark/light mark
  glaze_devitrification — crystalline haze or cloudy patch on glaze
  fish_scale           — curved glaze flakes lifting from surface
  scratch              — linear abrasion mark on glaze

Edge & Dimensional Defects:
  chip                 — missing fragment at edge or corner
  rough_edge           — uneven, jagged, or poorly fired edge profile
  warping              — non-planar tile body (bow or twist)
  lippage              — height step between adjacent tiles (if multiple tiles visible)

Color & Pattern Defects:
  color_inconsistency  — shade/tone variation vs expected reference
  print_misalignment   — pattern registration offset or layer misprint
  glaze_mark           — smear, streak, or uneven glaze application band
`;

const PROMPT_TEMPLATE = (photoCount: number) =>
  `You are an expert ceramic tile quality inspector analysing ${photoCount} photograph${photoCount > 1 ? "s" : ""} of a ceramic tile.
Photos provided: ${photoCount === 1 ? "face view" : photoCount === 2 ? "face view and edge/corner view" : "face view, edge view, and corner view"}.

Apply ISO 10545-2, EN 14411, and ANSI A137.1 inspection criteria.

Return STRICT JSON matching the provided schema. No prose, no markdown.

── DEFECT TAXONOMY ──────────────────────────────────────────────────────────
${DEFECT_LIST}

── DETECTION ────────────────────────────────────────────────────────────────
For each visible defect:
  id       : integer starting at 0, unique across all defects
  bbox     : [ymin, xmin, ymax, xmax] normalised 0-1000 on the photo where the defect appears
  type     : one of the defect IDs above
  severity : "minor" | "moderate" | "severe"
             minor    — barely perceptible at 3 ft, does not affect function
             moderate — visible at 3 ft, borderline visible at 10 ft
             severe   — clearly visible at 3 ft and at 10 ft; structural or aesthetic impact
  confidence : 0.0–1.0
  zone     : "face" | "edge" | "corner" (which part of the tile is affected)

── GRADING (ISO 10545-2 / EN 14411 / ANSI A137.1) ──────────────────────────
  "A" — Grade A First Quality:
        No structural defects (crack, fish_scale, chip, warping).
        ≤5 minor defects total. No moderate/severe defects.
        Passes visual inspection from 3 ft and 10 ft.

  "B" — Grade B Second Quality:
        2–4 minor or moderate defects. No cracks or fish_scale.
        Defects not visible from 10 ft. Suitable for less-prominent installations.

  "C" — Commercial / Reject:
        ≥6 defects of any severity, OR any crack / fish_scale / severe chip,
        OR warping exceeds 0.5% of tile dimension.
        Not acceptable for finished surfaces; reject or use as cut-fill.

── USE-CASE SUITABILITY ─────────────────────────────────────────────────────
  "wall"              — decorative wall tile only
  "residential_floor" — domestic floor use (light traffic)
  "light_commercial"  — office or retail (medium traffic)
  "heavy_commercial"  — high-traffic commercial / industrial
  "reject"            — unacceptable for any finished installation

Assign the highest suitable use-case consistent with the detected defects and grade.

── VIEWING DISTANCE CHECKS ─────────────────────────────────────────────────
  viewing_distance_3ft  : true if tile passes visual inspection from 3 ft (no severe defects clearly visible)
  viewing_distance_10ft : true if defects are NOT visible from 10 ft (Grade B threshold)

── DETAILED ANALYSIS ────────────────────────────────────────────────────────
  overall (2-3 sentences): Total defect count, dominant defect types, worst defect
    (cite ID, type, severity), and overall tile condition summary.

  notable_defects (array of 1-6 bullet strings):
    Format: "Defect #<id> — <type> (<severity>) — <one-line impact>"
    Example: "Defect #2 — crack (severe) — structural fracture, disqualifies Grade A."

  grade_criteria_applied (3-4 sentences):
    Explain which ISO 10545-2/EN 14411 thresholds were applied and why the
    chosen grade was assigned. Reference specific defect IDs and measured severities.

  use_case_rationale (2-3 sentences):
    Explain which use cases are acceptable given the detected defects and grade.

  recommendations (2-3 sentences):
    Practical advice: accept/reject, segregate for specific use, regrind/rework if applicable.

── VALIDITY ─────────────────────────────────────────────────────────────────
Set is_tile to true ONLY if the image(s) clearly show a ceramic, porcelain, or stone tile.
If the image is not a tile (e.g. a person, food, landscape, wood, fabric), set is_tile to false,
return an empty defects array, total_defects 0, grade "C", use_case "reject",
both viewing distances false, and explain in detailed_analysis.overall what was wrong.`;

const defectItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.INTEGER },
    bbox: { type: Type.ARRAY, items: { type: Type.NUMBER } },
    type: {
      type: Type.STRING,
      enum: [
        "crack", "crazing", "pinhole", "blister", "dry_spot", "speck",
        "glaze_devitrification", "fish_scale", "scratch",
        "chip", "rough_edge", "warping", "lippage",
        "color_inconsistency", "print_misalignment", "glaze_mark",
      ],
    },
    severity: { type: Type.STRING, enum: ["minor", "moderate", "severe"] },
    confidence: { type: Type.NUMBER },
    zone: { type: Type.STRING, enum: ["face", "edge", "corner"] },
  },
  required: ["id", "bbox", "type", "severity", "confidence", "zone"],
};

const GEMINI_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    is_tile: { type: Type.BOOLEAN },
    defects: { type: Type.ARRAY, items: defectItemSchema },
    total_defects: { type: Type.INTEGER },
    grade: { type: Type.STRING, enum: ["A", "B", "C"] },
    use_case: {
      type: Type.STRING,
      enum: ["wall", "residential_floor", "light_commercial", "heavy_commercial", "reject"],
    },
    viewing_distance_3ft: { type: Type.BOOLEAN },
    viewing_distance_10ft: { type: Type.BOOLEAN },
    reasoning: { type: Type.STRING },
    detailed_analysis: {
      type: Type.OBJECT,
      properties: {
        overall: { type: Type.STRING },
        notable_defects: { type: Type.ARRAY, items: { type: Type.STRING } },
        grade_criteria_applied: { type: Type.STRING },
        use_case_rationale: { type: Type.STRING },
        recommendations: { type: Type.STRING },
      },
      required: [
        "overall",
        "notable_defects",
        "grade_criteria_applied",
        "use_case_rationale",
        "recommendations",
      ],
    },
  },
  required: [
    "is_tile",
    "defects",
    "total_defects",
    "grade",
    "use_case",
    "viewing_distance_3ft",
    "viewing_distance_10ft",
    "reasoning",
    "detailed_analysis",
  ],
};

export interface TilePhotoInput {
  base64: string;
  mime?: string;
  label?: string;
}

const EDITOR_PROMPT_TEMPLATE = (photoCount: number) =>
  `You are an expert ceramic tile quality inspector analysing ${photoCount} procedurally-rendered image${photoCount > 1 ? "s" : ""} of a ceramic tile.
These images were generated by a tile inspection simulation tool. The user has manually placed defects on the tile to demonstrate real manufacturing defects.
Your task: analyse these rendered tile images EXACTLY as you would analyse real photographs of a physical tile.
Treat each visible defect as if it is a real defect present on a physical tile sample.
${photoCount > 1 ? `Images provided: ${photoCount} surface views — face (main glazed surface) and edge views.` : "Image provided: face (main glazed surface)."}

Apply ISO 10545-2, EN 14411, and ANSI A137.1 inspection criteria.

Return STRICT JSON matching the provided schema. No prose, no markdown.

── DEFECT TAXONOMY ──────────────────────────────────────────────────────────
${DEFECT_LIST}

── DETECTION ────────────────────────────────────────────────────────────────
For each visible defect:
  id       : integer starting at 0, unique across all defects
  bbox     : [ymin, xmin, ymax, xmax] normalised 0-1000 on the photo where the defect appears
  type     : one of the defect IDs above
  severity : "minor" | "moderate" | "severe"
             minor    — barely perceptible at 3 ft, does not affect function
             moderate — visible at 3 ft, borderline visible at 10 ft
             severe   — clearly visible at 3 ft and at 10 ft; structural or aesthetic impact
  confidence : 0.0–1.0
  zone     : "face" | "edge" | "corner" (which part of the tile is affected)

── GRADING (ISO 10545-2 / EN 14411 / ANSI A137.1) ──────────────────────────
  "A" — Grade A First Quality:
        No structural defects (crack, fish_scale, chip, warping).
        ≤5 minor defects total. No moderate/severe defects.
        Passes visual inspection from 3 ft and 10 ft.

  "B" — Grade B Second Quality:
        2–4 minor or moderate defects. No cracks or fish_scale.
        Defects not visible from 10 ft. Suitable for less-prominent installations.

  "C" — Commercial / Reject:
        ≥6 defects of any severity, OR any crack / fish_scale / severe chip,
        OR warping exceeds 0.5% of tile dimension.
        Not acceptable for finished surfaces; reject or use as cut-fill.

── USE-CASE SUITABILITY ─────────────────────────────────────────────────────
  "wall"              — decorative wall tile only
  "residential_floor" — domestic floor use (light traffic)
  "light_commercial"  — office or retail (medium traffic)
  "heavy_commercial"  — high-traffic commercial / industrial
  "reject"            — unacceptable for any finished installation

Assign the highest suitable use-case consistent with the detected defects and grade.

── VIEWING DISTANCE CHECKS ─────────────────────────────────────────────────
  viewing_distance_3ft  : true if tile passes visual inspection from 3 ft (no severe defects clearly visible)
  viewing_distance_10ft : true if defects are NOT visible from 10 ft (Grade B threshold)

── DETAILED ANALYSIS ────────────────────────────────────────────────────────
  overall (2-3 sentences): Total defect count, dominant defect types, worst defect
    (cite ID, type, severity), and overall tile condition summary.

  notable_defects (array of 1-6 bullet strings):
    Format: "Defect #<id> — <type> (<severity>) — <one-line impact>"
    Example: "Defect #2 — crack (severe) — structural fracture, disqualifies Grade A."

  grade_criteria_applied (3-4 sentences):
    Explain which ISO 10545-2/EN 14411 thresholds were applied and why the
    chosen grade was assigned. Reference specific defect IDs and measured severities.

  use_case_rationale (2-3 sentences):
    Explain which use cases are acceptable given the detected defects and grade.

  recommendations (2-3 sentences):
    Practical advice: accept/reject, segregate for specific use, regrind/rework if applicable.

── VALIDITY ─────────────────────────────────────────────────────────────────
Set is_tile to true — these are definitively rendered ceramic tile images.`;

export interface TileEditorPhotoInput {
  base64: string;
  mime?: string;
  label?: string;
}

export async function analyzeTileEditor(photos: TileEditorPhotoInput[]) {
  const photoParts = photos.flatMap((p, i) => [
    { text: `SURFACE ${i + 1}${p.label ? ` (${p.label})` : ""}:` },
    {
      inlineData: {
        mimeType: p.mime ?? "image/jpeg",
        data: p.base64,
      },
    },
  ]);

  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      { text: EDITOR_PROMPT_TEMPLATE(photos.length) },
      ...photoParts,
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  });

  const parsed = JSON.parse(response.text ?? "{}") as unknown;
  return TileAnalysisSchema.parse(parsed);
}

export async function analyzeTile(photos: TilePhotoInput[]) {
  const photoParts = photos.flatMap((p, i) => [
    { text: `PHOTO ${i + 1}${p.label ? ` (${p.label})` : ""}:` },
    {
      inlineData: {
        mimeType: p.mime ?? "image/jpeg",
        data: p.base64,
      },
    },
  ]);

  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      { text: PROMPT_TEMPLATE(photos.length) },
      ...photoParts,
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  });

  const parsed = JSON.parse(response.text ?? "{}") as unknown;
  return TileAnalysisSchema.parse(parsed);
}
