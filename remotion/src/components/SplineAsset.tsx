// workspace-video/remotion-video/src/components/SplineAsset.tsx
/// <reference path="./declarations.d.ts" />
import React from 'react';

interface SplineProps {
  sceneUrl: string; // The public Spline .splinecode URL
}

export const SplineAsset: React.FC<SplineProps> = ({ sceneUrl }) => {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {/* Serves as your "Unsplash-like" dynamic 3D library container */}
      <spline-viewer 
        url={sceneUrl}
        events-target="global"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};