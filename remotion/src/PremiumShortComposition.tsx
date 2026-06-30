import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Audio,
} from "remotion";
import { z } from "zod";
import { brandTheme } from "./theme";
import { WordPopSubtitles, TimestampWord } from "./components/WordPopSubtitles";
import { CTABillboard } from "./components/CTABillboard";
import { Premium3DScene } from "./components/Premium3DScene";
import { IconStage, IconCue } from "./components/IconStage";

// ═════════════════════════════════════════════════════════════════════════════
// ZOD SCHEMA — Typed prop bridge for the master 15s kinetic SaaS short
// ═════════════════════════════════════════════════════════════════════════════
export const PremiumShortCompositionSchema = z.object({
  voiceoverUrl: z.string(),
  timestamps: z.array(
    z.object({
      word: z.string(),
      start: z.number(), // seconds
      end: z.number(),   // seconds
    })
  ),
  iconNames: z.array(z.string()).default(["Zap"]),
  audioCueTimeline: z
    .array(
      z.object({
        timeMs: z.number(),
        cueType: z.enum(["voice", "music", "sfx"]),
        iconName: z.string().optional(),
        word: z.string().optional(),
        note: z.string().optional(),
      })
    )
    .default([]),
  hookText: z.string(),
  ctaKeyword: z.string(),
});

export type PremiumShortCompositionProps = z.infer<
  typeof PremiumShortCompositionSchema
>;

// ═════════════════════════════════════════════════════════════════════════════
// HARD FRAME CONSTRAINTS — Immutable production constants
// ═════════════════════════════════════════════════════════════════════════════
const FPS = 30;
const TOTAL_FRAMES = 450; // 15 seconds @ 30fps
const CANVAS_W = 1080;
const CANVAS_H = 1920;

// Phase boundaries (frames)
const HOOK_END = 90;      // 0–3s
const DEMO_START = 90;    // 3s
const DEMO_END = 330;     // 11s
const CTA_START = 330;    // 11s
const CTA_END = 450;      // 15s

// Spring configs
const SPRING_CONFIG = { damping: 12, mass: 0.5, stiffness: 100 };

// ═════════════════════════════════════════════════════════════════════════════
// PREMIUM SHORT COMPOSITION — Master 15s Template
// ═════════════════════════════════════════════════════════════════════════════
// Timeline:
//   0–3s  (0–90):   Massive text hook. Mockup heavily blurred.
//   3–11s (90–330): Blur vanishes. Camera macro-zooms on inferred app solution.
//   11–15s(330–450):Mockup fades. Billboard CTA overlay.
// ═════════════════════════════════════════════════════════════════════════════

export const PremiumShortComposition: React.FC<
  PremiumShortCompositionProps
> = ({
  voiceoverUrl,
  timestamps,
  iconNames,
  audioCueTimeline,
  hookText,
  ctaKeyword,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ═══════════════════════════════════════════════════════════════════════════
  // KINETIC CAMERA DRIFT — Continuous subtle motion (never static)
  // ═══════════════════════════════════════════════════════════════════════════
  const driftX = interpolate(frame, [0, TOTAL_FRAMES], [-8, 8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const driftY = interpolate(frame, [0, TOTAL_FRAMES], [-4, 4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const driftScale = interpolate(frame, [0, TOTAL_FRAMES], [1, 1.03], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Icon-cue triggered scale spikes
  const cueSpikes = audioCueTimeline
    .filter((cue) => cue.cueType === "voice")
    .map((cue) => {
      const cueFrame = Math.round((cue.timeMs / 1000) * fps);
      const spikeProgress = spring({
        frame: frame - cueFrame,
        fps,
        config: SPRING_CONFIG,
      });
      return interpolate(spikeProgress, [0, 1], [0.04, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    });
  const totalCueSpike = cueSpikes.reduce((sum, s) => sum + s, 0);
  // Verbal transition shakes
  const transitionShakes = timestamps.slice(1).map((ts, i) => {
    const transitionFrame = Math.round(timestamps[i + 1].start * fps);
    const shakeProgress = spring({
      frame: frame - transitionFrame,
      fps,
      config: SPRING_CONFIG,
    });
    return interpolate(shakeProgress, [0, 1], [6, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  });
  const totalShakeX = transitionShakes.reduce((sum, s) => sum + s, 0);
  const totalShakeY = transitionShakes.reduce((sum, s) => sum + s * 0.6, 0);

  const finalScale = driftScale + totalCueSpike;
  const finalTranslateX = driftX + totalShakeX;
  const finalTranslateY = driftY + totalShakeY;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brandTheme.colors.background,
        overflow: "hidden",
        width: CANVAS_W,
        height: CANVAS_H,
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
      {/* Layer 1 — Kinetic Camera + Icon Stage                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: `translate(${finalTranslateX}px, ${finalTranslateY}px) scale(${finalScale})`,
          transformOrigin: "center center",
          willChange: "transform",
        }}
      >
        <IconStage
          iconNames={iconNames}
          audioCueTimeline={audioCueTimeline as IconCue[]}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Layer 2 — Word-by-Word Pop Subtitles (dead center)                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <WordPopSubtitles
        timestamps={timestamps as TimestampWord[]}
        hookText={hookText}
      />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Layer 4 — CTA Billboard Overlay (frames 330–450)                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {frame >= CTA_START && <CTABillboard ctaKeyword={ctaKeyword} />}
    </AbsoluteFill>
  );
};
