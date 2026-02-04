import { createAuthClient } from 'better-auth/react'
import { nextCookies } from 'better-auth/next-js'
import { adminClient, organizationClient } from 'better-auth/client/plugins'
// import { oauthProviderClient } from '@better-auth/oauth-provider/client'

// Create the auth client - explicit type to satisfy TypeScript
const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
  plugins: [
    organizationClient({
      teams: { enabled: true },
      dynamicAccessControl: { enabled: true },
    }),
    adminClient(),
    // oauthProviderClient(),
    nextCookies(),
  ], // make sure this is the last plugin in the array
})

// Export the client
export { authClient }
