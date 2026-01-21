import { createAuthClient } from 'better-auth/react'
import { nextCookies } from 'better-auth/next-js'
import { organizationClient } from 'better-auth/client/plugins'

// Create the auth client - explicit type to satisfy TypeScript
const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
  plugins: [
    organizationClient({
      teams: { enabled: true },
      dynamicAccessControl: { enabled: true },
    }),
    nextCookies(),
  ], // make sure this is the last plugin in the array
})

// Export the client
export { authClient }
