'use client'

import { useUILocale } from '@/lib/i18n-context'
import { UI_LOCALES, type UILocale } from '@/lib/i18n'

export function LanguageSwitcher() {
  const { locale, setLocale } = useUILocale()

  return (
    <div className="flex items-center gap-0.5 text-xs font-medium">
      {UI_LOCALES.map(({ code, label }, i) => (
        <span key={code} className="flex items-center">
          {i > 0 && <span className="text-white/30 mx-0.5">|</span>}
          <button
            onClick={() => setLocale(code)}
            className={`px-1 py-0.5 rounded transition-colors ${
              locale === code
                ? 'text-white font-bold'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {label}
          </button>
        </span>
      ))}
    </div>
  )
}
