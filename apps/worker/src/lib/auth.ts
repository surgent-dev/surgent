import { betterAuth } from "better-auth";
import { autumn } from "autumn-js/better-auth";
import { apiKey } from "better-auth/plugins";
import { dialect } from "@/lib/db";
import { config } from './config'

export const auth = betterAuth({
  secret: config.auth.secret,
  baseURL: config.auth.baseUrl,
  trustedOrigins: config.server.trustedOrigins,

  plugins: [
    autumn(),
    apiKey({
      rateLimit: { enabled: false },
      enableSessionForAPIKeys: true,
      apiKeyHeaders: ['x-api-key', 'authorization'],
    }),
  ],

  database: {
    dialect,
    type: "postgres",
  },

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },

  socialProviders: {
    google: {
      clientId: config.auth.googleClientId!,
      clientSecret: config.auth.googleClientSecret!,
      enabled: true,
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },

  advanced: {
    crossSubDomainCookies: { enabled: true },
  },
});
