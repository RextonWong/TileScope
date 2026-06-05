import type { TileGrade, UseCase } from "./schema";

export function gradeTailwind(grade: TileGrade) {
  switch (grade) {
    case "A":
      return {
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        border: "border-emerald-500/30",
        badge: "bg-emerald-500/20 text-emerald-300",
        hex: "#10b981",
      };
    case "B":
      return {
        bg: "bg-sky-500/10",
        text: "text-sky-400",
        border: "border-sky-500/30",
        badge: "bg-sky-500/20 text-sky-300",
        hex: "#0ea5e9",
      };
    case "C":
      return {
        bg: "bg-red-500/10",
        text: "text-red-400",
        border: "border-red-500/30",
        badge: "bg-red-500/20 text-red-300",
        hex: "#ef4444",
      };
  }
}

export function gradeLabel(grade: TileGrade): string {
  switch (grade) {
    case "A": return "Grade A — First Quality";
    case "B": return "Grade B — Second Quality";
    case "C": return "Grade C — Commercial / Reject";
  }
}

export function useCaseLabel(useCase: UseCase): string {
  switch (useCase) {
    case "wall":              return "Wall Only";
    case "residential_floor": return "Residential Floor";
    case "light_commercial":  return "Light Commercial";
    case "heavy_commercial":  return "Heavy Commercial";
    case "reject":            return "Reject";
  }
}

export function useCaseTailwind(useCase: UseCase) {
  switch (useCase) {
    case "heavy_commercial":  return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "light_commercial":  return "bg-sky-500/20 text-sky-300 border-sky-500/30";
    case "residential_floor": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    case "wall":              return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    case "reject":            return "bg-red-500/20 text-red-300 border-red-500/30";
  }
}

export function severityTailwind(severity: string) {
  switch (severity) {
    case "minor":    return "bg-sky-500/20 text-sky-300 border-sky-500/30";
    case "moderate": return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    case "severe":   return "bg-red-500/20 text-red-300 border-red-500/30";
    default:         return "bg-neutral-500/20 text-neutral-300 border-neutral-500/30";
  }
}

export function defectBboxColor(severity: string): string {
  switch (severity) {
    case "minor":    return "#0ea5e9"; // sky-500
    case "moderate": return "#f59e0b"; // amber-500
    case "severe":   return "#ef4444"; // red-500
    default:         return "#6b7280";
  }
}
