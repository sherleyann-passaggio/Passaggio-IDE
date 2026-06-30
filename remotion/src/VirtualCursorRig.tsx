import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import React, { useMemo } from "react";
import { brandTheme } from "./theme";

// ═════════════════════════════════════════════════════════════════════════════
// VIRTUAL CURSOR RIG — Spring Mouse Engine with 5% Proximity Anticipation
// ═════════════════════════════════════════════════════════════════════════════
// Movement: Fluid spring interpolation between targetX/Y percentage nodes
// Physics:  { mass: 0.3, damping: 8, stiffness: 120 }
// Click:    Cursor scales to 0.75 at impact; accent ring ripples outward
// Anticipation: UI elements illuminate when cursor is within 5% proximity
// Pointer:  Minimalist SVG arrow with drop-shadow(0px 4px 10px rgba(0,0,0,0.4))
// ═════════════════════════════════════════════════════════════════════════════

export interface ClickTarget {
  targetX: number; // Percentage across viewport (0–100)
  targetY: number; // Percentage down viewport (0–100)
  triggerMs: number; // Millisecond timestamp when click drops
}

const CURSOR_SPRING = {
  mass: 0.3,
  damping: 8,
  stiffness: 120,
};

const CLICK_SPRING = {
  mass: 0.3,
  damping: 8,
  stiffness: 120,
};

/** Proximity threshold (percentage points) for hover anticipation */
const PROXIMITY_THRESHOLD = 5;

export const VirtualCursorRig: React.FC<{ clickSchedule: ClickTarget[] }> = ({
  clickSchedule,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. SEGMENT RESOLUTION — Find current movement interval
  // ═══════════════════════════════════════════════════════════════════════════
  const currentTargetIndex = clickSchedule.findIndex(
    (t) => currentTimeMs < t.triggerMs
  );
  const activeIndex =
    currentTargetIndex === -1
      ? clickSchedule.length - 1
      : currentTargetIndex;

  const startNode =
    activeIndex === 0
      ? { targetX: 50, targetY: 50, triggerMs: 0 }
      : clickSchedule[activeIndex - 1];
  const endNode = clickSchedule[activeIndex];

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. SPRING-BASED PATH INTERPOLATION (Fluid cursor movement)
  // ═══════════════════════════════════════════════════════════════════════════
  // Instead of linear interpolation, we drive the cursor with a spring that
  // tracks the normalized progress through the current segment.
  const segmentDurationMs = Math.max(1, endNode.triggerMs - startNode.triggerMs);
  const elapsedInSegment = Math.max(0, currentTimeMs - startNode.triggerMs);
  const rawProgress = Math.min(1, elapsedInSegment / segmentDurationMs);

  // Spring-smooth the progress value itself for organic hand-like motion
  const springProgress = spring({
    frame: Math.round(rawProgress * fps * 2), // Compress spring window
    fps,
    config: CURSOR_SPRING,
  });

  const cursorX = interpolate(
    springProgress,
    [0, 1],
    [startNode.targetX, endNode.targetX],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const cursorY = interpolate(
    springProgress,
    [0, 1],
    [startNode.targetY, endNode.targetY],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CLICK SQUEEZE & SHOCKWAVE RIPPLE PHYSICS
  // ═══════════════════════════════════════════════════════════════════════════
  const clickProgress = spring({
    frame: Math.max(0, (currentTimeMs - endNode.triggerMs) / 1000 * fps),
    fps,
    config: CLICK_SPRING,
  });

  // Scale down pointer at exact moment of impact
  const cursorScale = interpolate(clickProgress, [0, 0.2, 1], [1, 0.75, 1]);

  // Expand accent ring outward from target origin
  const rippleScale = interpolate(clickProgress, [0, 1], [0.8, 2.5]);
  const rippleOpacity = interpolate(clickProgress, [0, 0.8, 1], [0.6, 0.2, 0]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. 5% PROXIMITY ANTICIPATION — Compute glow intensity for next target
  // ═══════════════════════════════════════════════════════════════════════════
  const proximityGlow = useMemo(() => {
    if (!endNode) return 0;
    const dx = Math.abs(cursorX - endNode.targetX);
    const dy = Math.abs(cursorY - endNode.targetY);
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance >= PROXIMITY_THRESHOLD) return 0;
    // Normalize: 0 at threshold → 1 at exact target
    return 1 - distance / PROXIMITY_THRESHOLD;
  }, [cursorX, cursorY, endNode]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 999,
      }}
    >
      {/* ── Proximity Anticipation Glow (illuminates target before contact) ── */}
      {proximityGlow > 0 && (
        <div
          style={{
            position: "absolute",
            left: `${endNode.targetX}%`,
            top: `${endNode.targetY}%`,
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            backgroundColor: `${brandTheme.colors.highlight}${Math.round(
              proximityGlow * 40
            )
              .toString(16)
              .padStart(2, "0")}`,
            transform: "translate(-50%, -50%)",
            filter: `blur(${8 + proximityGlow * 12}px)`,
            transition: "none",
          }}
        />
      )}

      {/* ── Click Shockwave Vector ── */}
      <div
        style={{
          position: "absolute",
          left: `${cursorX}%`,
          top: `${cursorY}%`,
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          border: `2px solid ${brandTheme.colors.highlight}`,
          transform: `translate(-50%, -50%) scale(${rippleScale})`,
          opacity: rippleOpacity,
          backgroundColor: `${brandTheme.colors.highlight}22`,
        }}
      />

      {/* ── Stylized Minimalist SVG Arrow Pointer ── */}
      <svg
        style={{
          position: "absolute",
          left: `${cursorX}%`,
          top: `${cursorY}%`,
          width: "24px",
          height: "24px",
          transform: `translate(-2px, -2px) scale(${cursorScale})`,
          filter: "drop-shadow(0px 4px 10px rgba(0,0,0,0.4))",
        }}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M4.5 3V17.2L8.9 13.1L14.5 21L17.5 19L12.1 11.3L18.5 11.3L4.5 3Z"
          fill={brandTheme.colors.accentText}
          stroke={brandTheme.colors.background}
          strokeWidth="2"
        />
      </svg>
    </div>
  );
};
