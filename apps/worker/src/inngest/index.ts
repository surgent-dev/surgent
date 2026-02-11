import { createProjectFn } from './functions/create-project'
import { deployProjectFn } from './functions/deploy-project'

export { inngest } from './client'
export { createProjectFn, deployProjectFn }

export const functions = [createProjectFn, deployProjectFn]
