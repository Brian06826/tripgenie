import { ImageResponse } from 'next/og'
import type { Trip } from './types'

export async function generateAndUploadOgImage(
  trip: Trip,
): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return null // dev fallback
  }

  try {
    const { put } = await import('@vercel/blob')

    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a3a5c 0%, #2d5a8e 100%)',
            fontFamily: 'sans-serif',
            padding: '60px',
          }}
        >
          <div
            style={{
              fontSize: 28,
              color: '#ff8c42',
              fontWeight: 700,
              marginBottom: 16,
              letterSpacing: '-0.5px',
            }}
          >
            ✨ Lulgo
          </div>
          <div
            style={{
              fontSize: 52,
              color: 'white',
              fontWeight: 800,
              textAlign: 'center',
              lineHeight: 1.2,
              marginBottom: 16,
            }}
          >
            {trip.title}
          </div>
          <div
            style={{
              fontSize: 24,
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            {trip.destination} · {Math.max(...trip.days.map(d => d.dayNumber))} day{Math.max(...trip.days.map(d => d.dayNumber)) !== 1 ? 's' : ''}
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )

    const arrayBuffer = await imageResponse.arrayBuffer()
    const blob = await put(`og/${trip.id}.png`, arrayBuffer, {
      access: 'public',
      contentType: 'image/png',
    })
    return blob.url
  } catch (err) {
    console.error('OG image generation failed:', err)
    return null
  }
}
