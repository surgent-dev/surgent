'use client'

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { ThemeProvider } from 'next-themes'
import { AutumnProvider } from 'autumn-js/react'
import posthog from 'posthog-js'
import { authClient } from '@/lib/auth-client'

type ProvidersProps = {
  children: ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  const [client] = useState(() => new QueryClient())

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.user) {
        posthog.identify(data.user.id, {
          email: data.user.email,
          name: data.user.name,
        })
      }
    })
  }, [])

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
        <AutumnProvider betterAuthUrl={process.env.NEXT_PUBLIC_BACKEND_URL!}>
          {children}
        </AutumnProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
