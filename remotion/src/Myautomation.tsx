import { AbsoluteFill, Audio, Video, useVideoConfig } from 'remotion';
import { Lottie } from '@remotion/lottie';
import { useEffect, useState } from 'react';
import { AutomationTimeline } from './types';

// This data comes straight from your LLM/Transcription script pipeline
const aiGeneratedData: AutomationTimeline = {
  audioUrl: "https://example.com",
  videoUrl: "https://example.com",
  overlays: [
    {
      text: "Look at this upward trend!",
      lottieAssetPath: "projects/line-graph/scene-1/lottie.json", // Created by diffusionstudio/lottie
      startFromSecond: 5,
      durationInSeconds: 4
    }
  ]
};

export const MyAutomation = () => {
  const { fps } = useVideoConfig();
  const [lottieData, setLottieData] = useState<Record<string, any>>({});

  // Pre-load the AI-generated Lottie files into memory
  useEffect(() => {
    aiGeneratedData.overlays.forEach(async (overlay) => {
      const response = await fetch(`/${overlay.lottieAssetPath}`);
      const json = await response.json();
      setLottieData(prev => ({ ...prev, [overlay.lottieAssetPath]: json }));
    });
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {/* 1. Main Background Media */}
      <Video src={aiGeneratedData.videoUrl} />
      <Audio src={aiGeneratedData.audioUrl} />

      {/* 2. Programmatic AI B-Roll / Graph Layer */}
      {aiGeneratedData.overlays.map((item, index) => {
        const startFrame = item.startFromSecond * fps;
        const durationFrames = item.durationInSeconds * fps;
        const currentAnimation = lottieData[item.lottieAssetPath];

        if (!currentAnimation) return null;

        return (
          <AbsoluteFill 
            key={index}
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: startFrame ? 1 : 0 // Controlled via your sequence rendering logic
            }}
          >
            {/* Render the Lottie graph if inside the timestamp window */}
            <div style={{ width: 500, height: 500 }}>
              <Lottie animationData={currentAnimation} />
            </div>
            
            {/* Contextual Subtitle Overlay */}
            <h1 style={{ position: 'absolute', bottom: 100, color: 'white', fontFamily: 'sans-serif' }}>
              {item.text}
            </h1>
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};
