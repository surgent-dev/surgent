'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Loader2, ExternalLink, Check, ClipboardCheck } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useProvidersQuery,
  useDeleteProvider,
  useChatgptAuthorize,
  type ChatgptAuthorizeResponse,
} from '@/queries/providers'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  getErrorMessage,
  invalidateProviderQueries,
  openProviderOAuthPopup,
} from '@/lib/provider-oauth'
import { http } from '@/lib/http'

const DEVICE_AUTH_TIMEOUT_MS = 330_000

function getChatgptDeviceCode(instructions?: string) {
  return instructions?.match(/:\s*([A-Z0-9-]+)/i)?.[1]
}

function useChatgptDeviceAuth({ onClose }: { onClose: () => void }) {
  const authorize = useChatgptAuthorize()
  const queryClient = useQueryClient()
  const popupRef = useRef<Window | null>(null)
  const [session, setSession] = useState<ChatgptAuthorizeResponse | null>(null)
  const [error, setError] = useState('')
  const callback = useMutation({
    mutationFn: async (requestId: string) => {
      await http
        .post('api/providers/openai/oauth/callback', {
          json: { method: 0, requestId },
          timeout: DEVICE_AUTH_TIMEOUT_MS,
        })
        .json()
    },
  })

  const closePopup = () => {
    popupRef.current?.close()
    popupRef.current = null
  }

  const openPopup = (url: string) => {
    popupRef.current = openProviderOAuthPopup(url)
  }

  const reset = () => {
    closePopup()
    setSession(null)
    setError('')
  }

  const verify = async (next = session) => {
    if (!next) return
    setError('')
    openPopup(next.url)

    // If already polling, just reopen the popup
    if (callback.isPending) return

    try {
      await callback.mutateAsync(next.requestId)
      reset()
      invalidateProviderQueries(queryClient)
      toast.success('ChatGPT subscription connected')
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Authorization failed. Try again.'))
    }
  }

  const start = async () => {
    try {
      const next = await authorize.mutateAsync()
      setSession(next)
      setError('')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to start authorization'))
    }
  }

  const cancel = () => {
    reset()
    onClose()
  }

  useEffect(() => {
    return closePopup
  }, [])

  return {
    session,
    error,
    start,
    verify,
    cancel,
    isStarting: authorize.isPending,
    isPolling: callback.isPending,
  }
}

