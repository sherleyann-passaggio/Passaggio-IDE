import { useMemo } from "react";

export interface ClickEvent {
  targetX: number;
  targetY: number;
  triggerMs: number;
}

export const useCursorPosition = (
  clickSchedule: ClickEvent[],
  fps: number,
  frame: number
) => {
  const currentTimeMs = (frame / fps) * 1000;

  return useMemo(() => {
    if (clickSchedule.length === 0) {
      return { x: 50, y: 50 };
    }

    // Find the current active movement segment (same logic as VirtualCursorRig)
    const currentTargetIndex = clickSchedule.findIndex(
      (t) => currentTimeMs < t.triggerMs
    );
    const activeIndex =
      currentTargetIndex === -1 ? clickSchedule.length - 1 : currentTargetIndex;

    const startNode =
      activeIndex === 0
        ? { targetX: 50, targetY: 50, triggerMs: 0 }
        : clickSchedule[activeIndex - 1];
    const endNode = clickSchedule[activeIndex];

    // Clamp time to segment bounds
    const clampedTime = Math.max(
      startNode.triggerMs,
      Math.min(currentTimeMs, endNode.triggerMs)
    );

    // Linear interpolation between nodes
    const t =
      endNode.triggerMs === startNode.triggerMs
        ? 0
        : (clampedTime - startNode.triggerMs) /
          (endNode.triggerMs - startNode.triggerMs);

    const x = startNode.targetX + (endNode.targetX - startNode.targetX) * t;
    const y = startNode.targetY + (endNode.targetY - startNode.targetY) * t;

    return { x, y };
  }, [clickSchedule, currentTimeMs]);
};
