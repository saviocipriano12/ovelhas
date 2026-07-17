"use client";

import { useState } from "react";
import type { MonthlyPoint } from "@/lib/trends";

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 34;
const PAD_RIGHT = 46;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

function niceMax(value: number) {
  if (value <= 0) {
    return 4;
  }

  const step = value <= 10 ? 2 : value <= 50 ? 10 : value <= 200 ? 25 : 50;
  return Math.ceil(value / step) * step;
}

export function TrendLineChart({
  title,
  data,
  color,
  yMax,
  yMin = 0,
  valueSuffix = "",
  emptyLabel = "Sem dados neste periodo.",
}: {
  title: string;
  data: MonthlyPoint[];
  color: string;
  yMax?: number;
  yMin?: number;
  valueSuffix?: string;
  emptyLabel?: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const values = data.map((point) => point.value).filter((value): value is number => value !== null);
  const hasData = values.length > 0;
  const resolvedMax = yMax ?? niceMax(Math.max(...values, 0));
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  function xForIndex(index: number) {
    return PAD_LEFT + stepX * index;
  }

  function yForValue(value: number) {
    const ratio = resolvedMax === yMin ? 0 : (value - yMin) / (resolvedMax - yMin);
    return PAD_TOP + plotHeight - ratio * plotHeight;
  }

  const segments: string[] = [];
  let current = "";
  data.forEach((point, index) => {
    if (point.value === null) {
      if (current) {
        segments.push(current);
        current = "";
      }
      return;
    }

    const command = current ? "L" : "M";
    current += `${current ? " " : ""}${command}${xForIndex(index).toFixed(1)},${yForValue(point.value).toFixed(1)}`;
  });
  if (current) {
    segments.push(current);
  }

  const lastPoint = [...data].reverse().find((point) => point.value !== null);
  const lastIndex = lastPoint ? data.indexOf(lastPoint) : -1;
  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const gridLines = [0, 0.5, 1];

  return (
    <div className="relative">
      <p className="mb-3 text-sm font-bold text-slate-950">{title}</p>

      {!hasData ? (
        <div className="flex h-[180px] items-center justify-center rounded-lg bg-slate-50 text-sm font-semibold text-slate-400">
          {emptyLabel}
        </div>
      ) : (
        <>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={title}>
            {gridLines.map((ratio) => {
              const y = PAD_TOP + plotHeight - ratio * plotHeight;
              const value = Math.round(yMin + ratio * (resolvedMax - yMin));
              return (
                <g key={ratio}>
                  <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} stroke="#e1e0d9" strokeWidth={1} />
                  <text x={PAD_LEFT - 8} y={y + 3} textAnchor="end" fontSize={10} fill="#898781">
                    {value}
                  </text>
                </g>
              );
            })}

            {data.map((point, index) => (
              <text
                key={point.key}
                x={xForIndex(index)}
                y={HEIGHT - 8}
                textAnchor="middle"
                fontSize={10}
                fill="#898781"
              >
                {point.label}
              </text>
            ))}

            {segments.map((segment, index) => (
              <path key={index} d={segment} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            ))}

            {data.map((point, index) =>
              point.value === null ? null : (
                <circle
                  key={point.key}
                  cx={xForIndex(index)}
                  cy={yForValue(point.value)}
                  r={4}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              ),
            )}

            {lastIndex >= 0 && lastPoint?.value !== null && lastPoint !== undefined && (
              <text
                x={Math.min(xForIndex(lastIndex) + 8, WIDTH - 6)}
                y={yForValue(lastPoint.value) - 8}
                fontSize={12}
                fontWeight={700}
                fill="#0b0b0b"
              >
                {lastPoint.value}
                {valueSuffix}
              </text>
            )}

            {hoverIndex !== null && (
              <line
                x1={xForIndex(hoverIndex)}
                x2={xForIndex(hoverIndex)}
                y1={PAD_TOP}
                y2={PAD_TOP + plotHeight}
                stroke="#c3c2b7"
                strokeWidth={1}
              />
            )}

            {data.map((point, index) => (
              <rect
                key={`hit-${point.key}`}
                x={xForIndex(index) - stepX / 2}
                y={PAD_TOP}
                width={stepX || plotWidth}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex((current) => (current === index ? null : current))}
                onFocus={() => setHoverIndex(index)}
                tabIndex={0}
              />
            ))}
          </svg>

          {hovered && (
            <div
              className="pointer-events-none absolute top-1 rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg"
              style={{
                left: `${(xForIndex(hoverIndex ?? 0) / WIDTH) * 100}%`,
                transform: "translateX(-50%)",
              }}
            >
              <span className="block text-[10px] font-bold uppercase text-slate-300">{hovered.label}</span>
              <span className="mt-0.5 block">
                {hovered.value === null ? "Sem dados" : `${hovered.value}${valueSuffix}`}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
