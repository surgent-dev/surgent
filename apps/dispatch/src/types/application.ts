export type WorkerBinding = {
  fetch(request: Request): Promise<Response>
}

export type DispatchNamespace = {
  get(name: string): WorkerBinding
}

export type Bindings = {
  dispatcher?: DispatchNamespace
  DOMAIN_MAP?: KVNamespace
}

export type AppContext = {
  Bindings: Bindings
}
