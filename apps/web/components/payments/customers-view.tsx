'use client'

import { useState, useMemo } from 'react'
import { Loader2, Search, Users, X } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Customer } from '@/queries/customers'

function CustomerRow({ customer }: { customer: Customer }) {
  const initial = (customer.name?.[0] || customer.email?.[0] || '?').toUpperCase()

  return (
    <div className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors">
      <div className="size-9 rounded-full bg-muted flex items-center justify-center">
        <span className="text-sm font-medium text-muted-foreground">{initial}</span>
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-between">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{customer.name || 'No name'}</p>
          <p className="text-xs text-muted-foreground truncate">{customer.email || 'No email'}</p>
        </div>
        {customer.externalId && (
          <code className="text-[10px] text-muted-foreground font-mono">{customer.externalId}</code>
        )}
      </div>
    </div>
  )
}

interface CustomersViewProps {
  customers: Customer[]
  isLoading: boolean
}

export function CustomersView({ customers, isLoading }: CustomersViewProps) {
  const [searchQuery, setSearchQuery] = useState('')

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

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="size-8 text-muted-foreground animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading customers...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-3 border-b">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search customers..."
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
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="rounded-2xl bg-muted/50 p-5 inline-block mb-4">
              <Users className="size-10 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              {customers.length === 0 ? 'No customers yet' : 'No matching customers'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {customers.length === 0
                ? 'Customers will appear here once they make a purchase'
                : 'Try adjusting your search'}
            </p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {filteredCustomers.map((customer) => (
              <CustomerRow key={customer.id} customer={customer} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
