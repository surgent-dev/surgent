import { create } from 'zustand'

export type PayEnv = 'test' | 'live'

type PayEnvStore = {
  env: PayEnv
  setEnv: (env: PayEnv) => void
}

export const usePayEnv = create<PayEnvStore>()((set) => ({
  env: 'test',
  setEnv: (env) => set({ env }),
}))
