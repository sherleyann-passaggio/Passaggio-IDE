# Passaggio Brand Design System

> Machine-readable tokens for the Marketing Video Pipeline (Remotion + ElevenLabs).
> Remotion parses the JSON code block below as `const tokens = JSON.parse(designMdMatch[1])`.
> Source of truth: /Users/sherleybelleus/Library/Mobile Documents/com~apple~CloudDocs/The Passaggio Tech Stack/design.md

## Tokens

```json
{
  "brand": {
    "name": "Passaggio",
    "slug": "passaggio"
  },
  "colors": {
    "primary": "#D81B60",
    "secondary": "#111111",
    "accent": "#D81B60",
    "bg": "#FFFFFF",
    "surface": "#FFFFFF",
    "surfaceLight": "#FFFFFF",
    "border": "#E5E7EB",
    "text": "#111111",
    "textPrimary": "#111111",
    "textSecondary": "#111111",
    "textMuted": "#6B7280",
    "danger": "#ef4444",
    "success": "#10b981",
    "warning": "#f59e0b",
    "info": "#3b82f6",
    "graphBar": "#D81B60",
    "graphLine": "#D81B60",
    "graphDot": "#D81B60",
    "panelBg": "rgba(255, 255, 255, 0.92)",
    "panelBorder": "#E5E7EB",
    "watermarkBg": "rgba(0,0,0,0.5)",
    "gridLine": "rgba(0,0,0,0.06)",
    "axisLine": "rgba(0,0,0,0.28)",
    "labelText": "rgba(0,0,0,0.50)"
  },
  "typography": {
    "display": "'Oswald', 'din-condensed-web', sans-serif",
    "headingLg": "'Oswald', 'din-condensed-web', sans-serif",
    "headingMd": "'Oswald', 'din-condensed-web', sans-serif",
    "bodyLg": "'Lato', 'proxima-nova', sans-serif",
    "bodyMd": "'Lato', 'proxima-nova', sans-serif",
    "labelSm": "'Lato', 'proxima-nova', sans-serif",
    "heading": "'Oswald', 'din-condensed-web', sans-serif",
    "body": "'Lato', 'proxima-nova', sans-serif",
    "mono": "'JetBrains Mono', 'Courier New', monospace"
  },
  "spacingScale": {
    "base": "2px",
    "xs": "2px",
    "sm": "10px",
    "md": "18px",
    "lg": "30px",
    "xl": "64px",
    "section": "96px"
  },
  "assets": {
    "logo": "media/rocket.png",
    "logoSvg": "media/rocket.svg"
  },
  "spacing": {
    "radius": "0.75rem",
    "radiusSharp": "0",
    "roundedNone": "0px",
    "roundedSm": "4px",
    "roundedMd": "6px",
    "roundedLg": "8px",
    "roundedPill": "9999px"
  },
  "motion": {
    "spring": {
      "damping": 14,
      "mass": 0.9,
      "stiffness": 110
    }
  },
  "shadows": {
    "broll": "0 10px 40px rgba(0, 0, 0, 0.55)",
    "caption": "0 2px 10px rgba(0,0,0,0.92)"
  }
}
```

## Usage

- **Remotion**: Import `tokens` from `src/theme.ts` (which reads this JSON block).
- **App Prototypes**: Map CSS custom properties to these hex values in `index.css` for instant "Brand Inversion".
- **ElevenLabs scripts**: Reference `brand.name`, `brand.slug`, and `colors.primary` for text overlays.

## Font Notes

- `din-condensed-web` → Google Font fallback: **Oswald** (loaded via Google Fonts CDN)
- `proxima-nova` → Google Font fallback: **Lato** (loaded via Google Fonts CDN)
- To swap in Adobe Fonts: download `.woff2` files and place in `remotion/public/fonts/`, then update the `@font-face` declarations in a custom CSS file.