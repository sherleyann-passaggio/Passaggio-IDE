import React from "react";
import { brandTheme } from "../theme";

interface MockupRigProps {
  appScreenshot: string | React.ReactNode;
  cursorX: number;
  cursorY: number;
  blurAmount: number;
  brightness: number;
  opacity: number;
}

export const MockupRig: React.FC<MockupRigProps> = ({
  appScreenshot,
  cursorX,
  cursorY,
  blurAmount,
  brightness,
  opacity,
}) => {
  // ── Anticipation: check if cursor is within 5% proximity ──────────────────
  // Mockup is centered at 50%, 45% with size ~80% x 70%
  const mockupCenterX = 50;
  const mockupCenterY = 45;
  const proximityThreshold = 5;

  const isCursorNear =
    Math.abs(cursorX - mockupCenterX) < proximityThreshold &&
    Math.abs(cursorY - mockupCenterY) < proximityThreshold;

  const hoverGlow = isCursorNear
    ? `0 0 40px ${brandTheme.colors.highlight}44, 0 20px 60px rgba(0,0,0,0.6)`
    : `0 20px 60px rgba(0,0,0,0.5)`;

  const hoverScale = isCursorNear ? 1.02 : 1;

  const isImage = typeof appScreenshot === "string";

  return (
    <div
      style={{
        position: "absolute",
        top: "10%",
        left: "10%",
        width: "80%",
        height: "70%",
        borderRadius: "16px",
        overflow: "hidden",
        border: `1px solid ${brandTheme.colors.surface}`,
        boxShadow: hoverGlow,
        filter: `blur(${blurAmount}px) brightness(${brightness})`,
        opacity,
        transform: `scale(${hoverScale})`,
        transformOrigin: "center center",
        transition: "box-shadow 0.15s ease, transform 0.15s ease",
        backgroundColor: brandTheme.colors.surface,
        zIndex: 10,
      }}
    >
      {isImage ? (
        <img
          src={appScreenshot as string}
          alt="App Screenshot"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <div style={{ width: "100%", height: "100%" }}>
          {appScreenshot as React.ReactNode}
        </div>
      )}
    </div>
  );
};
