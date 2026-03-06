'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Copy,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Variable,
  Loader2,
} from 'lucide-react'
import { toast } from 'react-hot-toast'

import {
  useEnvVarsQuery,
  useUpsertEnvVar,
  useDeleteEnvVar,
  type EnvVarItem,
} from '@/queries/projects'
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
import { cn } from '@/lib/utils'

type Environment = 'development' | 'production'

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      title="Copy value"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  )
}

function EnvVarRow({
  envVar,
  projectId,
  environment,
  revealed: globalRevealed,
}: {
  envVar: EnvVarItem
  projectId: string
  environment: Environment
  revealed: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const upsert = useUpsertEnvVar()
  const remove = useDeleteEnvVar()

  // Sync local expanded state with global reveal toggle
  useEffect(() => {
    setExpanded(globalRevealed)
  }, [globalRevealed])

  useEffect(() => {
    if (editing) {
      // Small delay so the input is rendered before we focus
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [editing])

  const handleEdit = () => {
    setEditValue(envVar.value ?? '')
    setEditing(true)
  }

  const handleSave = async () => {
    if (!editValue) {
      toast.error('Value is required')
      return
    }
    try {
      await upsert.mutateAsync({
        id: projectId,
        environment,
        key: envVar.key,
        value: editValue,
        destination: 'server',
      })
      toast.success(`Updated ${envVar.key}`)
      setEditing(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to update')
    }
  }

  const handleDelete = async () => {
    try {
      await remove.mutateAsync({ id: projectId, environment, key: envVar.key })
      toast.success(`Deleted ${envVar.key}`)
      setDeleteOpen(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete')
    }
  }

  const hasValue = envVar.value != null && envVar.value !== ''
  const displayValue = envVar.value ?? ''

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-accent/40 rounded-lg border border-border/60">
        <code className="text-[13px] font-medium font-mono w-[40%] shrink-0 truncate">
          {envVar.key}
        </code>
        <div className="flex-1 min-w-0">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="Enter value..."
            className="h-7 text-[13px] font-mono"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && editValue) handleSave()
              if (e.key === 'Escape') setEditing(false)
            }}
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleSave}
            disabled={upsert.isPending || !editValue}
          >
            {upsert.isPending ? <Loader2 className="size-3 animate-spin" /> : 'Save'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div>
        <div
          className="group flex items-center gap-2 px-4 py-2.5 hover:bg-accent/30 transition-colors cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronRight
            className={cn(
              'size-3.5 text-muted-foreground/60 transition-transform duration-200 shrink-0',
              expanded && 'rotate-90',
            )}
          />
          <code className="text-[13px] font-medium font-mono flex-1 truncate">{envVar.key}</code>
          <div
            className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {hasValue && <CopyButton value={displayValue} />}
            <button
              type="button"
              onClick={handleEdit}
              title="Edit value"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <span className="text-xs font-medium">Edit</span>
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              title="Delete variable"
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
        {expanded && (
          <div className="px-4 pb-3 pl-10 pr-4">
            {hasValue ? (
              <div className="rounded-md bg-muted/60 border border-border/40 px-3 py-2 overflow-x-auto">
                <pre className="text-[13px] text-muted-foreground font-mono whitespace-pre m-0">
                  {displayValue}
                </pre>
              </div>
            ) : (
              <span className="text-[13px] text-muted-foreground/40 italic">
                Set but hidden — restart your server
              </span>
            )}
          </div>
        )}
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Variable</DialogTitle>
            <DialogDescription>
              Delete <code className="font-semibold text-foreground">{envVar.key}</code> from{' '}
              {environment}? This will also remove it from synced services.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={remove.isPending}>
              {remove.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function AddEnvVarForm({
  projectId,
  environment,
  onDone,
}: {
  projectId: string
  environment: Environment
  onDone: () => void
}) {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const keyRef = useRef<HTMLInputElement>(null)
  const upsert = useUpsertEnvVar()

  useEffect(() => {
    requestAnimationFrame(() => keyRef.current?.focus())
  }, [])

  const handleSubmit = async () => {
    const trimmedKey = key.trim()
    if (!trimmedKey || !value) {
      toast.error('Key and value are required')
      return
    }
    try {
      await upsert.mutateAsync({
        id: projectId,
        environment,
        key: trimmedKey,
        value,
        destination: 'server',
      })
      toast.success(`Added ${trimmedKey}`)
      setKey('')
      setValue('')
      onDone()
    } catch (err: any) {
      toast.error(err.message || 'Failed to add variable')
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-accent/40 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Key
          </label>
          <Input
            ref={keyRef}
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
            placeholder="DATABASE_URL"
            className="h-8 text-[13px] font-mono"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onDone()
            }}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Value
          </label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="your-secret-value"
            className="h-8 text-[13px] font-mono"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && key.trim() && value) handleSubmit()
              if (e.key === 'Escape') onDone()
            }}
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={upsert.isPending || !key.trim() || !value}
        >
          {upsert.isPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Adding...
            </>
          ) : (
            'Add Variable'
          )}
        </Button>
      </div>
    </div>
  )
}

