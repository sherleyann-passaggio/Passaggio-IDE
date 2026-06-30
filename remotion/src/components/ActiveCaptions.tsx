// workspace-video/remotion-video/src/ActiveCaptions.tsx
import React, { useMemo } from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { tokens } from "../theme";

// 1. Define what properties this component expects to receive
export interface ActiveCaptionsProps {
  currentFrame: number; // Note: In MyComposition, you passed currentTime into this prop
  captions: Array<{
    text: string;
    start: number;
    end: number;
    highlight_words?: string[];
  }>;
  activeCaptionIndex: number;
  fps: number;
  frame: number;
  width: number;
  height: number;
}

// 2. Assign the interface to your component
export const ActiveCaptions: React.FC<ActiveCaptionsProps> = ({
  currentFrame,
  captions,
  activeCaptionIndex,
  fps,
  frame,
  width,
  height,
}) => {
  if (activeCaptionIndex === -1 || !captions[activeCaptionIndex]) {
    return null;
  }

  const caption = captions[activeCaptionIndex];
  const words = useMemo(() => caption.text.split(/\s+/).filter(Boolean), [caption.text]);
  const captionDuration = caption.end - caption.start;
  const wordDuration = captionDuration / Math.max(words.length, 1);

  // Using the renamed currentFrame prop here for calculation
  const elapsedInCaption = currentFrame - caption.start;
  const rawIndex = Math.floor(elapsedInCaption / wordDuration);
  const activeWordIndex = Math.max(0, Math.min(rawIndex, words.length - 1));

  // Global opacity envelope over the caption window
  const opacity = interpolate(
    frame,
    [
      caption.start * fps,
      caption.start * fps + 6,
      caption.end * fps - 6,
      caption.end * fps,
    ],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const fontSize = Math.max(20, Math.min(56, height * 0.042));

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: height * 0.06,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: `${fontSize * 0.35}px`,
          maxWidth: width * 0.88,
          opacity,
          textShadow: tokens.shadows.caption,
        }}
      >
        {words.map((word, idx) => {
          const isActive = idx === activeWordIndex;
          return (
            <span
              key={`cw-${activeCaptionIndex}-${idx}-${word}`}
              style={{
                fontFamily:
                  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize,
                fontWeight: isActive ? 800 : 500,
                color: isActive ? tokens.colors.primary : tokens.colors.textPrimary,
                letterSpacing: "0.02em",
                lineHeight: 1.35,
                textRendering: "optimizeLegibility",
                userSelect: "none",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};