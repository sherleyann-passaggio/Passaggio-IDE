import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { brandTheme } from "../theme";

interface CTABillboardProps {
  ctaKeyword: string;
}

export const CTABillboard: React.FC<CTABillboardProps> = ({ ctaKeyword }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // ── Entrance: pop open at frame 330 ───────────────────────────────────────
  const entranceProgress = spring({
    frame: frame - 330,
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 100 },
  });

  const billboardOpacity = interpolate(
    entranceProgress,
    [0, 1],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const billboardScale = interpolate(
    entranceProgress,
    [0, 1],
    [0.85, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ── Backdrop blur intensity ───────────────────────────────────────────────
  const backdropOpacity = interpolate(
    frame,
    [330, 345],
    [0, 0.7],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const fontSize = Math.max(32, Math.min(72, height * 0.05));

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 100,
        pointerEvents: "none",
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: `${brandTheme.colors.background}${Math.round(
            backdropOpacity * 255
          )
            .toString(16)
            .padStart(2, "0")}`,
          backdropFilter: `blur(${interpolate(
            frame,
            [330, 360],
            [0, 8],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          )}px)`,
        }}
      />

      {/* Billboard Content */}
      <div
        style={{
          position: "relative",
          textAlign: "center",
          padding: `${height * 0.04}px ${width * 0.08}px`,
          opacity: billboardOpacity,
          transform: `scale(${billboardScale})`,
          transformOrigin: "center center",
        }}
      >
        <div
          style={{
            fontFamily: brandTheme.fonts.sans,
            fontSize,
            fontWeight: 800,
            color: brandTheme.colors.accentText,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            lineHeight: 1.25,
            textShadow: `0 4px 30px ${brandTheme.colors.background}CC`,
          }}
        >
          CLICK THE{" "}
          <span style={{ color: brandTheme.colors.highlight }}>LINK</span>
        </div>
        <div
          style={{
            fontFamily: brandTheme.fonts.sans,
            fontSize: fontSize * 0.85,
            fontWeight: 700,
            color: brandTheme.colors.accentText,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            lineHeight: 1.3,
            marginTop: fontSize * 0.3,
            textShadow: `0 4px 30px ${brandTheme.colors.background}CC`,
          }}
        >
          TO DEPLOY IN{" "}
          <span style={{ color: brandTheme.colors.highlight }}>24 HOURS</span>
        </div>

        {/* Keyword badge */}
        {ctaKeyword && (
          <div
            style={{
              marginTop: fontSize * 0.6,
              display: "inline-block",
              padding: `${fontSize * 0.2}px ${fontSize * 0.5}px`,
              borderRadius: "8px",
              border: `2px solid ${brandTheme.colors.highlight}`,
              backgroundColor: `${brandTheme.colors.highlight}22`,
            }}
          >
            <span
              style={{
                fontFamily: brandTheme.fonts.sans,
                fontSize: fontSize * 0.65,
                fontWeight: 700,
                color: brandTheme.colors.highlight,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {ctaKeyword}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
