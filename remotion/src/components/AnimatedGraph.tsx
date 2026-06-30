// workspace-video/remotion-video/src/AnimatedGraph.tsx
import React, { useMemo } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { tokens } from "../theme";

export interface GraphSpec {
  type: string;
  xLabel: string;
  yLabel: string;
}

interface AnimatedGraphProps {
  spec: GraphSpec;
  width: number;
  height: number;
  enterProgress: number;
}

export const AnimatedGraph: React.FC<AnimatedGraphProps> = ({
  spec,
  width,
  height,
  enterProgress,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Overlay dimensions (~36 % × 30 %)
  const graphW = Math.floor(width * 0.36);
  const graphH = Math.floor(height * 0.30);
  const margin = { top: 52, right: 32, bottom: 60, left: 72 };
  const innerW = graphW - margin.left - margin.right;
  const innerH = graphH - margin.top - margin.bottom;

  // Spring physics for bar growth and line draw
  const springProgress = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.9, stiffness: 110 },
  });

  // Deterministic pseudo-data seeded from labels for stable visuals
  const data = useMemo(() => {
    const seed =
      spec.type.length * 7 + spec.xLabel.length * 3 + spec.yLabel.length * 11;
    return Array.from({ length: 7 }, (_, i) => {
      const t = (i + seed) * 0.88;
      return {
        label: `D${i + 1}`,
        value: 0.25 + 0.55 * Math.abs(Math.sin(t)) + 0.15 * Math.cos(t * 1.6),
      };
    });
  }, [spec]);

  const maxValue = 1.0;

  return (
    <div
      style={{
        position: "absolute",
        top: height * 0.06,
        left: width * 0.06,
        width: graphW,
        height: graphH,
        opacity: enterProgress,
      }}
    >
      <svg
        width={graphW}
        height={graphH}
        viewBox={`0 0 ${graphW} ${graphH}`}
        style={{ overflow: "visible" }}
      >
        {/* Frosted panel background */}
        <rect
          x={0}
          y={0}
          width={graphW}
          height={graphH}
          rx={14}
          fill={tokens.colors.panelBg}
          stroke={tokens.colors.panelBorder}
          strokeWidth={1}
        />

        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Horizontal grid lines — native SVG lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = innerH - t * innerH;
            return (
              <line
                key={`hgrid-${t}`}
                x1={0}
                y1={y}
                x2={innerW}
                y2={y}
                stroke={tokens.colors.gridLine}
                strokeWidth={1}
              />
            );
          })}

          {/* Axes */}
          <line
            x1={0}
            y1={innerH}
            x2={innerW}
            y2={innerH}
            stroke={tokens.colors.axisLine}
            strokeWidth={2}
          />
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={innerH}
            stroke={tokens.colors.axisLine}
            strokeWidth={2}
          />

          {/* X-axis label */}
          <text
            x={innerW / 2}
            y={innerH + margin.bottom * 0.62}
            fill={tokens.colors.labelText}
            fontSize={11}
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
            fontWeight={600}
          >
            {spec.xLabel}
          </text>

          {/* Y-axis label */}
          <text
            x={-margin.left * 0.5}
            y={innerH / 2}
            fill={tokens.colors.labelText}
            fontSize={11}
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
            fontWeight={600}
            transform={`rotate(-90, ${-margin.left * 0.5}, ${innerH / 2})`}
          >
            {spec.yLabel}
          </text>

          {/* Bars animated via Remotion spring physics */}
          {data.map((pt, i) => {
            const barW = (innerW / data.length) * 0.5;
            const x = (i + 0.5) * (innerW / data.length) - barW / 2;
            const fullH = (pt.value / maxValue) * innerH;
            const h = fullH * springProgress;
            const y = innerH - h;

            return (
              <rect
                key={`bar-${i}`}
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={4}
                fill={tokens.colors.graphBar}
              />
            );
          })}

          {/* Trend line overlay — native SVG polyline */}
          <polyline
            fill="none"
            stroke={tokens.colors.graphLine}
            strokeWidth={2.5}
            opacity={interpolate(springProgress, [0.15, 0.55], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}
            points={data
              .map((pt, i) => {
                const x = (i + 0.5) * (innerW / data.length);
                const y =
                  innerH - (pt.value / maxValue) * innerH * springProgress;
                return `${x},${y}`;
              })
              .join(" ")}
          />

          {/* Scatter dots springing in */}
          {data.map((pt, i) => {
            const x = (i + 0.5) * (innerW / data.length);
            const y =
              innerH - (pt.value / maxValue) * innerH * springProgress;

            return (
              <circle
                key={`dot-${i}`}
                cx={x}
                cy={y}
                r={4 * springProgress}
                fill={tokens.colors.graphDot}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
};
