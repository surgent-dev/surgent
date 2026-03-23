'use client'

import { useQuery } from '@tanstack/react-query'
import { http } from '@/lib/http'

export type ReferralStats = {
  link: string
  signups: number
  converted: number
  earnedUsd: number
  signupRewardUsd: number
  conversionRewardUsd: number
}

export const referralStatsQueryKey = ['referrals', 'stats'] as const

export function useReferralStats() {
  return useQuery({
    queryKey: referralStatsQueryKey,
    queryFn: () => http.get('api/referrals').json<ReferralStats>(),
    staleTime: 30_000,
  })
}
