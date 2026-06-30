import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import * as LucideIcons from "lucide-react";
import { brandTheme } from "../theme";

export interface IconCue {
  timeMs: number;
  cueType: "voice" | "music" | "sfx";
  iconName?: string;
  word?: string;
  note?: string;
}

interface IconStageProps {
  iconNames: string[];
  audioCueTimeline: IconCue[];
}

const ICON_SIZE = 160;
const MOTION_SPRING = { damping: 12, mass: 0.5, stiffness: 100 };

export const IconStage: React.FC<IconStageProps> = ({
  iconNames,
  audioCueTimeline,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  // Find the most recent voice cue with an icon
  const activeCue = [...audioCueTimeline]
    .reverse()
    .find(
      (cue) =>
        cue.cueType === "voice" &&
        cue.timeMs <= currentTimeMs &&
        cue.iconName
    );

  const activeIconName = activeCue?.iconName || iconNames[0] || "Zap";
  const IconComponent = (LucideIcons[activeIconName as keyof typeof LucideIcons] ||
    LucideIcons.Zap) as React.FC<React.SVGProps<SVGSVGElement>>;

  // Entrance spring
  const progress = spring({
    frame: Math.max(0, frame),
    fps,
    config: MOTION_SPRING,
  });

  const scale = interpolate(progress, [0, 1], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtle continuous rotation
  const rotation = interpolate(frame, [0, fps * 15], [0, 8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      <div
        style={{
          width: ICON_SIZE,
          height: ICON_SIZE,
          transform: `scale(${scale}) rotate(${rotation}deg)`,
          opacity,
          filter: `drop-shadow(0 0 40px ${brandTheme.colors.highlight}66)`,
        }}
      >
        <IconComponent
          width={ICON_SIZE}
          height={ICON_SIZE}
          color={brandTheme.colors.accentText}
          strokeWidth={1.2}
        />
      </div>
    </div>
  );
};

export default IconStage;
