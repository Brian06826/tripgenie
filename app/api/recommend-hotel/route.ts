import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { isRateLimited, rateLimitResponse } from '@/lib/rate-limit'

export const maxDuration = 30

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured.')
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 15000 })
  }
  return _client
}

export async function POST(request: Request) {
  try {
    const { dayCity, destination, language } = await request.json()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (await isRateLimited(`rechotel:${ip}`, 10, 3600)) {
      return rateLimitResponse(language)
    }

    if (!dayCity && !destination) {
      return NextResponse.json({ error: 'Missing city or destination' }, { status: 400 })
    }

    const city = dayCity || destination
    const isChinese = language === 'zh-TW' || language === 'zh-HK' || language === 'zh-CN'

    const client = getClient()
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Recommend ONE highly-rated hotel in ${city} that is centrally located and popular with tourists. Return ONLY the hotel name in ${isChinese ? 'English (not Chinese)' : 'English'}, nothing else. No quotes, no explanation. Example: The Peninsula Tokyo`,
      }],
    })

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
    if (!text) {
      return NextResponse.json({ error: 'No recommendation' }, { status: 500 })
    }

    return NextResponse.json({ hotelName: text })
  } catch (err) {
    console.error('[recommend-hotel] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to recommend hotel' },
      { status: 500 },
    )
  }
}
