export interface BrandConfig {
  bg?: string
  surface?: string
  border?: string
  teal_ink?: string
  tagline?: string
  chat_welcome?: string
  logo_url?: string
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const d = (v: number) => Math.max(0, Math.floor(v * (1 - amount)))
  return `#${[d(r), d(g), d(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const l = (v: number) => Math.min(255, Math.floor(v + (255 - v) * amount))
  return `#${[l(r), l(g), l(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export function buildThemeVars(color: string, cfg: BrandConfig = {}): Record<string, string> {
  // One brand color drives the palette (same scheme as madstack.ai). Neutrals are fixed so every
  // company looks consistent; only the accent changes. Legacy bg/surface/border overrides are ignored.
  const [r, g, b] = hexToRgb(color)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return {
    '--brand':       color,
    '--teal':        color,
    '--teal-ink':    cfg.teal_ink ?? darken(color, 0.3),
    '--teal-soft':   lighten(color, 0.7),
    '--teal-softer': lighten(color, 0.955),
    '--tint':        lighten(color, 0.88),
    '--dotrgb':      `${r},${g},${b}`,
    '--on-accent':   lum > 0.55 ? '#141922' : '#ffffff',
  }
}

export function buildThemeCss(color: string, cfg: BrandConfig = {}): string {
  return Object.entries(buildThemeVars(color, cfg)).map(([k, v]) => `${k}:${v}`).join(';')
}