export function SettingsTab({ projectId }: { projectId?: string }) {
  const [environment, setEnvironment] = useState<Environment>('development')
  const [adding, setAdding] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const { data: vars, isLoading, isError, refetch } = useEnvVarsQuery(projectId, environment)

  // Reset reveal when switching environments
  const handleEnvSwitch = useCallback((env: Environment) => {
    setEnvironment(env)
    setRevealed(false)
    setAdding(false)
  }, [])

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No project selected
      </div>
    )
  }

  const hasVars = vars && vars.length > 0

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto px-6 py-6">
          {/* Header */}
          <div className="mb-6">
            <h3 className="text-[15px] font-semibold">Environment Variables</h3>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Synced to your sandbox and Convex deployment automatically.
            </p>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="inline-flex items-center rounded-lg bg-muted dark:bg-background p-1 border border-border/50 shadow-inner h-9">
              {(['development', 'production'] as const).map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => handleEnvSwitch(env)}
                  className={cn(
                    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium h-7 cursor-pointer transition-all duration-200 ease-out',
                    environment === env
                      ? 'text-foreground bg-background dark:bg-muted shadow-sm'
                      : 'text-muted-foreground hover:text-foreground bg-transparent',
                  )}
                >
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      env === 'development' ? 'bg-emerald-500' : 'bg-amber-500',
                    )}
                  />
                  {env === 'development' ? 'Development' : 'Production'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {hasVars && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => setRevealed(!revealed)}
                >
                  {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  {revealed ? 'Hide' : 'Reveal'}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setAdding(true)}
                disabled={adding}
              >
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
          </div>

          {/* Add form */}
          {adding && (
            <div className="mb-3">
              <AddEnvVarForm
                projectId={projectId}
                environment={environment}
                onDone={() => setAdding(false)}
              />
            </div>
          )}

          {/* Error state */}
          {isError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
              <p className="text-sm text-destructive">Failed to load environment variables</p>
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
          {!isLoading && !isError && !hasVars && !adding && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-3.5 mb-4">
                <Variable className="size-5 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium">No variables yet</p>
              <p className="text-[13px] text-muted-foreground mt-1 max-w-[260px]">
                Add environment variables to configure your {environment} environment.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4 gap-1.5"
                onClick={() => setAdding(true)}
              >
                <Plus className="size-3.5" />
                Add Variable
              </Button>
            </div>
          )}

          {/* Variables list */}
          {!isLoading && hasVars && (
            <div className="rounded-lg border border-border/50 divide-y divide-border/30">
              {vars.map((v) => (
                <EnvVarRow
                  key={v.key}
                  envVar={v}
                  projectId={projectId}
                  environment={environment}
                  revealed={revealed}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
