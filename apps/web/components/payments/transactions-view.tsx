'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  Filter,
  Loader2,
  Receipt,
  Search,
  X,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { formatPrice, formatTransactionType } from './utils'
import type { Transaction, TransactionType } from '@/queries/transactions'

const getTransactionIcon = (type: TransactionType) => {
  switch (type) {
    case 'payment':
      return ArrowDownRight
    case 'refund':
    case 'payout':
      return ArrowUpRight
    default:
      return Receipt
  }
}

const getTransactionColor = (type: TransactionType) => {
  switch (type) {
    case 'payment':
      return 'text-emerald-500'
    case 'refund':
    case 'dispute':
      return 'text-red-500'
    case 'payout':
      return 'text-blue-500'
    default:
      return 'text-muted-foreground'
  }
}

const getTransactionBg = (type: TransactionType) => {
  switch (type) {
    case 'payment':
      return 'bg-emerald-500/10'
    case 'refund':
    case 'dispute':
      return 'bg-red-500/10'
    case 'payout':
      return 'bg-blue-500/10'
    default:
      return 'bg-muted'
  }
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const Icon = getTransactionIcon(transaction.type)
  const colorClass = getTransactionColor(transaction.type)
  const bgClass = getTransactionBg(transaction.type)
  const isPositive = transaction.type === 'payment'
  const date = new Date(transaction.createdAt)

  return (
    <div className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors">
      <div className={cn('rounded-lg p-2.5', bgClass)}>
        <Icon className={cn('size-4', colorClass)} />
      </div>
      <div className="flex-1 min-w-0 grid grid-cols-3 gap-4 items-center">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{formatTransactionType(transaction.type)}</p>
          <p className="text-xs text-muted-foreground truncate">{transaction.processor}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">{format(date, 'MMM d, yyyy')}</p>
          <p className="text-xs text-muted-foreground">{format(date, 'h:mm a')}</p>
        </div>
        <div className="text-right">
          <p className={cn('font-semibold tabular-nums', colorClass)}>
            {isPositive ? '+' : '-'}
            {formatPrice(Math.abs(transaction.amount), transaction.currency)}
          </p>
        </div>
      </div>
    </div>
  )
}

interface TransactionsViewProps {
  transactions: Transaction[]
  isLoading: boolean
}

export function TransactionsView({ transactions, isLoading }: TransactionsViewProps) {
  const [filter, setFilter] = useState<TransactionType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (filter !== 'all' && t.type !== filter) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return t.id.toLowerCase().includes(query) || t.processor.toLowerCase().includes(query)
      }
      return true
    })
  }, [transactions, filter, searchQuery])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="size-8 text-muted-foreground animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading transactions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-3 border-b flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-sm bg-muted/50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
            >
              <X className="size-3 text-muted-foreground" />
            </button>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 h-9 px-3 text-sm border rounded-lg hover:bg-muted/50 transition-colors">
              <Filter className="size-3.5 text-muted-foreground" />
              {filter === 'all' ? 'All Types' : formatTransactionType(filter)}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setFilter('all')}>All Types</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setFilter('payment')}>Payments</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter('refund')}>Refunds</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter('payout')}>Payouts</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="rounded-2xl bg-muted/50 p-5 inline-block mb-4">
              <Receipt className="size-10 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              {transactions.length === 0 ? 'No transactions yet' : 'No matching transactions'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {transactions.length === 0
                ? 'Transactions will appear here once customers start making purchases'
                : 'Try adjusting your search or filters'}
            </p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {filteredTransactions.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
