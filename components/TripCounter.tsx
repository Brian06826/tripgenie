'use client'

import { useEffect, useState } from 'react'

export function TripCounter() {
  const [count, setCount] = useState<number | null>(null)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    fetch('/api/trip-count')
      .then(r => r.json())
      .then(d => setCount(d.count))
      .catch(() => setCount(500))
  }, [])

  // Animate number ticking up
  useEffect(() => {
    if (count === null) return
    const start = Math.max(count - 12, 0)
    setDisplay(start)
    let current = start
    const interval = setInterval(() => {
      current += 1
      setDisplay(current)
      if (current >= count) clearInterval(interval)
    }, 60)
    return () => clearInterval(interval)
  }, [count])

  if (count === null) return null

  return (
    <p className="text-xs text-gray-400 text-center mt-3 animate-in fade-in duration-700">
      🎯 <span className="font-semibold text-gray-500">{display.toLocaleString()}</span> trips planned and counting
    </p>
  )
}
