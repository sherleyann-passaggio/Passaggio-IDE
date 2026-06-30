// ─────────────────────────────────────────────────────────────────────────────
// MyComposition.tsx
// React / Remotion Composition — Timed Coordinate Frame Map for Active Layers
// ─────────────────────────────────────────────────────────────────────────────
// Receives the unified props bridge written by workspace-video/backend/app.py
// (temp_props.json). Dynamically toggles visibility for B-roll PiP slots,
// SVG graph overlays, word-level captions, and anti-screen-recording watermarks
// based on absolute frame-by-frame evaluation against caption windows and
// keyframe triggers.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
} from "remotion";
import { z } from "zod";
import { tokens } from "../theme";

import { ActiveCaptions } from "./ActiveCaptions";
import { AnimatedGraph } from "./AnimatedGraph";
import { Watermark } from "./Watermark";

// ═════════════════════════════════════════════════════════════════════════════
// Zod schema — MUST stay aligned with Python backend payload (temp_props.json)
// ═════════════════════════════════════════════════════════════════════════════
export const MyCompositionSchema = z.object({
  fps: z.number().default(30),
  width: z.number().default(1080),
  height: z.number().default(1920),
  rawVideoUrl: z.string(),
  captions: z
    .array(
      z.object({
        text: z.string(),
        start: z.number(),
        end: z.number(),
        highlight_words: z.array(z.string()).optional().default([]),
      })
    )
    .default([]),
  keyframes: z
    .array(
      z.object({
        time: z.number(),
        label: z.string(),
      })
    )
    .default([]),
  suggestedGraphs: z
    .array(
      z.object({
        type: z.string(),
        xLabel: z.string(),
        yLabel: z.string(),
      })
    )
    .default([]),
  brollSlots: z.array(z.string()).default([]),
  watermarkText: z.string().optional(),
  durationInFrames: z.number(),
});

export type MyCompositionProps = z.infer<typeof MyCompositionSchema>;

// ═════════════════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════════════════
export const MyComposition: React.FC<MyCompositionProps> = ({
  fps,
  width,
  height,
  rawVideoUrl,
  captions,
  keyframes,
  suggestedGraphs,
  brollSlots,
  watermarkText,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const currentTime = frame / fps;

  // ── Active caption index ───────────────────────────────────────────────────
  const activeCaptionIndex = useMemo(() => {
    return captions.findIndex((c) => currentTime >= c.start && currentTime <= c.end);
  }, [captions, currentTime]);

  // ── Keyframe → graph pairings (one graph per keyframe, modulo array length)
  const activeKeyframeIndex = useMemo(() => {
    return keyframes.findIndex((k) => {
      const winStart = k.time - 1.0; // 1s pre-roll for entrance
      const winEnd = k.time + 6.0; // 6s hold window
      return currentTime >= winStart && currentTime <= winEnd;
    });
  }, [keyframes, currentTime]);

  const graphVisible = activeKeyframeIndex !== -1 && suggestedGraphs.length > 0;

  // ── B-roll visibility windows (keyframe-triggered or evenly distributed fallback)
  const brollWindows = useMemo(() => {
    const windows: Array<{
      slot: string;
      kfLabel: string;
      from: number;
      duration: number;
      size: { w: number; h: number };
    }> = [];

    const slotsCount = Math.max(brollSlots.length, 1);
    const pipW = Math.floor(width * 0.26);
    const pipH = Math.floor(height * 0.26);

    if (keyframes.length > 0) {
      keyframes.forEach((kf, idx) => {
        const slot = brollSlots[idx % slotsCount];
        if (!slot) return;
        const fromFrame = Math.max(0, Math.floor((kf.time - 0.5) * fps));
        const toFrame = Math.min(
          durationInFrames,
          Math.ceil((kf.time + 4.5) * fps)
        );
        windows.push({
          slot,
          kfLabel: kf.label,
          from: fromFrame,
          duration: Math.max(1, toFrame - fromFrame),
          size: { w: pipW, h: pipH },
        });
      });
    } else if (brollSlots.length > 0) {
      // Even distribution fallback when no keyframes are supplied
      const slotDuration = Math.floor(durationInFrames / brollSlots.length);
      brollSlots.forEach((slot, idx) => {
        windows.push({
          slot,
          kfLabel: `segment-${idx}`,
          from: idx * slotDuration,
          duration: Math.max(1, slotDuration),
          size: { w: pipW, h: pipH },
        });
      });
    }

    return windows;
  }, [keyframes, brollSlots, fps, durationInFrames, width, height]);

  // ── Exit render ────────────────────────────────────────────────────────────
  return (
    <AbsoluteFill style={{ width, height, backgroundColor: tokens.colors.surface }}>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Layer 0 — Base talking-head footage (full-bleed)                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AbsoluteFill>
        <OffthreadVideo
          src={rawVideoUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          // Mute base audio if you prefer to composite custom audio tracks;
          // leave un-propped to pass through native audio automatically.
        />
      </AbsoluteFill>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Layer 1 — B-roll PiP overlays (dynamic visibility)               */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {brollWindows.map((bw, idx) => (
        <Sequence
          key={`broll-${idx}-${bw.kfLabel}`}
          from={bw.from}
          durationInFrames={bw.duration}
        >
          <div
            style={{
              position: "absolute",
              right: 56,
              bottom: 160, // elevated above caption safe-zone
              width: bw.size.w,
              height: bw.size.h,
              borderRadius: 10,
              overflow: "hidden",
              border: `2px solid ${tokens.colors.panelBorder}`,
              boxShadow: tokens.shadows.broll,
            }}
          >
            <OffthreadVideo
              src={bw.slot}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        </Sequence>
      ))}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Layer 2 — Animated SVG spring graph (keyframe-timed)            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {graphVisible && (
        <Sequence
          from={Math.max(
            0,
            Math.floor((keyframes[activeKeyframeIndex].time - 1.0) * fps)
          )}
          durationInFrames={Math.ceil(7.0 * fps)}
        >
          <AnimatedGraph
            spec={suggestedGraphs[activeKeyframeIndex % suggestedGraphs.length]}
            width={width}
            height={height}
            enterProgress={interpolate(
              frame,
              [
                Math.floor((keyframes[activeKeyframeIndex].time - 1.0) * fps),
                Math.floor(keyframes[activeKeyframeIndex].time * fps),
              ],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            )}
          />
        </Sequence>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Layer 3 — Active Captions (word-level timed highlight)           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <ActiveCaptions
        currentFrame={currentTime}
        captions={captions}
        activeCaptionIndex={activeCaptionIndex}
        fps={fps}
        frame={frame}
        width={width}
        height={height}
      />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Layer 4 — Anti-screen-recording watermark overlay               */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Watermark
        text={watermarkText || "Sovereign Studio"}
        width={width}
        height={height}
      />
    </AbsoluteFill>
  );
};