export function ChatgptAuthFlow({
  onClose,
  compact = false,
}: {
  onClose: () => void
  compact?: boolean
}) {
  const { session, error, start, verify, cancel, isStarting, isPolling } = useChatgptDeviceAuth({
    onClose,
  })
  const deviceCode = getChatgptDeviceCode(session?.instructions)
  const [copied, setCopied] = useState(false)
  const verifyLabel = error ? 'Open verification page again' : 'Open verification page'

  const handleCopy = () => {
    if (!deviceCode) return
    navigator.clipboard.writeText(deviceCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const outer = compact
    ? 'rounded-lg border border-border/60 bg-accent/40 p-4 space-y-4'
    : 'p-6 space-y-4'

  // ── Pre-auth: explain steps, then Connect ──
  if (!session) {
    return (
      <div className={outer}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="size-7 shrink-0 flex items-center justify-center">
              <Image
                src="/OpenAI-logo.svg"
                alt=""
                width={28}
                height={28}
                className="shrink-0 w-7 h-7"
              />
            </div>
            <p className={compact ? 'text-sm font-semibold' : 'text-lg font-semibold'}>
              Connect ChatGPT
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Route OpenAI requests through your ChatGPT Plus or Pro subscription at no extra cost.
          </p>
        </div>

        {/* Instruction */}
        <div className="flex gap-3">
          <span className="mt-0.5 flex size-6 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold shrink-0">
            1
          </span>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Enable{' '}
            <span className="text-foreground font-medium">Device code authorization for Codex</span>{' '}
            in your{' '}
            <a
              href="https://chatgpt.com/#settings/Security"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-0.5"
            >
              Security Settings
              <ExternalLink className="size-3" />
            </a>
          </p>
        </div>

        {/* GIF */}
        <div className="rounded-lg overflow-hidden border border-border/40">
          <Image
            src="/ChatgptSettingsCodex.gif"
            alt="How to enable device code in ChatGPT settings"
            width={420}
            height={236}
            className="w-full h-auto"
            unoptimized
          />
        </div>

        <div className="flex items-center gap-2">
          {compact && (
            <Button variant="ghost" className="rounded-lg" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button
            size="lg"
            className={compact ? 'flex-1 rounded-lg' : 'w-full rounded-lg'}
            onClick={start}
            disabled={isStarting}
          >
            {isStarting && <Loader2 className="size-4 animate-spin" />}
            {isStarting ? 'Connecting...' : 'Done, let\u2019s connect'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={outer}>
      {/* Step 2 — Copy */}
      <div className="flex gap-3">
        <span className="mt-0.5 flex size-6 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold shrink-0">
          2
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium">Copy this code</p>
          {deviceCode && (
            <button
              type="button"
              onClick={handleCopy}
              className="cursor-pointer group flex items-center justify-between w-full rounded-lg border border-border/60 bg-muted/30 px-4 py-3 mt-2 transition-colors hover:bg-muted/50"
            >
              <span className="font-mono text-xl font-bold tracking-[0.3em] text-foreground">
                {deviceCode}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                {copied ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <ClipboardCheck className="size-3.5" />
                )}
                {copied ? 'Copied!' : 'Copy'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Step 3 — Open, sign in, paste, confirm */}
      <div className="flex gap-3">
        <span className="mt-0.5 flex size-6 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold shrink-0">
          3
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium">Open OpenAI, sign in, and paste the code</p>
          <p className="text-xs text-muted-foreground mt-1">
            We&apos;ll detect when you approve — no need to come back.
          </p>
          <Button className="w-full gap-2 rounded-lg mt-2.5" onClick={() => verify()}>
            {isPolling ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ExternalLink className="size-4" />
            )}
            {isPolling ? 'Waiting for approval — click to reopen' : verifyLabel}
          </Button>
          <Button variant="outline" className="w-full rounded-lg mt-2" onClick={() => verify()}>
            Done, I pasted it
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>
        </div>
      )}

      <div className="flex justify-center pt-1">
        <button
          onClick={cancel}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Connected View ─────────────────────────────────────────────────────

function ConnectedView({ onClose }: { onClose: () => void }) {
  const remove = useDeleteProvider()

  const handleDisconnect = async () => {
    try {
      await remove.mutateAsync({ provider: 'openai' })
      toast.success('ChatGPT disconnected')
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to disconnect'))
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2.5">
          <div className="size-7 shrink-0 flex items-center justify-center">
            <Image
              src="/OpenAI-logo.svg"
              alt=""
              width={28}
              height={28}
              className="shrink-0 w-7 h-7"
            />
          </div>
          <p className="text-lg font-semibold">ChatGPT Connected</p>
        </div>
        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
          Your subscription is active — no extra AI costs.
        </p>
      </div>

      <div className="rounded-lg bg-muted/40 border border-border/40 px-4 py-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          All OpenAI model requests route through your ChatGPT Plus/Pro subscription.
        </p>
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          onClick={handleDisconnect}
          disabled={remove.isPending}
          className="text-sm text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
        >
          {remove.isPending ? 'Disconnecting...' : 'Disconnect'}
        </button>
        <Button variant="outline" className="rounded-lg" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
}

// ─── Connect Button (Header Trigger) ────────────────────────────────────

export function ChatgptConnect() {
  const [open, setOpen] = useState(false)
  const { data: rows } = useProvidersQuery()
  const isConnected =
    rows?.some((r) => r.provider === 'openai' && r.authType === 'chatgpt') ?? false

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(true)}
            className="relative flex items-center gap-2 h-9 px-3 rounded-md border border-border/60 bg-background hover:bg-muted/60 transition-colors text-[13px] font-medium"
          >
            <span className="flex shrink-0 items-center justify-center w-5 h-5">
              <Image src="/OpenAI-logo.svg" alt="" width={20} height={20} className="w-5 h-5" />
            </span>
            <span className="hidden sm:inline whitespace-nowrap">
              {isConnected ? 'ChatGPT' : 'Connect ChatGPT'}
            </span>
            {isConnected && <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {isConnected
            ? 'ChatGPT subscription connected — $0 AI usage'
            : 'Use your ChatGPT Plus/Pro subscription'}
        </TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[420px] p-0 gap-0 rounded-2xl overflow-hidden border-border/50">
          {isConnected ? (
            <ConnectedView onClose={() => setOpen(false)} />
          ) : (
            <ChatgptAuthFlow onClose={() => setOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
