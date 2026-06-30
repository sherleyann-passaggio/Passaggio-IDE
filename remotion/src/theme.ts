// ═════════════════════════════════════════════════════════════════════════════
// THEME BRIDGE — Parses design.md at build time; exports dual token surfaces
// ═════════════════════════════════════════════════════════════════════════════
// Source of truth: /Users/sherleybelleus/Library/Mobile Documents/com~apple~CloudDocs/The Passaggio Tech Stack/design.md
// Fallbacks: Hard-coded theatrical dark-mode + Baroque gold tokens
// ═════════════════════════════════════════════════════════════════════════════

const DESIGN_MD_PATH =
  "/Users/sherleybelleus/Library/Mobile Documents/com~apple~CloudDocs/The Passaggio Tech Stack/design.md";

function parseDesignTokens(): Record<string, unknown> | null {
  try {
    // Dynamic require ensures this only executes in Node contexts (render/build)
    // and gracefully degrades in browser preview without bundler errors.
    const fs = require("fs");
    const raw = fs.readFileSync(DESIGN_MD_PATH, "utf-8");
    const jsonMatch = raw.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1]);
    }
  } catch {
    // Silently fall back to defaults if design.md is missing or malformed
  }
  return null;
}

const parsed = parseDesignTokens();

// ── Theatrical Dark-Mode / Baroque Gold Token Surface ───────────────────────
// Used by: KineticSaaSShort, VirtualCursorRig, MockupRig, CTABillboard, etc.
export const brandTheme = {
  colors: {
    background: "#0D0D0D",      // Deep, stark theatrical dark mode
    surface: "#1A1A1A",         // Clean container borders
    accentText: "#F5F5F7",      // Crisp minimalist primary typography
    highlight: "#E5A93C",       // Rich gold / Baroque transient accent for active words
    muted: "#6B7280",           // Subdued metadata text
    danger: "#ef4444",          // Error / rejection states
    success: "#10b981",         // Approval / verified states
  },
  fonts: {
    sans: "'Inter', 'Oswald', 'din-condensed-web', system-ui, sans-serif",
    display: "'Oswald', 'din-condensed-web', sans-serif",
    body: "'Lato', 'proxima-nova', sans-serif",
    mono: "'JetBrains Mono', 'Courier New', monospace",
  },
  spacing: {
    xs: "2px",
    sm: "10px",
    md: "18px",
    lg: "30px",
    xl: "64px",
    section: "96px",
  },
  motion: {
    spring: { damping: 12, mass: 0.5, stiffness: 100 },
    cursorSpring: { mass: 0.3, damping: 8, stiffness: 120 },
    subtitleSpring: { damping: 14, mass: 0.6, stiffness: 180 },
  },
  shadows: {
    broll: "0 10px 40px rgba(0, 0, 0, 0.55)",
    caption: "0 2px 10px rgba(0,0,0,0.92)",
    mockup: "0 20px 60px rgba(0,0,0,0.5)",
    mockupHover: "0 0 40px rgba(229,169,60,0.27), 0 20px 60px rgba(0,0,0,0.6)",
  },
};

