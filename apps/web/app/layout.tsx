import './globals.css'
import Providers from '@/components/providers'
import {
  Plus_Jakarta_Sans,
  JetBrains_Mono,
  Instrument_Serif,
  Space_Grotesk,
  Outfit,
} from 'next/font/google'
import { GoogleAnalytics } from '@next/third-parties/google'
import { Analytics as DubAnalytics } from '@dub/analytics/react'
import { Toaster } from 'sonner'

export const metadata = {
  title: 'Surgent — AI that builds and grows your business',
  description:
    'Describe your business. Surgent builds your site, adds an AI sales agent, and grows your revenue on autopilot.',
}

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`antialiased ${plusJakarta.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} ${outfit.variable}`}
      >
        <Providers>{children}</Providers>
        <Toaster
          position="bottom-right"
          theme="system"
          toastOptions={{
            classNames: {
              toast:
                'font-[var(--font-jakarta)] !bg-white dark:!bg-[#222] !border-border !shadow-sm !rounded-lg',
              title: '!text-foreground !text-sm !font-medium',
              description: '!text-muted-foreground !text-xs',
              actionButton: 'btn-brand !rounded-md !text-xs !font-medium !h-7 !px-3',
              cancelButton: '!bg-muted !text-foreground !rounded-md !text-xs',
              success: '!border-emerald-500/20',
              error: '!border-destructive/20',
            },
          }}
        />
        <DubAnalytics
          publishableKey={process.env.NEXT_PUBLIC_DUB_PUBLISHABLE_KEY}
          domainsConfig={{
            refer: 'go.surgent.dev',
          }}
        />
      </body>
      <GoogleAnalytics gaId="G-ZXHRJ2KM14" />
    </html>
  )
}
