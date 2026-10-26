import { buildThemeCss } from './theme'

// Default accent for the demo company and every page that is not tied to a company (admin, 404, fallback icon).
// Switch it in .env with BRAND_COLOR, for example:
//   BRAND_COLOR=#f97316   (orange, the original default)
//   BRAND_COLOR=#b41504   (MadStack red)
// Other companies keep the color stored on their row in the database.
export const ORIGINAL_BRAND = '#f97316'

export function defaultBrand(): string {
  const v = (process.env.BRAND_COLOR ?? '').trim()
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? (v.startsWith('#') ? v : `#${v}`).toLowerCase() : ORIGINAL_BRAND
}

export const defaultBrandCss = () => buildThemeCss(defaultBrand())

// The demo company follows the .env default; real client companies use their own stored color.
export const companyColor = (slug: string, stored: string) => (slug === 'demo' ? defaultBrand() : stored)
