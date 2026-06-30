import React from "react";
import { Composition } from "remotion";
import { MyComposition, MyCompositionSchema } from "./components/MyComposition";
import { TitleOverlay, TitleOverlaySchema } from "./components/TitleOverlay";
import {
  KineticSaaSShort,
  KineticSaaSShortSchema,
} from "./components/KineticSaaSShort";
import {
  PremiumShortComposition,
  PremiumShortCompositionSchema,
} from "./PremiumShortComposition";

export const Root: React.FC = () => {
  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Composition 1: TitleOverlay — Brand validation still frame          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Composition
        id="TitleOverlay"
        component={TitleOverlay}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        schema={TitleOverlaySchema}
        defaultProps={{
          title: "Passaggio",
          subtitle: "Auto-Branded Marketing Videos",
        }}
      />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Composition 2: MyComposition — Legacy timed coordinate frame map    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Composition
        id="MyComposition"
        component={MyComposition}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
        schema={MyCompositionSchema}
        defaultProps={{
          fps: 30,
          width: 1920,
          height: 1080,
          rawVideoUrl: "./audio/voiceover.mp3",
          captions: [
            {
              text: "Welcome to the Sovereign Studio Engine",
              start: 0,
              end: 3,
              highlight_words: ["Sovereign", "Studio"],
            },
          ],
          keyframes: [{ time: 1.5, label: "intro" }],
          suggestedGraphs: [
            { type: "bar", xLabel: "Engagement", yLabel: "Score" },
          ],
          brollSlots: [],
          watermarkText: "INTERNAL AUDIT STREAM",
          durationInFrames: 300,
        }}
      />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Composition 3: KineticSaaSShort — Legacy kinetic short (backward compat) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Composition
        id="KineticSaaSShort"
        component={KineticSaaSShort}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
        schema={KineticSaaSShortSchema}
        defaultProps={{
          voiceoverUrl: "./audio/voiceover.mp3",
          timestamps: [
            { word: "THIS", start: 0.0, end: 0.3 },
            { word: "IS", start: 0.3, end: 0.5 },
            { word: "HOW", start: 0.5, end: 0.8 },
            { word: "YOU", start: 0.8, end: 1.0 },
            { word: "DEPLOY", start: 1.0, end: 1.4 },
            { word: "IN", start: 1.4, end: 1.6 },
            { word: "24", start: 1.6, end: 2.0 },
            { word: "HOURS", start: 2.0, end: 2.5 },
            { word: "NOT", start: 3.0, end: 3.3 },
            { word: "MONTHS", start: 3.3, end: 3.8 },
            { word: "ONE", start: 4.5, end: 4.8 },
            { word: "CLICK", start: 4.8, end: 5.2 },
            { word: "ONE", start: 5.5, end: 5.8 },
            { word: "DEPLOYMENT", start: 5.8, end: 6.3 },
            { word: "DONE", start: 6.5, end: 7.0 },
          ],
          appScreenshot: "./media/app-screenshot.png",
          hookText: "DEPLOY IN 24 HOURS",
          ctaKeyword: "DEPLOY",
          clickSchedule: [
            { targetX: 30, targetY: 40, triggerMs: 1500 },
            { targetX: 70, targetY: 60, triggerMs: 3500 },
            { targetX: 50, targetY: 80, triggerMs: 5500 },
          ],
        }}
      />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Composition 4: PremiumShortComposition — MASTER 15s TEMPLATE        */}
      {/* The canonical composition driving the CCP v3.0 icon-driven loop.    */}
      {/* All 9 app episodes are instances of this single component.          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Composition
        id="PremiumShortComposition"
        component={PremiumShortComposition}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
        schema={PremiumShortCompositionSchema}
        defaultProps={{
          voiceoverUrl: "./audio/voiceover.mp3",
          timestamps: [
            { word: "STILL", start: 0.0, end: 0.4 },
            { word: "TRACKING", start: 0.4, end: 0.9 },
            { word: "BACKGROUND", start: 0.9, end: 1.4 },
            { word: "CHECKS", start: 1.4, end: 1.8 },
            { word: "MANUALLY", start: 1.8, end: 2.4 },
            { word: "ONE", start: 3.0, end: 3.3 },
            { word: "CLICK", start: 3.3, end: 3.7 },
            { word: "VERIFIED", start: 3.7, end: 4.2 },
            { word: "SAFE", start: 4.2, end: 4.6 },
            { word: "DEPLOY", start: 5.0, end: 5.5 },
            { word: "IN", start: 5.5, end: 5.7 },
            { word: "24", start: 5.7, end: 6.0 },
            { word: "HOURS", start: 6.0, end: 6.5 },
          ],
          iconNames: ["Shield", "CheckCircle", "MousePointerClick"],
          audioCueTimeline: [
            { timeMs: 0, cueType: "music", note: "intro bed" },
            { timeMs: 0, cueType: "voice", word: "STILL", iconName: "Shield" },
            { timeMs: 3000, cueType: "voice", word: "ONE", iconName: "MousePointerClick" },
            { timeMs: 5000, cueType: "sfx", note: "cta punch" },
          ],
          hookText: "STOP TRACKING CHECKS MANUALLY",
          ctaKeyword: "SAFE",
        }}
      />
    </>
  );
};
