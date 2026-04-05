'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { type UILocale, loadUILocale, saveUILocale, detectLocaleFromHeader } from './i18n'

type I18nContextType = {
  locale: UILocale
  setLocale: (locale: UILocale) => void
}

const I18nContext = createContext<I18nContextType>({ locale: 'en', setLocale: () => {} })

export function I18nProvider({ children, detected }: { children: ReactNode; detected: UILocale }) {
  const [locale, setLocaleState] = useState<UILocale>(detected)

  useEffect(() => {
    const saved = loadUILocale()
    if (saved) setLocaleState(saved)
  }, [])

  function setLocale(l: UILocale) {
    setLocaleState(l)
    saveUILocale(l)
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useUILocale() {
  return useContext(I18nContext)
}
