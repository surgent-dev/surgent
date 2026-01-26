export interface Sandbox {
  id: string
  status: string | null
  url: string | null
}

export interface Worker {
  name: string
  status: string | null
  hostname: string | null
}

export interface Project {
  id: string
  userId: string
  organizationId?: string
  name: string
  github: any | null
  settings: any | null
  metadata: any | null
  createdAt: string
  updatedAt: string
  sandbox: Sandbox | null
  worker: Worker | null
}
