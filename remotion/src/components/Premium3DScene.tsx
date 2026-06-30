import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { PerspectiveCamera, Icosahedron, TorusKnot, Sphere } from "@react-three/drei";
import { brandTheme } from "../theme";

// ═════════════════════════════════════════════════════════════════════════════
// PREMIUM 3D SCENE — Declarative frame-driven atmospheric layer
// ═════════════════════════════════════════════════════════════════════════════
// RULES:
//   • NO useFrame loops — all motion is deterministic from useCurrentFrame()
//   • All transforms computed via interpolate() for SSR/headless safety
//   • Wrapped by <ThreeCanvas> from @remotion/three (NOT native <Canvas>)
// ═════════════════════════════════════════════════════════════════════════════

const TOTAL_FRAMES = 450;
const HOOK_END = 90;
const CTA_START = 330;

// ── Color tokens from brandTheme (theatrical dark + Baroque gold) ───────────
const GOLD = brandTheme.colors.highlight;      // #E5A93C
const SURFACE = brandTheme.colors.surface;     // #1A1A1A
const BG = brandTheme.colors.background;       // #0D0D0D

interface FloatingMeshProps {
  frame: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  rotSpeedX: number;
  rotSpeedY: number;
  driftAmp: number;
  driftFreq: number;
  scaleBase: number;
  color: string;
  geometry: "icosahedron" | "torusKnot" | "sphere";
}

const FloatingMesh: React.FC<FloatingMeshProps> = ({
  frame,
  baseX,
  baseY,
  baseZ,
  rotSpeedX,
  rotSpeedY,
  driftAmp,
  driftFreq,
  scaleBase,
  color,
  geometry,
}) => {
  // ── Declarative rotation (degrees → radians) ──────────────────────────────
  const rotX = interpolate(frame, [0, TOTAL_FRAMES], [0, 360 * rotSpeedX], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rotY = interpolate(frame, [0, TOTAL_FRAMES], [0, 360 * rotSpeedY], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Declarative orbital drift ─────────────────────────────────────────────
  const driftX = Math.sin((frame / TOTAL_FRAMES) * Math.PI * 2 * driftFreq) * driftAmp;
  const driftY = Math.cos((frame / TOTAL_FRAMES) * Math.PI * 2 * driftFreq) * driftAmp;

  // ── Declarative scale pulse (subtle breathing) ────────────────────────────
  const scalePulse = interpolate(
    frame,
    [0, TOTAL_FRAMES / 2, TOTAL_FRAMES],
    [1, 1.08, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const position: [number, number, number] = [baseX + driftX, baseY + driftY, baseZ];
  const rotation: [number, number, number] = [
    (rotX * Math.PI) / 180,
    (rotY * Math.PI) / 180,
    0,
  ];
  const scale: [number, number, number] = [
    scaleBase * scalePulse,
    scaleBase * scalePulse,
    scaleBase * scalePulse,
  ];

  const materialProps = {
    color,
    roughness: 0.4,
    metalness: 0.6,
    transparent: true,
    opacity: 0.85,
  };

  if (geometry === "icosahedron") {
    return (
      <Icosahedron args={[1, 0]} position={position} rotation={rotation} scale={scale}>
        <meshStandardMaterial {...materialProps} />
      </Icosahedron>
    );
  }

  if (geometry === "torusKnot") {
    return (
      <TorusKnot args={[0.6, 0.2, 128, 16]} position={position} rotation={rotation} scale={scale}>
        <meshStandardMaterial {...materialProps} wireframe />
      </TorusKnot>
    );
  }

  return (
    <Sphere args={[0.8, 32, 32]} position={position} rotation={rotation} scale={scale}>
      <meshStandardMaterial {...materialProps} />
    </Sphere>
  );
};

// ── Scene content (rendered inside ThreeCanvas) ─────────────────────────────
const SceneContent: React.FC = () => {
  const frame = useCurrentFrame();

  // ── Camera orbit: slow cinematic sweep ────────────────────────────────────
  const camOrbitAngle = interpolate(frame, [0, TOTAL_FRAMES], [-15, 15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const camHeight = interpolate(frame, [0, TOTAL_FRAMES], [4, 5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const camZ = interpolate(frame, [0, TOTAL_FRAMES], [10, 8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Phase-based global opacity (subtle fade in/out) ───────────────────────
  const globalOpacity = interpolate(
    frame,
    [0, HOOK_END, CTA_START, TOTAL_FRAMES],
    [0.3, 0.6, 0.6, 0.2],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const cameraPosition: [number, number, number] = [
    Math.sin((camOrbitAngle * Math.PI) / 180) * 6,
    camHeight,
    camZ,
  ];

  return (
    <>
      {/* ── Lighting ──────────────────────────────────────────────────────── */}
      <ambientLight intensity={0.3} color={SURFACE} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        color={GOLD}
        castShadow
      />
      <pointLight position={[-5, 3, -5]} intensity={0.6} color="#ffffff" />

      {/* ── Camera (declarative position, no useFrame) ────────────────────── */}
      <PerspectiveCamera
        makeDefault
        position={cameraPosition}
        fov={45}
        near={0.1}
        far={100}
      />

      {/* ── Floating geometries ───────────────────────────────────────────── */}
      <group>
        {/* Central gold icosahedron */}
        <FloatingMesh
          frame={frame}
          baseX={0}
          baseY={0}
          baseZ={-2}
          rotSpeedX={0.5}
          rotSpeedY={0.3}
          driftAmp={0.5}
          driftFreq={1}
          scaleBase={1.2}
          color={GOLD}
          geometry="icosahedron"
        />

        {/* Wireframe torus knot — orbital */}
        <FloatingMesh
          frame={frame}
          baseX={-3}
          baseY={1.5}
          baseZ={-1}
          rotSpeedX={0.2}
          rotSpeedY={0.8}
          driftAmp={0.8}
          driftFreq={0.7}
          scaleBase={0.9}
          color={SURFACE}
          geometry="torusKnot"
        />

        {/* Secondary sphere — counter-orbit */}
        <FloatingMesh
          frame={frame}
          baseX={3}
          baseY={-1}
          baseZ={-3}
          rotSpeedX={0.6}
          rotSpeedY={0.4}
          driftAmp={0.6}
          driftFreq={1.2}
          scaleBase={0.7}
          color="#2a2a2a"
          geometry="sphere"
        />

        {/* Distant accent sphere */}
        <FloatingMesh
          frame={frame}
          baseX={1.5}
          baseY={2.5}
          baseZ={-5}
          rotSpeedX={0.3}
          rotSpeedY={0.5}
          driftAmp={0.3}
          driftFreq={0.5}
          scaleBase={0.5}
          color={GOLD}
          geometry="sphere"
        />
      </group>

      {/* ── Background plane (theatrical dark) ────────────────────────────── */}
      <mesh position={[0, 0, -8]}>
        <planeGeometry args={[30, 30]} />
        <meshBasicMaterial color={BG} transparent opacity={globalOpacity} />
      </mesh>
    </>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// EXPORT: Headless-safe ThreeCanvas wrapper
// ═════════════════════════════════════════════════════════════════════════════
export const Premium3DScene: React.FC = () => {
  return (
    <ThreeCanvas
      width={1080}
      height={1920}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 1,
        pointerEvents: "none",
      }}
    >
      <SceneContent />
    </ThreeCanvas>
  );
};
