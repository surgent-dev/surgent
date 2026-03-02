import './globals.css'
import Providers from '@/components/providers'
import { Inter, JetBrains_Mono, Instrument_Serif } from 'next/font/google'
import Script from 'next/script'
import { GoogleAnalytics } from '@next/third-parties/google'
import { Toaster } from 'react-hot-toast'

export const metadata = {
  title: 'Surgent — Build faster with AI',
  description: 'Describe what you want. surgent.dev turns ideas into working software.',
}

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`antialiased ${inter.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable}`}
      >
        <Providers>{children}</Providers>
        <Toaster position="top-right" />
        <Script src="https://cdn.goentri.com/entri.js" strategy="lazyOnload" />
      </body>
      <GoogleAnalytics gaId="G-ZXHRJ2KM14" />
    </html>
  )
}
