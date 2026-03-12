'use client'

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { ThemeProvider } from 'next-themes'
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
        posthog.identify(data.user.id, { email: data.user.email })
      }
    })
  }, [])

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  )
}
