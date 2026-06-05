"use client";

import type { TileAnalysis } from "@/lib/schema";
import { gradeTailwind, gradeLabel, useCaseLabel, useCaseTailwind } from "@/lib/grading";
import { CheckCircle2, XCircle, Layers, MapPin } from "lucide-react";

interface GradeCardProps {
  analysis: TileAnalysis;
}

export function GradeCard({ analysis }: GradeCardProps) {
  const colors = gradeTailwind(analysis.grade);

  return (
    <div className={`rounded-2xl border p-6 flex flex-col gap-5 ${colors.bg} ${colors.border}`}>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          ISO Quality Grade
        </span>
        <span className={`text-7xl font-black tabular-nums leading-none ${colors.text}`}>
          {analysis.grade}
        </span>
        <span className="text-sm text-neutral-400 font-medium">{gradeLabel(analysis.grade)}</span>
      </div>

      <div className="flex flex-col gap-3">
        <StatRow
          icon={<Layers size={15} />}
          label="Total Defects"
          value={String(analysis.total_defects)}
        />
        <StatRow
          icon={<MapPin size={15} />}
          label="Use Case"
          value={useCaseLabel(analysis.use_case)}
          valueClass={useCaseTailwind(analysis.use_case).split(" ")[1]}
        />
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-500">3 ft Inspection</span>
          {analysis.viewing_distance_3ft ? (
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <CheckCircle2 size={13} /> Pass
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-400 font-semibold">
              <XCircle size={13} /> Fail
            </span>
          )}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-500">10 ft Inspection</span>
          {analysis.viewing_distance_10ft ? (
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <CheckCircle2 size={13} /> Pass
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-400 font-semibold">
              <XCircle size={13} /> Fail
            </span>
          )}
        </div>
      </div>

      <p className="text-sm italic text-neutral-400 border-t border-neutral-800 pt-4 leading-relaxed">
        {analysis.reasoning}
      </p>
    </div>
  );
}

function StatRow({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-neutral-500">
        {icon}
        <span>{label}</span>
      </div>
      <span className={`font-semibold tabular-nums ${valueClass ?? "text-neutral-200"}`}>
        {value}
      </span>
    </div>
  );
}
