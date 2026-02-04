import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Session, FileDiff, Agent } from '@opencode-ai/sdk'
import { http } from '@/lib/http'
import type { QuestionAnswer } from '@/lib/question'

// --- Agents list (cached for 5 min since agents rarely change) ---

async function fetchAgents(projectId: string): Promise<Agent[]> {
  const data = await http.get(`api/agent/${projectId}/agent`).json()
  return data as Agent[]
}

export function useAgentsQuery(projectId?: string) {
  return useQuery<Agent[]>({
    queryKey: ['agents', projectId],
    queryFn: () => fetchAgents(projectId as string),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000, // 5 minutes - agents rarely change
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
  })
}

// Helper to get primary agents only
export function usePrimaryAgents(projectId?: string) {
  const query = useAgentsQuery(projectId)
  const primaryAgents = query.data?.filter((a) => a.mode === 'primary' || a.mode === 'all') ?? []
  return { ...query, data: primaryAgents }
}

// Helper to get subagents only
export function useSubagents(projectId?: string) {
  const query = useAgentsQuery(projectId)
  const subagents = query.data?.filter((a) => a.mode === 'subagent' || a.mode === 'all') ?? []
  return { ...query, data: subagents }
}

// --- Session list & create ---

async function fetchSessions(projectId: string): Promise<Session[]> {
  const data = await http.get(`api/agent/${projectId}/session`).json()
  const sessions = data as Session[]
  return [...sessions].sort((a, b) => (b.time?.updated ?? 0) - (a.time?.updated ?? 0))
}

type CreateSessionOptions = {
  parentID?: string
  title?: string
}

async function createSession(projectId: string, options?: CreateSessionOptions): Promise<Session> {
  const data = await http.post(`api/agent/${projectId}/session`, { json: options ?? {} }).json()
  return data as Session
}

type FilePartInput = {
  id?: string
  type: 'file'
  mime: string
  filename: string
  url: string
  size: number
}

type TextPartInput = {
  id?: string
  type: 'text'
  text: string
}

export type SendPartInput = FilePartInput | TextPartInput

type AgentModelOverride = {
  model?: { providerID: string; modelID: string }
}

async function sendMessage(
  projectId: string,
  sessionId: string,
  agent: 'plan' | 'build' | 'orchestrator',
  parts: SendPartInput[],
  messageId?: string,
  model?: string,
  providerID?: string,
  variant?: string,
  agentOverrides?: Record<string, AgentModelOverride>,
): Promise<void> {
  const body: Record<string, unknown> = { agent, parts }

  if (messageId && messageId.trim()) {
    body.messageID = messageId
  }
  if (model && model.trim() && providerID && providerID.trim()) {
    body.model = { providerID, modelID: model }
  }
  if (variant && variant.trim()) {
    body.variant = variant
  }
  if (agentOverrides && Object.keys(agentOverrides).length > 0) {
    body.agentOverrides = agentOverrides
  }

  await http.post(`api/agent/${projectId}/session/${sessionId}/prompt_async`, {
    json: body,
    timeout: false,
    retry: 0,
  })
}

async function abortSession(projectId: string, sessionId: string): Promise<boolean> {
  const data = await http.post(`api/agent/${projectId}/session/${sessionId}/abort`).json()
  return data as boolean
}

export function useSessionsQuery(projectId?: string) {
  return useQuery<Session[]>({
    queryKey: ['sessions', projectId],
    queryFn: async () => {
      const sessions = await fetchSessions(projectId as string)
      if (sessions.length === 0) {
        const newSession = await createSession(projectId as string)
        return [newSession]
      }
      return sessions
    },
    enabled: Boolean(projectId),
    staleTime: 10000,
  })
}

