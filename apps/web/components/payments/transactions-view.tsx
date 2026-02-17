'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { ChevronDown, Filter, Loader2, Receipt, Search, X } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  formatPrice,
  formatTransactionType,
  getTransactionIcon,
  getTransactionColor,
} from './utils'
import type { Transaction, TransactionType } from '@/queries/transactions'

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const Icon = getTransactionIcon(transaction.type)
  const colorClass = getTransactionColor(transaction.type)
  const isPositive = transaction.type === 'payment'
  const date = new Date(transaction.createdAt)

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="size-8 rounded-lg bg-muted/50 grid place-items-center">
        <Icon className={cn('size-3.5', colorClass)} />
      </div>
      <div className="flex-1 min-w-0 grid grid-cols-3 gap-4 items-center">
        <div className="min-w-0">
          <p className="text-[13px] font-medium truncate">
            {formatTransactionType(transaction.type)}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">{transaction.processor}</p>
        </div>
        <div className="text-center">
          <p className="text-[12px] text-muted-foreground">{format(date, 'MMM d, yyyy')}</p>
          <p className="text-[11px] text-muted-foreground/70">{format(date, 'h:mm a')}</p>
        </div>
        <div className="text-right">
          <p className={cn('text-[13px] font-semibold tabular-nums', colorClass)}>
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
        <Loader2 className="size-5 text-muted-foreground animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="border-b">
        <div className="mx-auto flex w-full max-w-[1080px] items-center gap-2 px-5 py-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-[13px] bg-transparent border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted/60 rounded transition-colors"
              >
                <X className="size-3 text-muted-foreground" />
              </button>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 h-8 px-2.5 text-[13px] rounded-md bg-background btn-elevated hover:bg-muted/30 transition-all duration-100">
                <Filter className="size-3 text-muted-foreground" />
                {filter === 'all' ? 'All' : formatTransactionType(filter)}
                <ChevronDown className="size-3 text-muted-foreground" />
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
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-xs">
            <div className="size-12 rounded-xl bg-muted/50 border grid place-items-center mx-auto mb-4">
              <Receipt className="size-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="text-[15px] font-semibold mb-1">
              {transactions.length === 0 ? 'No transactions yet' : 'No results'}
            </h3>
            <p className="text-[13px] text-muted-foreground">
              {transactions.length === 0
                ? 'Transactions appear when customers make purchases'
                : 'Try adjusting your search or filters'}
            </p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="mx-auto w-full max-w-[1080px] p-5">
            <div className="rounded-xl border bg-card divide-y overflow-hidden">
              {filteredTransactions.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
