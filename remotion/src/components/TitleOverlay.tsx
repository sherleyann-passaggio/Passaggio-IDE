// ─────────────────────────────────────────────────────────────────────────────
// TitleOverlay.tsx
// Simple 5-second brand validation composition
// Displays centered title using primary brand color and display typography
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { tokens } from "../theme";

export const TitleOverlaySchema = z.object({
  title: z.string().default("Passaggio"),
  subtitle: z.string().default("Auto-Branded Marketing Videos"),
});

export type TitleOverlayProps = z.infer<typeof TitleOverlaySchema>;

export const TitleOverlay: React.FC<TitleOverlayProps> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring animation for title entrance
  const titleSpring = spring({
    frame,
    fps,
    config: tokens.motion.spring,
  });

  // Fade in subtitle after title
  const subtitleOpacity = interpolate(
    frame,
    [30, 45],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Scale effect
  const scale = interpolate(
    titleSpring,
    [0, 1],
    [0.8, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: tokens.colors.bg,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: tokens.typography.display,
      }}
    >
      {/* Main Title */}
      <div
        style={{
          transform: `scale(${scale})`,
          opacity: titleSpring,
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "80px",
            fontFamily: tokens.typography.display,
            fontWeight: 400,
            color: tokens.colors.primary,
            letterSpacing: "2px",
            margin: 0,
            padding: 0,
            textTransform: "uppercase",
          }}
        >
          {title}
        </h1>
        
        {/* Subtitle */}
        <p
          style={{
            fontSize: "24px",
            fontFamily: tokens.typography.body,
            fontWeight: 400,
            color: tokens.colors.textMuted,
            letterSpacing: "0.32px",
            margin: 0,
            marginTop: tokens.spacingScale.md,
            opacity: subtitleOpacity,
          }}
        >
          {subtitle}
        </p>
      </div>

      {/* Brand Color Indicator */}
      <div
        style={{
          position: "absolute",
          bottom: tokens.spacingScale.xl,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: tokens.spacingScale.sm,
          opacity: subtitleOpacity,
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            backgroundColor: tokens.colors.primary,
            borderRadius: tokens.spacing.roundedMd,
          }}
        />
        <span
          style={{
            fontFamily: tokens.typography.mono,
            fontSize: "14px",
            color: tokens.colors.textMuted,
          }}
        >
          {tokens.colors.primary}
        </span>
      </div>
    </AbsoluteFill>
  );
};