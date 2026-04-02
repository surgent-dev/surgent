import { ImageResponse } from 'next/og'

export const alt = 'Surgent — AI That Builds and Grows Your Business'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
        }}
      >
        <div
          style={{
            fontSize: 80,
            fontWeight: 800,
            color: '#0a0a0a',
            letterSpacing: '-0.04em',
          }}
        >
          Surgent
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#666666',
            maxWidth: 600,
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          AI that builds and grows your business
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 20,
            padding: '12px 32px',
            background: '#0a0a0a',
            color: '#ffffff',
            borderRadius: 12,
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          surgent.dev
        </div>
      </div>
    </div>,
    { ...size },
  )
}
