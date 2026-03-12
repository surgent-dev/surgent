import './globals.css'
import Providers from '@/components/providers'
import { Inter, JetBrains_Mono, Instrument_Serif, Geist } from 'next/font/google'
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

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
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
        className={`antialiased ${inter.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} ${geist.variable}`}
      >
        <Providers>{children}</Providers>
        <Toaster position="top-right" />
      </body>
      <GoogleAnalytics gaId="G-ZXHRJ2KM14" />
    </html>
  )
}
