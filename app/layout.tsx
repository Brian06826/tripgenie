import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { AuthProvider } from '@/components/AuthProvider'
import { NativeBootstrap } from '@/components/NativeBootstrap'
import { I18nProvider } from '@/lib/i18n-context'
import { detectLocaleFromHeader } from '@/lib/i18n'
import { headers } from 'next/headers'
import { ConditionalAnalytics } from '@/components/ConditionalAnalytics'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://lulgo.com'),
  title: {
    default: 'Lulgo — AI Trip Planner | AI 行程規劃',
    template: '%s',
  },
  description: 'Plan your perfect trip in seconds with AI. Free, no sign-up required. 用 AI 即時生成旅行行程，免登入。',
  openGraph: {
    siteName: 'Lulgo',
    type: 'website',
    images: [{ url: '/og-fallback.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const acceptLang = headersList.get('accept-language') ?? ''
  const detected = detectLocaleFromHeader(acceptLang)

  return (
    <html lang="zh-HK" className={`${geist.variable} h-full`}>
      <body className="min-h-full antialiased">
        <I18nProvider detected={detected}>
          <AuthProvider>
            {children}
            {/* Native shell (Face ID lock + setup prompt). Mounted inside the
                AuthProvider so it can react to session state. No-op on web. */}
            <NativeBootstrap />
          </AuthProvider>
        </I18nProvider>
        <ConditionalAnalytics />
      </body>
    </html>
  )
}
