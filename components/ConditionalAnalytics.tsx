'use client'

import { Analytics } from '@vercel/analytics/next'
import { useState, useEffect } from 'react'
import { isNative } from '@/lib/native'

export function ConditionalAnalytics() {
  const [show, setShow] = useState(true)

  useEffect(() => {
    if (isNative()) setShow(false)
  }, [])

  if (!show) return null
  return <Analytics />
}
