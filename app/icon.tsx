import { ImageResponse } from 'next/og'
import { defaultBrand } from '@/lib/brand'

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

// Fallback tab icon (admin, 404, redirect): the MadStack dome mark in the default brand color.
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: defaultBrand(), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="48" height="48" viewBox="0 0 32 32" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 28h26M6 25h20M8 25v-7h16v7M12 25v-7M16 25v-7M20 25v-7M10.5 18c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6M16 12V6.5M14.2 6.5h3.6" />
        </svg>
      </div>
    ),
    size,
  )
}