// ── Marketing / Light-Mode Token Surface (from design.md) ───────────────────
// Used by: TitleOverlay, MyComposition, and legacy components
// Merges parsed design.md tokens with hard fallbacks for every key
export const tokens = {
  brand: {
    name: (parsed?.brand as Record<string, string>)?.name ?? "Passaggio",
    slug: (parsed?.brand as Record<string, string>)?.slug ?? "passaggio",
  },
  colors: {
    primary: (parsed?.colors as Record<string, string>)?.primary ?? "#D81B60",
    secondary: (parsed?.colors as Record<string, string>)?.secondary ?? "#111111",
    accent: (parsed?.colors as Record<string, string>)?.accent ?? "#D81B60",
    bg: (parsed?.colors as Record<string, string>)?.bg ?? "#FFFFFF",
    surface: (parsed?.colors as Record<string, string>)?.surface ?? "#FFFFFF",
    surfaceLight: (parsed?.colors as Record<string, string>)?.surfaceLight ?? "#FFFFFF",
    border: (parsed?.colors as Record<string, string>)?.border ?? "#E5E7EB",
    text: (parsed?.colors as Record<string, string>)?.text ?? "#111111",
    textPrimary: (parsed?.colors as Record<string, string>)?.textPrimary ?? "#111111",
    textSecondary: (parsed?.colors as Record<string, string>)?.textSecondary ?? "#111111",
    textMuted: (parsed?.colors as Record<string, string>)?.textMuted ?? "#6B7280",
    danger: (parsed?.colors as Record<string, string>)?.danger ?? "#ef4444",
    success: (parsed?.colors as Record<string, string>)?.success ?? "#10b981",
    warning: (parsed?.colors as Record<string, string>)?.warning ?? "#f59e0b",
    info: (parsed?.colors as Record<string, string>)?.info ?? "#3b82f6",
    graphBar: (parsed?.colors as Record<string, string>)?.graphBar ?? "#D81B60",
    graphLine: (parsed?.colors as Record<string, string>)?.graphLine ?? "#D81B60",
    graphDot: (parsed?.colors as Record<string, string>)?.graphDot ?? "#D81B60",
    panelBg: (parsed?.colors as Record<string, string>)?.panelBg ?? "rgba(255, 255, 255, 0.92)",
    panelBorder: (parsed?.colors as Record<string, string>)?.panelBorder ?? "#E5E7EB",
    watermarkBg: (parsed?.colors as Record<string, string>)?.watermarkBg ?? "rgba(0,0,0,0.5)",
    gridLine: (parsed?.colors as Record<string, string>)?.gridLine ?? "rgba(0,0,0,0.06)",
    axisLine: (parsed?.colors as Record<string, string>)?.axisLine ?? "rgba(0,0,0,0.28)",
    labelText: (parsed?.colors as Record<string, string>)?.labelText ?? "rgba(0,0,0,0.50)",
  },
  typography: {
    display: (parsed?.typography as Record<string, string>)?.display ?? "'Oswald', 'din-condensed-web', sans-serif",
    headingLg: (parsed?.typography as Record<string, string>)?.headingLg ?? "'Oswald', 'din-condensed-web', sans-serif",
    headingMd: (parsed?.typography as Record<string, string>)?.headingMd ?? "'Oswald', 'din-condensed-web', sans-serif",
    bodyLg: (parsed?.typography as Record<string, string>)?.bodyLg ?? "'Lato', 'proxima-nova', sans-serif",
    bodyMd: (parsed?.typography as Record<string, string>)?.bodyMd ?? "'Lato', 'proxima-nova', sans-serif",
    labelSm: (parsed?.typography as Record<string, string>)?.labelSm ?? "'Lato', 'proxima-nova', sans-serif",
    heading: (parsed?.typography as Record<string, string>)?.heading ?? "'Oswald', 'din-condensed-web', sans-serif",
    body: (parsed?.typography as Record<string, string>)?.body ?? "'Lato', 'proxima-nova', sans-serif",
    mono: (parsed?.typography as Record<string, string>)?.mono ?? "'JetBrains Mono', 'Courier New', monospace",
  },
  spacingScale: {
    base: (parsed?.spacingScale as Record<string, string>)?.base ?? "2px",
    xs: (parsed?.spacingScale as Record<string, string>)?.xs ?? "2px",
    sm: (parsed?.spacingScale as Record<string, string>)?.sm ?? "10px",
    md: (parsed?.spacingScale as Record<string, string>)?.md ?? "18px",
    lg: (parsed?.spacingScale as Record<string, string>)?.lg ?? "30px",
    xl: (parsed?.spacingScale as Record<string, string>)?.xl ?? "64px",
    section: (parsed?.spacingScale as Record<string, string>)?.section ?? "96px",
  },
  assets: {
    logo: (parsed?.assets as Record<string, string>)?.logo ?? "media/rocket.png",
    logoSvg: (parsed?.assets as Record<string, string>)?.logoSvg ?? "media/rocket.svg",
  },
  spacing: {
    radius: (parsed?.spacing as Record<string, string>)?.radius ?? "0.75rem",
    radiusSharp: (parsed?.spacing as Record<string, string>)?.radiusSharp ?? "0",
    roundedNone: (parsed?.spacing as Record<string, string>)?.roundedNone ?? "0px",
    roundedSm: (parsed?.spacing as Record<string, string>)?.roundedSm ?? "4px",
    roundedMd: (parsed?.spacing as Record<string, string>)?.roundedMd ?? "6px",
    roundedLg: (parsed?.spacing as Record<string, string>)?.roundedLg ?? "8px",
    roundedPill: (parsed?.spacing as Record<string, string>)?.roundedPill ?? "9999px",
  },
  motion: {
    spring: (parsed?.motion as Record<string, Record<string, number>>)?.spring ?? { damping: 14, mass: 0.9, stiffness: 110 },
  },
  shadows: {
    broll: (parsed?.shadows as Record<string, string>)?.broll ?? "0 10px 40px rgba(0, 0, 0, 0.55)",
    caption: (parsed?.shadows as Record<string, string>)?.caption ?? "0 2px 10px rgba(0,0,0,0.92)",
  },
};

// ── Type exports for downstream components ──────────────────────────────────
export type BrandTheme = typeof brandTheme;
export type Tokens = typeof tokens;
