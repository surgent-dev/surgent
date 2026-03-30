'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Circle, Loader2, XCircle, ArrowRight, ExternalLink } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { BrandLogo } from '@/components/brand-logo'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { usePurchaseQuery } from '@/queries/purchases'

const STEPS = [
  { key: 'projectCreatedAt', label: 'Creating project' },
  { key: 'sandboxProvisionedAt', label: 'Provisioning sandbox' },
  { key: 'codebaseRestoredAt', label: 'Restoring codebase' },
  { key: 'integrationsProvisionedAt', label: 'Setting up integrations' },
  { key: 'envVarsSetAt', label: 'Configuring environment' },
  { key: 'devServerStartedAt', label: 'Installing dependencies' },
  { key: 'finalizedAt', label: 'Finalizing' },
] as const

function StepIcon({ done, active, failed }: { done: boolean; active: boolean; failed: boolean }) {
  if (failed) return <XCircle className="size-4 text-red-500 shrink-0" />
  if (done) return <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
  if (active) return <Loader2 className="size-4 text-blue-500 animate-spin shrink-0" />
  return <Circle className="size-4 text-muted-foreground/30 shrink-0" />
}

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [user, setUser] = useState<{ name: string; email: string; image?: string } | null>(null)
  const { data: purchase, isLoading, error } = usePurchaseQuery(id)

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (!data?.user) {
        router.push('/login')
        return
      }
      setUser(data.user as any)
    })
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="w-full px-6 h-14 flex items-center border-b">
          <div className="max-w-3xl mx-auto w-full flex items-center gap-3">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-24" />
          </div>
        </header>
        <main className="max-w-3xl mx-auto py-10 px-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-md" />
          ))}
        </main>
      </div>
    )
  }

  if (error || !purchase) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">Purchase not found</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/marketplace/purchases')}>
          Back to Purchases
        </Button>
      </div>
    )
  }

  const fulfillment = purchase.fulfillment || {}
  const isFailed = purchase.status === 'failed'
  const isFulfilled = purchase.status === 'fulfilled'
  const isActive = purchase.status === 'pending' || purchase.status === 'provisioning'

  // Find the current active step (first one without a timestamp)
  const activeStepIndex = STEPS.findIndex(
    (step) => !fulfillment[step.key as keyof typeof fulfillment],
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full px-6 h-14 flex items-center border-b">
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <BrandLogo />
            </Link>
            <span className="text-border shrink-0">/</span>
            <Link
              href="/marketplace/purchases"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Purchases
            </Link>
            <span className="text-border shrink-0">/</span>
            <span className="text-sm font-medium truncate">{id?.slice(0, 8)}</span>
          </div>
          {user && (
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={user.image} />
              <AvatarFallback className="text-xs bg-muted">
                {user.name?.charAt(0) || user.email?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto py-10 px-6">
        {/* Status banner */}
        {isFulfilled && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 mb-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    Your app is ready!
                  </p>
                  <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70 mt-0.5">
                    Your copy has been set up with its own sandbox and environment.
                  </p>
                </div>
              </div>
              {purchase.projectId && (
                <Button asChild size="sm" className="h-8 text-xs shrink-0">
                  <Link href={`/project/${purchase.projectId}`}>
                    Open Project
                    <ArrowRight className="size-3.5 ml-1.5" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}

        {isFailed && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 mb-6">
            <div className="flex items-center gap-3">
              <XCircle className="size-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">Setup failed</p>
                <p className="text-xs text-red-600/70 dark:text-red-500/70 mt-0.5">
                  {purchase.error || fulfillment.lastError || 'An error occurred during setup.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {isActive && (
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 mb-6">
            <div className="flex items-center gap-3">
              <Loader2 className="size-5 text-blue-500 animate-spin shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  Setting up your app...
                </p>
                <p className="text-xs text-blue-600/70 dark:text-blue-500/70 mt-0.5">
                  This usually takes 1-2 minutes. This page updates automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress steps */}
        <h2 className="text-sm font-medium text-muted-foreground mb-4">Setup Progress</h2>
        <div className="space-y-1">
          {STEPS.map((step, i) => {
            const done = Boolean(fulfillment[step.key as keyof typeof fulfillment])
            const active = isActive && i === activeStepIndex
            const failed = isFailed && i === activeStepIndex

            return (
              <div
                key={step.key}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${
                  active ? 'bg-blue-500/5' : done ? 'bg-muted/30' : ''
                }`}
              >
                <StepIcon done={done} active={active} failed={failed} />
                <span
                  className={`text-sm ${
                    done
                      ? 'text-foreground'
                      : active
                        ? 'text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-muted-foreground/50'
                  }`}
                >
                  {step.label}
                </span>
                {done && (
                  <span className="ml-auto text-[10px] text-muted-foreground/40 tabular-nums">
                    Done
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center gap-3">
          {isFulfilled && purchase.projectId && (
            <Button asChild size="sm" className="h-9 text-xs">
              <Link href={`/project/${purchase.projectId}`}>
                Open Project
                <ExternalLink className="size-3.5 ml-1.5" />
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="h-9 text-xs">
            <Link href="/marketplace/purchases">All Purchases</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