export function useCreateSession(projectId?: string) {
  const queryClient = useQueryClient()
  return useMutation<Session, unknown, CreateSessionOptions | void>({
    mutationFn: (options) => createSession(projectId as string, options ?? undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions', projectId] }),
  })
}

export function useEnsureSession(projectId?: string) {
  const queryClient = useQueryClient()
  return useMutation<Session, unknown, void>({
    mutationFn: async () => {
      const sessions = await fetchSessions(projectId as string)
      if (sessions?.length) return sessions[0]!
      return createSession(projectId as string)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', projectId] })
    },
  })
}

export function useSendMessage(projectId?: string) {
  return useMutation<
    void,
    unknown,
    {
      sessionId: string
      messageId?: string
      agent: 'plan' | 'build' | 'orchestrator'
      parts: SendPartInput[]
      model?: string
      providerID?: string
      variant?: string
      agentOverrides?: Record<string, AgentModelOverride>
    }
  >({
    mutationFn: ({
      sessionId,
      messageId,
      agent,
      parts,
      model,
      providerID,
      variant,
      agentOverrides,
    }) =>
      sendMessage(
        projectId as string,
        sessionId,
        agent,
        parts,
        messageId,
        model,
        providerID,
        variant,
        agentOverrides,
      ),
  })
}

export type { AgentModelOverride }

export function useAbortSession() {
  return useMutation<boolean, unknown, { projectId: string; sessionId: string }>({
    mutationFn: ({ projectId, sessionId }) => abortSession(projectId, sessionId),
  })
}

// --- Delete session ---

async function deleteSession(projectId: string, sessionId: string): Promise<boolean> {
  const data = await http.delete(`api/agent/${projectId}/session/${sessionId}`).json()
  return data as boolean
}

export function useDeleteSession(projectId?: string) {
  const queryClient = useQueryClient()
  return useMutation<boolean, unknown, { sessionId: string }>({
    mutationFn: ({ sessionId }) => deleteSession(projectId as string, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', projectId] })
    },
  })
}

// --- Update session (title) ---

async function updateSession(
  projectId: string,
  sessionId: string,
  updates: { title?: string },
): Promise<Session> {
  const data = await http
    .patch(`api/agent/${projectId}/session/${sessionId}`, { json: updates })
    .json()
  return data as Session
}

export function useUpdateSession(projectId?: string) {
  const queryClient = useQueryClient()
  return useMutation<Session, unknown, { sessionId: string; title?: string }>({
    mutationFn: ({ sessionId, ...updates }) =>
      updateSession(projectId as string, sessionId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', projectId] })
    },
  })
}

// --- Fork session ---

async function forkSession(
  projectId: string,
  sessionId: string,
  messageId?: string,
): Promise<Session> {
  const data = await http
    .post(`api/agent/${projectId}/session/${sessionId}/fork`, {
      json: messageId ? { messageID: messageId } : {},
    })
    .json()
  return data as Session
}

export function useForkSession(projectId?: string) {
  const queryClient = useQueryClient()
  return useMutation<Session, unknown, { sessionId: string; messageId?: string }>({
    mutationFn: ({ sessionId, messageId }) =>
      forkSession(projectId as string, sessionId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', projectId] })
    },
  })
}

// --- Session diff ---

async function fetchSessionDiff(
  projectId: string,
  sessionId: string,
  messageId?: string,
): Promise<FileDiff[]> {
  const url = messageId
    ? `api/agent/${projectId}/session/${sessionId}/diff?messageID=${messageId}`
    : `api/agent/${projectId}/session/${sessionId}/diff`
  const data = await http.get(url).json()
  return data as FileDiff[]
}

export function useSessionDiff(projectId?: string, sessionId?: string, messageId?: string) {
  return useQuery<FileDiff[]>({
    queryKey: ['session-diff', projectId, sessionId, messageId],
    queryFn: () => fetchSessionDiff(projectId as string, sessionId as string, messageId),
    enabled: Boolean(projectId && sessionId),
  })
}

// --- Respond to permission ---

type PermissionResponse = 'once' | 'always' | 'reject'

async function respondPermission(
  projectId: string,
  sessionId: string,
  permissionId: string,
  response: PermissionResponse,
  remember?: boolean,
): Promise<boolean> {
  const data = await http
    .post(`api/agent/${projectId}/session/${sessionId}/permissions/${permissionId}`, {
      json: { response, remember },
    })
    .json()
  return data as boolean
}

export function useRespondPermission(projectId?: string, sessionId?: string) {
  return useMutation<
    boolean,
    unknown,
    { permissionId: string; response: PermissionResponse; remember?: boolean }
  >({
    mutationFn: ({ permissionId, response, remember }) =>
      respondPermission(projectId as string, sessionId as string, permissionId, response, remember),
  })
}

// --- Revert session ---

async function revertSession(
  projectId: string,
  sessionId: string,
  messageId: string,
): Promise<Session> {
  const data = await http
    .post(`api/agent/${projectId}/session/${sessionId}/revert`, {
      json: { messageID: messageId },
    })
    .json()
  return data as Session
}

async function unrevertSession(projectId: string, sessionId: string): Promise<Session> {
  const data = await http
    .post(`api/agent/${projectId}/session/${sessionId}/unrevert`, { json: {} })
    .json()
  return data as Session
}

export function useRevertSession(projectId?: string) {
  const queryClient = useQueryClient()
  return useMutation<Session, unknown, { sessionId: string; messageId: string }>({
    mutationFn: ({ sessionId, messageId }) =>
      revertSession(projectId as string, sessionId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', projectId] })
    },
  })
}

export function useUnrevertSession(projectId?: string) {
  const queryClient = useQueryClient()
  return useMutation<Session, unknown, { sessionId: string }>({
    mutationFn: ({ sessionId }) => unrevertSession(projectId as string, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', projectId] })
    },
  })
}

// --- Question ---

export function useReplyQuestion(projectId?: string) {
  return useMutation({
    mutationFn: ({ id, answers }: { id: string; answers: QuestionAnswer[] }) =>
      http.post(`api/agent/${projectId}/question/${id}/reply`, { json: { answers } }).json(),
  })
}

export function useRejectQuestion(projectId?: string) {
  return useMutation({
    mutationFn: (id: string) => http.post(`api/agent/${projectId}/question/${id}/reject`).json(),
  })
}
