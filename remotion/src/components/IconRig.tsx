import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import * as LucideIcons from "lucide-react";
import { brandTheme } from "../theme";

export type IconMotion = "pop" | "spin" | "bounce" | "draw" | "wipe" | "none";

export interface IconRigProps {
  /** A valid lucide-react icon export name, e.g. "Shield", "Zap", "Inbox" */
  iconName: keyof typeof LucideIcons;
  /** Size in pixels. Defaults to 96. */
  size?: number;
  /** Stroke color. Defaults to brandTheme.colors.accentText */
  color?: string;
  /** Stroke width. Defaults to 2 */
  strokeWidth?: number;
  /** Motion preset. Defaults to "pop" */
  motion?: IconMotion;
  /** Frame at which the animation completes. Defaults to 15 */
  enterFrame?: number;
  /** Optional wrapper style */
  style?: React.CSSProperties;
  /** Optional className for the wrapper */
  className?: string;
}

const MOTION_SPRING = { damping: 12, mass: 0.5, stiffness: 100 };

export const IconRig: React.FC<IconRigProps> = ({
  iconName,
  size = 96,
  color = brandTheme.colors.accentText,
  strokeWidth = 2,
  motion = "pop",
  enterFrame = 15,
  style,
  className,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const IconComponent = LucideIcons[iconName] as React.FC<
    Omit<LucideIcons.LucideProps, "ref">
  >;

  if (!IconComponent) {
    console.warn(`IconRig: "${iconName}" is not a valid lucide-react icon.`);
    return null;
  }

  const progress = spring({
    frame: Math.max(0, frame),
    fps,
    config: MOTION_SPRING,
  });

  const clampedProgress = interpolate(
    frame,
    [0, enterFrame],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: size,
    height: size,
    ...style,
  };

  let motionStyle: React.CSSProperties = {};

  switch (motion) {
    case "pop":
      motionStyle = {
        transform: `scale(${interpolate(clampedProgress, [0, 1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })})`,
        opacity: clampedProgress,
      };
      break;

    case "spin":
      motionStyle = {
        transform: `rotate(${interpolate(clampedProgress, [0, 1], [-180, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}deg) scale(${interpolate(clampedProgress, [0, 1], [0.5, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })})`,
        opacity: clampedProgress,
      };
      break;

    case "bounce":
      motionStyle = {
        transform: `translateY(${interpolate(
          progress,
          [0, 0.4, 0.7, 1],
          [size * 0.5, -size * 0.15, size * 0.08, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        )}px) scale(${interpolate(progress, [0, 0.5, 1], [0.5, 1.1, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })})`,
        opacity: clampedProgress,
      };
      break;

    case "wipe":
      motionStyle = {
        clipPath: `inset(0 ${100 - clampedProgress * 100}% 0 0)`,
        opacity: 1,
      };
      break;

    case "draw":
      motionStyle = {
        opacity: clampedProgress,
        strokeDasharray: 1000,
        strokeDashoffset: interpolate(
          clampedProgress,
          [0, 1],
          [1000, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        ),
      };
      break;

    case "none":
    default:
      motionStyle = {};
  }

  return (
    <div className={className} style={baseStyle}>
      <div style={{ width: size, height: size, ...motionStyle }}>
        <IconComponent
          size={size}
          color={color}
          strokeWidth={strokeWidth}
          style={{ display: "block" }}
        />
      </div>
    </div>
  );
};

export default IconRig;
