import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { brandTheme } from "../theme";

export interface TimestampWord {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

interface WordPopSubtitlesProps {
  timestamps: TimestampWord[];
  hookText: string;
}

const WORDS_PER_GROUP = 3;

export const WordPopSubtitles: React.FC<WordPopSubtitlesProps> = ({
  timestamps,
  hookText,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const currentTime = frame / fps;

  // ── Group words into 1-3 word clusters ────────────────────────────────────
  const wordGroups = useMemo(() => {
    const groups: Array<{
      words: string[];
      start: number;
      end: number;
      index: number;
    }> = [];

    for (let i = 0; i < timestamps.length; i += WORDS_PER_GROUP) {
      const groupWords = timestamps.slice(i, i + WORDS_PER_GROUP);
      groups.push({
        words: groupWords.map((w) => w.word),
        start: groupWords[0].start,
        end: groupWords[groupWords.length - 1].end,
        index: Math.floor(i / WORDS_PER_GROUP),
      });
    }

    return groups;
  }, [timestamps]);

  // ── Determine active group ────────────────────────────────────────────────
  const activeGroupIndex = useMemo(() => {
    return wordGroups.findIndex(
      (g) => currentTime >= g.start && currentTime <= g.end
    );
  }, [wordGroups, currentTime]);

  // ── Hook text visibility (frames 0-90) ────────────────────────────────────
  const hookOpacity = interpolate(frame, [0, 15, 75, 90], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fontSize = Math.max(28, Math.min(64, height * 0.045));

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: width * 0.9,
        textAlign: "center",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      {/* Hook Text Phase (0-3s) */}
      {frame <= 90 && (
        <div
          style={{
            opacity: hookOpacity,
            fontFamily: brandTheme.fonts.sans,
            fontSize: fontSize * 1.2,
            fontWeight: 800,
            color: brandTheme.colors.highlight,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            lineHeight: 1.2,
            textShadow: `0 2px 20px ${brandTheme.colors.background}88`,
          }}
        >
          {hookText}
        </div>
      )}

      {/* Word Pop Groups (3s-11s) */}
      {frame > 60 &&
        wordGroups.map((group, groupIdx) => {
          const isActive = groupIdx === activeGroupIndex;
          const hasPassed = groupIdx < activeGroupIndex;
          const isFuture = groupIdx > activeGroupIndex;

          // Entrance spring for each group
          const groupStartFrame = Math.round(group.start * fps);
          const entranceProgress = spring({
            frame: frame - groupStartFrame,
            fps,
            config: { damping: 14, mass: 0.6, stiffness: 180 },
          });

          const groupScale = interpolate(
            entranceProgress,
            [0, 1],
            [0.7, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          const groupOpacity = interpolate(
            entranceProgress,
            [0, 1],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          // Fade out after passing
          const exitProgress =
            hasPassed && activeGroupIndex >= 0
              ? interpolate(
                  frame,
                  [
                    Math.round(group.end * fps),
                    Math.round(group.end * fps) + 10,
                  ],
                  [1, 0],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                )
              : 1;

          if (isFuture) return null;

          return (
            <div
              key={`group-${groupIdx}`}
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "center",
                gap: `${fontSize * 0.3}px`,
                marginBottom: `${fontSize * 0.5}px`,
                opacity: groupOpacity * exitProgress,
                transform: `scale(${groupScale})`,
                transformOrigin: "center center",
              }}
            >
              {group.words.map((word, wordIdx) => {
                // Within active group, highlight the currently spoken word
                const wordInGroupActive =
                  isActive &&
                  timestamps.findIndex((t) => t.word === word) ===
                    activeGroupIndex * WORDS_PER_GROUP + wordIdx;

                const wordTimestamp = timestamps.find((t) => t.word === word);
                const isWordCurrentlyActive =
                  wordTimestamp &&
                  currentTime >= wordTimestamp.start &&
                  currentTime <= wordTimestamp.end;

                return (
                  <span
                    key={`word-${groupIdx}-${wordIdx}`}
                    style={{
                      fontFamily: brandTheme.fonts.sans,
                      fontSize,
                      fontWeight: 800,
                      color: isWordCurrentlyActive
                        ? brandTheme.colors.highlight
                        : isActive
                        ? brandTheme.colors.accentText
                        : brandTheme.colors.accentText + "99",
                      textTransform: "uppercase",
                      letterSpacing: "0.02em",
                      lineHeight: 1.3,
                      textRendering: "optimizeLegibility",
                      userSelect: "none",
                      transition: "color 0.05s ease",
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          );
        })}
    </div>
  );
};
