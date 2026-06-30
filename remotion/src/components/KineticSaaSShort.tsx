import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Audio,
} from "remotion";
import { z } from "zod";
import { brandTheme } from "../theme";
import { VirtualCursorRig } from "../VirtualCursorRig";
import { useCursorPosition } from "../hooks/useCursorPosition";
import { KineticCamera } from "./KineticCamera";
import { WordPopSubtitles, TimestampWord } from "./WordPopSubtitles";
import { MockupRig } from "./MockupRig";
import { CTABillboard } from "./CTABillboard";
import { Premium3DScene } from "./Premium3DScene";

// ═════════════════════════════════════════════════════════════════════════════
// Zod Schema — Typed prop bridge for the kinetic SaaS short template
// ═════════════════════════════════════════════════════════════════════════════
export const KineticSaaSShortSchema = z.object({
  voiceoverUrl: z.string(),
  timestamps: z.array(
    z.object({
      word: z.string(),
      start: z.number(),
      end: z.number(),
    })
  ),
  appScreenshot: z.union([z.string(), z.custom<React.ReactNode>()]),
  hookText: z.string(),
  ctaKeyword: z.string(),
  clickSchedule: z.array(
    z.object({
      targetX: z.number(),
      targetY: z.number(),
      triggerMs: z.number(),
    })
  ),
});

export type KineticSaaSShortProps = z.infer<typeof KineticSaaSShortSchema>;

// ═════════════════════════════════════════════════════════════════════════════
// Main Composition — 15s Kinetic SaaS Short (450 frames @ 30fps, 1080×1920)
// ═════════════════════════════════════════════════════════════════════════════
export const KineticSaaSShort: React.FC<KineticSaaSShortProps> = ({
  voiceoverUrl,
  timestamps,
  appScreenshot,
  hookText,
  ctaKeyword,
  clickSchedule,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Shared cursor position for anticipation system ────────────────────────
  const { x: cursorX, y: cursorY } = useCursorPosition(
    clickSchedule,
    fps,
    frame
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMELINE FLOW MATRIX — Mockup visual treatment per phase
  // ═══════════════════════════════════════════════════════════════════════════

  // Phase 1: Hook (0-3s, frames 0-90) — heavy blur, dimmed
  const mockupBlur = interpolate(frame, [0, 90, 105], [12, 12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const mockupBrightness = interpolate(
    frame,
    [0, 90, 105],
    [0.4, 0.4, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Phase 3: CTA (11-15s, frames 330-450) — fade mockup opacity
  const mockupOpacity = interpolate(frame, [330, 360, 450], [1, 0.3, 0.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Camera zoom/tilt toward cursor target during demo phase ───────────────
  const demoPhaseProgress = interpolate(frame, [90, 330], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Find the nearest upcoming click target for macro focus
  const currentTimeMs = (frame / fps) * 1000;
  const nextClick = clickSchedule.find((c) => c.triggerMs > currentTimeMs);
  const activeClick =
    nextClick || (clickSchedule.length > 0 ? clickSchedule[clickSchedule.length - 1] : null);

  const focusOffsetX = activeClick
    ? interpolate(demoPhaseProgress, [0, 1], [0, (activeClick.targetX - 50) * -0.3], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  const focusOffsetY = activeClick
    ? interpolate(demoPhaseProgress, [0, 1], [0, (activeClick.targetY - 50) * -0.3], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  const focusScale = interpolate(demoPhaseProgress, [0, 1], [1, 1.08], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brandTheme.colors.background,
        overflow: "hidden",
      }}
    >
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Layer 0 — Voiceover Audio Track                                   */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Audio src={voiceoverUrl} />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Layer 0.5 — 3D Atmospheric Background (headless-safe R3F)         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Premium3DScene />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Layer 1 — Kinetic Camera Wrapper                                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <KineticCamera clickSchedule={clickSchedule} timestamps={timestamps}>
        <div
          style={{
            width: "100%",
            height: "100%",
            transform: `translate(${focusOffsetX}%, ${focusOffsetY}%) scale(${focusScale})`,
            transformOrigin: "center center",
          }}
        >
          {/* Mockup Rig — App Screenshot Container */}
          <MockupRig
            appScreenshot={appScreenshot}
            cursorX={cursorX}
            cursorY={cursorY}
            blurAmount={mockupBlur}
            brightness={mockupBrightness}
            opacity={mockupOpacity}
          />
        </div>
      </KineticCamera>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Layer 2 — Word-by-Word Pop Subtitles (dead center)                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <WordPopSubtitles timestamps={timestamps as TimestampWord[]} hookText={hookText} />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Layer 3 — Virtual Cursor Rig with click shockwaves                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <VirtualCursorRig clickSchedule={clickSchedule} />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Layer 4 — CTA Billboard Overlay (frames 330-450)                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {frame >= 330 && <CTABillboard ctaKeyword={ctaKeyword} />}
    </AbsoluteFill>
  );
};
