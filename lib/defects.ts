export type DefectCategory = "surface" | "edge_dimensional" | "color_pattern";
export type DefectSeverityIndicator = "low" | "medium" | "high";

export interface DefectTypeInfo {
  id: string;
  name: string;
  category: DefectCategory;
  description: string;
  cause: string;
  detection: string;
  severity_indicator: DefectSeverityIndicator;
}

export const DEFECT_TYPES: DefectTypeInfo[] = [
  // ── Surface Defects ────────────────────────────────────────────────────────
  {
    id: "crack",
    name: "Crack",
    category: "surface",
    description: "Linear fracture through the tile body or glaze layer.",
    cause: "Thermal shock during firing, mechanical impact, or substrate movement after installation.",
    detection: "AI identifies linear discontinuities and surface texture breaks across glaze or body.",
    severity_indicator: "high",
  },
  {
    id: "crazing",
    name: "Crazing",
    category: "surface",
    description: "Fine network of hairline cracks across the glaze surface, resembling a spider web.",
    cause: "Mismatch between glaze and body thermal expansion coefficients during cooling.",
    detection: "AI detects fine reticulated crack patterns distributed over the glaze surface.",
    severity_indicator: "medium",
  },
  {
    id: "pinhole",
    name: "Pinhole",
    category: "surface",
    description: "Small circular voids or craters in the glaze surface.",
    cause: "Gas entrapment during glaze firing, or contamination in the glaze slurry.",
    detection: "AI identifies small circular depressions or puncture-like marks on the glaze.",
    severity_indicator: "low",
  },
  {
    id: "blister",
    name: "Blister",
    category: "surface",
    description: "Raised bubble or hollow dome on the glaze surface.",
    cause: "Gas trapped beneath the glaze during high-temperature firing.",
    detection: "AI detects raised hemispherical anomalies with shadow gradients indicating elevation.",
    severity_indicator: "medium",
  },
  {
    id: "dry_spot",
    name: "Dry Spot",
    category: "surface",
    description: "Unglazed patch where the glaze failed to adhere or was absent during application.",
    cause: "Uneven glaze application, contaminated tile body, or glaze repulsion.",
    detection: "AI identifies matte or rough patches contrasting with the surrounding glazed surface.",
    severity_indicator: "medium",
  },
  {
    id: "speck",
    name: "Speck / Spot",
    category: "surface",
    description: "Foreign particle inclusion or a dark/light mark on the tile face.",
    cause: "Contamination in raw materials, iron spots, or dust particles fired into the glaze.",
    detection: "AI detects localised colour anomalies that deviate from the surrounding field.",
    severity_indicator: "low",
  },
  {
    id: "glaze_devitrification",
    name: "Glaze Devitrification",
    category: "surface",
    description: "Crystalline haze or cloudy patch on the glaze, often with a milky or frosted appearance.",
    cause: "Uncontrolled crystallisation of the glaze glass during slow cooling.",
    detection: "AI detects localised areas of reduced reflectivity and diffuse scattering patterns.",
    severity_indicator: "medium",
  },
  {
    id: "fish_scale",
    name: "Fish Scale",
    category: "surface",
    description: "Curved flakes of glaze lifting or detaching in a scale-like pattern.",
    cause: "Compressive stresses from glaze expansion exceeding body expansion (peeling/shivering).",
    detection: "AI detects curved edge boundaries and shadow patterns indicating lifted glaze sections.",
    severity_indicator: "high",
  },
  {
    id: "scratch",
    name: "Scratch",
    category: "surface",
    description: "Linear abrasion mark on the tile surface.",
    cause: "Mechanical contact with hard or sharp objects during handling, transport, or installation.",
    detection: "AI identifies fine linear marks that break surface specularity.",
    severity_indicator: "low",
  },
  // ── Edge & Dimensional Defects ─────────────────────────────────────────────
  {
    id: "chip",
    name: "Chip",
    category: "edge_dimensional",
    description: "Missing fragment at a tile edge or corner.",
    cause: "Impact damage during handling, transport, or installation.",
    detection: "AI detects irregular concave breaks at tile boundaries where material is absent.",
    severity_indicator: "high",
  },
  {
    id: "rough_edge",
    name: "Rough Edge",
    category: "edge_dimensional",
    description: "Uneven, jagged, or poorly fired tile edge.",
    cause: "Die wear, improper cutting, or incomplete sintering at tile edges.",
    detection: "AI identifies irregular edge profiles deviating from expected straight boundaries.",
    severity_indicator: "low",
  },
  {
    id: "warping",
    name: "Warping",
    category: "edge_dimensional",
    description: "Non-planar tile body — bow (curvature across width) or twist (diagonal distortion).",
    cause: "Non-uniform drying or firing temperature gradients through the tile body.",
    detection: "AI detects shadow/highlight gradients indicating surface non-planarity per ISO 10545-2.",
    severity_indicator: "high",
  },
  {
    id: "lippage",
    name: "Lippage",
    category: "edge_dimensional",
    description: "Height difference between adjacent tiles visible at grout joints.",
    cause: "Warped tiles, uneven substrate, or inadequate trowel technique during installation.",
    detection: "AI identifies step discontinuities at tile edges when multiple tiles are in frame.",
    severity_indicator: "medium",
  },
  // ── Color & Pattern Defects ────────────────────────────────────────────────
  {
    id: "color_inconsistency",
    name: "Color Inconsistency",
    category: "color_pattern",
    description: "Visible shade or tone variation across the tile face compared to the reference.",
    cause: "Inconsistent raw material batches, kiln temperature variation, or pigment segregation.",
    detection: "AI compares colour distribution against expected hue/saturation range for the design.",
    severity_indicator: "medium",
  },
  {
    id: "print_misalignment",
    name: "Print Misalignment",
    category: "color_pattern",
    description: "Pattern registration error — design layers are offset or misregistered.",
    cause: "Inkjet head misalignment, substrate positioning error, or conveyor speed variation.",
    detection: "AI detects double-edge artefacts or ghost outlines indicating layer offset.",
    severity_indicator: "medium",
  },
  {
    id: "glaze_mark",
    name: "Glaze Mark",
    category: "color_pattern",
    description: "Smear, streak, or area of uneven glaze application.",
    cause: "Glaze curtain drips, spray nozzle blockage, or belt transfer contamination.",
    detection: "AI identifies bands or streaks of altered glaze thickness / reflectivity.",
    severity_indicator: "low",
  },
];

export const DEFECT_CATEGORIES: { id: DefectCategory; label: string; description: string }[] = [
  {
    id: "surface",
    label: "Surface Defects",
    description: "Defects in the glaze or tile body surface",
  },
  {
    id: "edge_dimensional",
    label: "Edge & Dimensional",
    description: "Geometry and edge integrity defects",
  },
  {
    id: "color_pattern",
    label: "Color & Pattern",
    description: "Colour, tone, and print registration defects",
  },
];

export function getDefectById(id: string): DefectTypeInfo | undefined {
  return DEFECT_TYPES.find((d) => d.id === id);
}

export function getDefectsByCategory(category: DefectCategory): DefectTypeInfo[] {
  return DEFECT_TYPES.filter((d) => d.category === category);
}
