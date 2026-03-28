'use client'

import { CreditCard } from '@phosphor-icons/react'
import { Sparkline } from '@/components/ui/sparkline'
import { getPaymentSummary } from '@/components/payments/summary'
import { formatPrice } from '@/components/payments/utils'
import { useSurpayAccounts } from '@/queries/surpay'
import { useTransactions } from '@/queries/transactions'
import { DashboardCard } from './dashboard-card'

const flatData = Array.from({ length: 12 }, () => ({ y: 0 }))

function transactionLabel(count: number) {
  if (count === 1) return '1 transaction'
  return `${count} transactions`
}

export function PaymentsCard({ projectId, href }: { projectId: string; href: string }) {
  const { data: accounts } = useSurpayAccounts()
  const { data: transactionsData } = useTransactions(projectId)

  const connected = Boolean(accounts?.find((a) => a.status === 'connected'))
  const summary = getPaymentSummary(transactionsData?.transactions ?? [], [])
  const amount = connected ? formatPrice(summary.grossRevenue, summary.currency) : '$0'
  const detail = connected
    ? `${transactionLabel(summary.paymentCount)} · last 30 days`
    : '0 transactions'

  return (
    <DashboardCard
      title="Payments"
      icon={CreditCard}
      href={href}
      action={connected ? 'Manage' : 'Set up'}
      headerRight={
        connected ? (
          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-px">
            Connected
          </span>
        ) : undefined
      }
    >
      <div className="flex-1 grid grid-rows-1 grid-cols-1 min-h-[140px]">
        <div className="row-start-1 col-start-1 self-end h-20 pointer-events-none">
          <Sparkline data={flatData} />
        </div>
        <div className="row-start-1 col-start-1 flex items-center justify-center z-10">
          <div className="text-center">
            <p className="text-3xl font-semibold tabular-nums">{amount}</p>
            <p className="text-xs text-muted-foreground mt-1">{detail}</p>
          </div>
        </div>
      </div>
    </DashboardCard>
  )
}
