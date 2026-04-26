'use client'

import { useRouter } from 'next/navigation'

export function BackButton({ className = '' }: { className?: string }) {
  const router = useRouter()

  function handleBack() {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }

  return (
    <button
      onClick={handleBack}
      className={`flex items-center gap-0.5 active:opacity-60 transition-opacity min-w-[44px] min-h-[44px] ${className}`}
      aria-label="Back"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      <span className="text-sm font-medium">Back</span>
    </button>
  )
}
