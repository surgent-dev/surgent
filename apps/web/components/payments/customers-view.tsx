'use client'

import { useState, useMemo } from 'react'
import { ChevronRight, Loader2, Search, Users, X } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Customer } from '@/queries/customers'
import { CustomerDetailSheet } from './customer-detail-sheet'

function CustomerRow({ customer, onClick }: { customer: Customer; onClick: () => void }) {
  const initial = (customer.name?.[0] || customer.email?.[0] || '?').toUpperCase()

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
    >
      <div className="size-8 rounded-full bg-muted/60 flex items-center justify-center">
        <span className="text-xs font-medium text-muted-foreground">{initial}</span>
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{customer.name || 'No name'}</p>
          <p className="text-xs text-muted-foreground truncate">{customer.email || 'No email'}</p>
        </div>
        <div className="flex items-center gap-2">
          {customer.externalId && (
            <code className="text-[10px] text-muted-foreground/70 font-mono">
              {customer.externalId}
            </code>
          )}
          <ChevronRight className="size-3.5 text-muted-foreground/50 shrink-0" />
        </div>
      </div>
    </button>
  )
}

interface CustomersViewProps {
  customers: Customer[]
  isLoading: boolean
  projectId: string
}

export function CustomersView({ customers, isLoading, projectId }: CustomersViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers
    const query = searchQuery.toLowerCase()
    return customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.externalId?.toLowerCase().includes(query) ||
        c.id.toLowerCase().includes(query),
    )
  }, [customers, searchQuery])

  const handleRowClick = (customer: Customer) => {
    setSelectedCustomer(customer)
    setDetailOpen(true)
  }

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
        <div className="mx-auto w-full max-w-[1080px] px-5 py-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-sm bg-transparent border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
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
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-xs">
            <div className="size-12 rounded-xl bg-muted/50 border grid place-items-center mx-auto mb-4">
              <Users className="size-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-semibold mb-1">
              {customers.length === 0 ? 'No customers yet' : 'No results'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {customers.length === 0
                ? 'Customers appear when they make a purchase'
                : 'Try adjusting your search'}
            </p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="mx-auto w-full max-w-[1080px] p-5">
            <div className="rounded-xl border bg-card divide-y overflow-hidden">
              {filteredCustomers.map((customer) => (
                <CustomerRow
                  key={customer.id}
                  customer={customer}
                  onClick={() => handleRowClick(customer)}
                />
              ))}
            </div>
          </div>
        </ScrollArea>
      )}

      <CustomerDetailSheet
        customer={selectedCustomer}
        projectId={projectId}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setSelectedCustomer(null)
        }}
      />
    </div>
  )
}
