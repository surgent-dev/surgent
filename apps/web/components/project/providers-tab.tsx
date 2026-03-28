'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Loader2, Trash2, Key, Link2, Plus } from 'lucide-react'
import { toast } from 'sonner'

import {
  useProvidersQuery,
  useUpsertProvider,
  useDeleteProvider,
  type ProviderRow,
} from '@/queries/providers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getErrorMessage } from '@/lib/provider-oauth'

type ConnectMode = 'idle' | 'api-key'

const PROVIDERS = [
  {
    id: 'openai',
    label: 'OpenAI',
    icon: '/OpenAI-logo.svg',
    placeholder: 'sk-...',
    subscription: false,
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    icon: '/claude-logo.svg',
    placeholder: 'sk-ant-...',
    subscription: false,
  },
  {
    id: 'google',
    label: 'Google',
    icon: '/google-gemini.svg',
    placeholder: 'AIza...',
    subscription: false,
  },
] as const

type ProviderMeta = (typeof PROVIDERS)[number]

function getProviderMeta(id: string): ProviderMeta | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

function timeSince(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function ConnectedProvider({ row }: { row: ProviderRow }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const remove = useDeleteProvider()
  const meta = getProviderMeta(row.provider)

  const handleDelete = async () => {
    try {
      await remove.mutateAsync({ provider: row.provider })
      toast.success(`Disconnected ${meta?.label ?? row.provider}`)
      setDeleteOpen(false)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to disconnect'))
    }
  }

  return (
    <>
      <div className="group flex items-center gap-3 px-4 py-3">
        <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
          {meta?.icon ? (
            <Image
              src={meta.icon}
              alt=""
              width={18}
              height={18}
              className={meta.icon.includes('OpenAI') ? 'dark:invert' : ''}
            />
          ) : (
            <Key className="size-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium">{meta?.label ?? row.provider}</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Connected
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            API key · Updated {timeSince(row.updatedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
          title="Disconnect"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect {meta?.label ?? row.provider}</DialogTitle>
            <DialogDescription>
              This will remove your credentials. Requests will fall back to Surgent&apos;s shared
              pool for this provider.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={remove.isPending}>
              {remove.isPending ? 'Removing...' : 'Disconnect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ApiKeyForm({ connected, onDone }: { connected: string[]; onDone: () => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [key, setKey] = useState('')
  const upsert = useUpsertProvider()

  const available = PROVIDERS.filter((p) => !connected.includes(p.id))
  const meta = selected ? getProviderMeta(selected) : null

  const handleSave = async () => {
    if (!selected || !key.trim()) return
    try {
      await upsert.mutateAsync({ provider: selected, credentials: key.trim() })
      toast.success(`Connected ${meta?.label ?? selected}`)
      setKey('')
      setSelected(null)
      onDone()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save'))
    }
  }

  if (!selected) {
    return (
      <div className="rounded-lg border border-border/60 bg-accent/40 p-3 space-y-1">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">
          Select provider
        </p>
        {available.length === 0 ? (
          <p className="text-[13px] text-muted-foreground text-center py-4">
            All providers are connected
          </p>
        ) : (
          available.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-background transition-colors"
            >
              <div className="size-7 rounded-md bg-background border border-border/50 flex items-center justify-center shrink-0">
                <Image src={p.icon} alt="" width={16} height={16} />
              </div>
              <span className="text-[13px] font-medium">{p.label}</span>
            </button>
          ))
        )}
        <div className="flex justify-end pt-1">
          <Button size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border/60 bg-accent/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        {meta?.icon && (
          <Image
            src={meta.icon}
            alt=""
            width={18}
            height={18}
            className={meta.icon.includes('OpenAI') ? 'dark:invert' : ''}
          />
        )}
        <span className="text-[13px] font-semibold">{meta?.label}</span>
        <button
          onClick={() => {
            setSelected(null)
            setKey('')
          }}
          className="text-[11px] text-muted-foreground hover:text-foreground ml-auto"
        >
          Change
        </button>
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          API Key
        </label>
        <Input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={meta?.placeholder ?? 'Paste your API key'}
          className="h-8 text-[13px] font-mono"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && key.trim()) handleSave()
            if (e.key === 'Escape') onDone()
          }}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={upsert.isPending || !key.trim()}>
          {upsert.isPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Saving...
            </>
          ) : (
            'Connect'
          )}
        </Button>
      </div>
    </div>
  )
}

export function ProvidersTab() {
  const [mode, setMode] = useState<ConnectMode>('idle')
  const { data: rows, isLoading, isError, refetch } = useProvidersQuery()

  const connected = rows ?? []
  const connectedIds = connected.map((r) => r.provider)

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto px-6 py-6">
          {/* Header */}
          <div className="mb-6">
            <h3 className="text-[15px] font-semibold">API Keys</h3>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Bring your own API keys. Usage goes through your provider account.
            </p>
          </div>

          {/* API key flow */}
          {mode === 'api-key' && (
            <div className="mb-4">
              <ApiKeyForm connected={connectedIds} onDone={() => setMode('idle')} />
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Link2 className="size-3.5" />
              <span>{connected.length} connected</span>
            </div>
            {mode === 'idle' && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setMode('api-key')}
                disabled={connectedIds.length >= PROVIDERS.length}
              >
                <Plus className="size-3.5" />
                Add API Key
              </Button>
            )}
          </div>

          {/* Error state */}
          {isError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
              <p className="text-sm text-destructive">Failed to load providers</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-5 text-muted-foreground animate-spin" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !isError && connected.length === 0 && mode === 'idle' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-3.5 mb-4">
                <Key className="size-5 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium">No providers connected</p>
              <p className="text-[13px] text-muted-foreground mt-1 max-w-[280px]">
                Add API keys to use your own provider billing.
              </p>
            </div>
          )}

          {/* Connected providers */}
          {!isLoading && connected.length > 0 && (
            <div className="rounded-lg border border-border/50 divide-y divide-border/30">
              {connected.map((row) => (
                <ConnectedProvider key={row.id} row={row} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
