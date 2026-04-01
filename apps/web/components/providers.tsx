'use client'

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { ThemeProvider } from 'next-themes'
import posthog from 'posthog-js'
import { authClient } from '@/lib/auth-client'
import { track } from '@/lib/track'

type ProvidersProps = {
  children: ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  const [client] = useState(() => new QueryClient())

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (!data?.user) return
      posthog.identify(data.user.id, { email: data.user.email })

      // Consume signup_complete cookie set by server databaseHook on new user creation
      const match = document.cookie.match(/(?:^|; )signup_complete=([^;]+)/)
      if (match?.[1] && !localStorage.getItem('signup_tracked')) {
        track('sign_up', { method: decodeURIComponent(match[1]) })
        localStorage.setItem('signup_tracked', String(data.user.id))
        document.cookie = 'signup_complete=; max-age=0; path=/; SameSite=Lax'
      }
    })
  }, [])

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  )
}
