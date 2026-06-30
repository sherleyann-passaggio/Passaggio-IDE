// remotion-video/src/components/Watermark.tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../theme';

interface WatermarkProps {
  text: string;
  width: number;
  height: number;
}

export const Watermark: React.FC<WatermarkProps> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  // Anti-piracy position matrix: shifts every 4 seconds to prevent cropping
  const positions = [
    { top: 40, left: 40 },
    { top: 40, right: 40 },
    { bottom: 160, left: 40 },  // Keep above the captions overlay
    { bottom: 160, right: 40 }
  ];

  const currentPositionIndex = Math.floor(currentTime / 4) % positions.length;
  const activePosition = positions[currentPositionIndex];

  return (
    <div
      style={{
        position: 'absolute',
        ...activePosition,
        opacity: 0.25,
        color: tokens.colors.textPrimary,
        fontSize: '18px',
        fontFamily: tokens.typography.mono,
        letterSpacing: '1px',
        backgroundColor: tokens.colors.watermarkBg,
        padding: '6px 12px',
        borderRadius: '6px',
        pointerEvents: 'none',
        transition: 'all 0.5s ease-in-out', // Fluid motion when switching corners
        zIndex: 1000
      }}
    >
      INTERNAL AUDIT STREAM // USER: {text || "anonymous@local"}
    </div>
  );
};