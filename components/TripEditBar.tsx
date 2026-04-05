'use client'

import { useState, useRef, useEffect } from 'react'
import { useUILocale } from '@/lib/i18n-context'
import { t } from '@/lib/i18n'

interface Props {
  onSubmit: (instruction: string, language: string) => void
  onUndo: () => void
  onCancel: () => void
  canUndo: boolean
  isLoading: boolean
  error: string | null
  language: string
}

export function TripEditBar({ onSubmit, onUndo, onCancel, canUndo, isLoading, error, language }: Props) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { locale } = useUILocale()

  // Auto-dismiss error after 5 seconds
  const [showError, setShowError] = useState(false)
  useEffect(() => {
    if (error) {
      setShowError(true)
      const t = setTimeout(() => setShowError(false), 5000)
      return () => clearTimeout(t)
    }
    setShowError(false)
  }, [error])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    // Detect input language by character script (same logic as ChatInput)
    const hasChinese = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(trimmed)
    const inputLang = hasChinese ? language : 'en'

    onSubmit(trimmed, inputLang)
    setInput('')
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
      <div className="max-w-4xl mx-auto px-4 py-3">
        {showError && error && (
          <div className="mb-2 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
            {error}
          </div>
        )}
        <p className="text-[11px] text-gray-400 mb-1.5 px-1">
          {t(locale, 'edit.hint')}
        </p>
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {canUndo && !isLoading && (
            <button
              type="button"
              onClick={onUndo}
              className="shrink-0 px-3 py-2.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors min-h-[44px]"
            >
              ↩ {t(locale, 'edit.undo')}
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t(locale, 'edit.placeholder')}
            disabled={isLoading}
            className="flex-1 min-w-0 px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange disabled:bg-gray-50 disabled:text-gray-400 min-h-[44px]"
          />
          {isLoading ? (
            <button
              type="button"
              onClick={onCancel}
              className="shrink-0 px-4 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors min-h-[44px]"
            >
              {t(locale, 'edit.cancel')}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="shrink-0 w-11 h-11 flex items-center justify-center bg-orange text-white rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          )}
        </form>
        {isLoading && (
          <div className="mt-1.5 flex items-center justify-center gap-2">
            <svg className="w-3.5 h-3.5 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <p className="text-xs text-gray-400">
              {t(locale, 'edit.updating')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
