import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { ClickEvent } from "../hooks/useCursorPosition";

interface KineticCameraProps {
  children: React.ReactNode;
  clickSchedule: ClickEvent[];
  timestamps: Array<{ word: string; start: number; end: number }>;
}

const SPRING_CONFIG = {
  damping: 12,
  mass: 0.5,
  stiffness: 100,
};

export const KineticCamera: React.FC<KineticCameraProps> = ({
  children,
  clickSchedule,
  timestamps,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  // ── Continuous subtle drift ────────────────────────────────────────────────
  const driftX = interpolate(frame, [0, 450], [-8, 8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const driftY = interpolate(frame, [0, 450], [-4, 4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const driftScale = interpolate(frame, [0, 450], [1, 1.03], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Detect click triggers for scale spikes ────────────────────────────────
  const clickSpikes = useMemo(() => {
    return clickSchedule.map((click) => {
      const clickFrame = Math.round((click.triggerMs / 1000) * fps);
      const spikeProgress = spring({
        frame: frame - clickFrame,
        fps,
        config: SPRING_CONFIG,
      });
      return interpolate(spikeProgress, [0, 1], [0.05, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    });
  }, [clickSchedule, frame, fps]);

  const totalClickSpike = clickSpikes.reduce((sum, s) => sum + s, 0);

  // ── Detect verbal transition triggers for shake ───────────────────────────
  const transitionShakes = useMemo(() => {
    if (timestamps.length < 2) return [];
    const shakes: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      const transitionFrame = Math.round(timestamps[i].start * fps);
      const shakeProgress = spring({
        frame: frame - transitionFrame,
        fps,
        config: SPRING_CONFIG,
      });
      shakes.push(
        interpolate(shakeProgress, [0, 1], [6, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      );
    }
    return shakes;
  }, [timestamps, frame, fps]);

  const totalShakeX = transitionShakes.reduce((sum, s) => sum + s, 0);
  const totalShakeY = transitionShakes.reduce(
    (sum, s) => sum + s * 0.6,
    0
  ); // Slightly less vertical shake

  // ── Compose final transform ───────────────────────────────────────────────
  const finalScale = driftScale + totalClickSpike;
  const finalTranslateX = driftX + totalShakeX;
  const finalTranslateY = driftY + totalShakeY;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        transform: `translate(${finalTranslateX}px, ${finalTranslateY}px) scale(${finalScale})`,
        transformOrigin: "center center",
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
};
