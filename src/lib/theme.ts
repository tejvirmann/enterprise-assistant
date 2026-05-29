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
  const [r, g, b] = hexToRgb(color)
  return {
    '--brand':       color,
    '--teal':        color,
    '--teal-ink':    cfg.teal_ink ?? darken(color, 0.15),
    '--teal-soft':   `rgba(${r},${g},${b},0.13)`,
    '--teal-softer': `rgba(${r},${g},${b},0.06)`,
    '--bg':          cfg.bg      ?? lighten(color, 0.93),
    '--surface':     cfg.surface ?? '#ffffff',
    '--border':      cfg.border  ?? `rgba(${r},${g},${b},0.18)`,
    '--border-2':    `rgba(${r},${g},${b},0.10)`,
    '--surface-2':   `rgba(${r},${g},${b},0.05)`,
  }
}

export function buildThemeCss(color: string, cfg: BrandConfig = {}): string {
  return Object.entries(buildThemeVars(color, cfg)).map(([k, v]) => `${k}:${v}`).join(';')
}
