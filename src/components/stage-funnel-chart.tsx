"use client";

import { useState } from "react";
import type { StagePoint } from "@/lib/trends";

export function StageFunnelChart({
  title,
  data,
  color,
  emptyLabel = "Nenhuma pessoa visivel para calcular o funil.",
}: {
  title: string;
  data: StagePoint[];
  color: string;
  emptyLabel?: string;
}) {
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div>
      <p className="mb-3 text-sm font-bold text-slate-950">{title}</p>

      {total === 0 ? (
        <div className="flex h-[140px] items-center justify-center rounded-lg bg-slate-50 text-sm font-semibold text-slate-400">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((item) => {
            const widthPercent = Math.max((item.value / maxValue) * 100, item.value > 0 ? 6 : 0);
            const share = total ? Math.round((item.value / total) * 100) : 0;
            const hovered = hoverLabel === item.label;

            return (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>{item.label}</span>
                  <span className="text-slate-400">{share}%</span>
                </div>
                <div
                  className="relative h-5 rounded-lg bg-slate-100"
                  onMouseEnter={() => setHoverLabel(item.label)}
                  onMouseLeave={() => setHoverLabel((current) => (current === item.label ? null : current))}
                  onFocus={() => setHoverLabel(item.label)}
                  tabIndex={0}
                >
                  <div
                    className="h-5 rounded-lg transition-opacity"
                    style={{
                      width: `${widthPercent}%`,
                      backgroundColor: color,
                      opacity: hovered ? 0.85 : 1,
                    }}
                  />
                  <span className="absolute inset-y-0 left-2 flex items-center text-xs font-bold text-white">
                    {item.value > 0 ? item.value : ""}
                  </span>
                  {hovered && (
                    <div className="pointer-events-none absolute -top-9 left-0 rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg">
                      {item.label}: <span className="font-bold">{item.value}</span> ({share}%)
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
