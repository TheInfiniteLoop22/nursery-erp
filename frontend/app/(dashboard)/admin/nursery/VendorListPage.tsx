'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Leaf, Plus, ChevronRight, Trees, Mail, Phone, Search } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card'
import { PaginationControls } from '@/app/components/ui/PaginationControls'
import { nurseries as nurseriesApi } from '@/app/lib/api'
import type { Nursery } from '@/app/lib/types'

interface VendorSummary {
  total_vendors: number
  total_products: number
  total_inventory: number
  total_ordered_quantity: number
}

const DEFAULT_SUMMARY: VendorSummary = {
  total_vendors: 0,
  total_products: 0,
  total_inventory: 0,
  total_ordered_quantity: 0,
}

export function VendorListPage({ basePath }: { basePath: string }) {
  const [nurseries, setNurseries] = useState<Nursery[]>([])
  const [summary, setSummary] = useState<VendorSummary>(DEFAULT_SUMMARY)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(12)
  const [totalVendors, setTotalVendors] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
      setCurrentPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  const fetchVendors = useCallback(async () => {
    try {
      const [response, summaryResponse] = await Promise.all([
        nurseriesApi.list({
          page: currentPage,
          page_size: itemsPerPage,
          search: debouncedSearch || undefined,
        }),
        nurseriesApi.getSummary({
          search: debouncedSearch || undefined,
        }),
      ])

      setNurseries(response.items as Nursery[])
      setTotalVendors(response.total)
      setTotalPages(response.total_pages)
      setSummary(summaryResponse)
    } catch (error: unknown) {
      console.error('Failed to load nurseries:', error)
      const message = error instanceof Error ? error.message : 'Failed to load vendors'
      toast.error(message)
    }
  }, [currentPage, debouncedSearch, itemsPerPage])

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      await fetchVendors()
      setIsLoading(false)
    }
    load()
  }, [fetchVendors])

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#1F764D] border-t-transparent" />
          <p className="text-gray-600">Loading vendors...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-8 animate-fade-in">
      <section className="rounded-3xl bg-linear-to-r from-[#13452D] to-[#1F764D] p-5 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
              <Leaf className="h-4 w-4" />
              Vendor management
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Vendors</h1>
              <p className="mt-2 max-w-xl text-sm sm:text-lg text-white/85">
                Browse vendor cards, open a vendor for full stats and products, or add a new vendor with optional contact info.
              </p>
            </div>
          </div>
          <Link href={`${basePath}/create`} className="w-full max-w-xs shrink-0">
            <Button type="button" className="h-12 w-full bg-white text-[#13452D] hover:bg-white/90">
              <Plus className="mr-2 h-4 w-4" />
              Add vendor
            </Button>
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total vendors</CardDescription>
            <CardTitle className="text-3xl sm:text-4xl font-black text-[#13452D]">{summary.total_vendors}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total plant types</CardDescription>
            <CardTitle className="text-3xl sm:text-4xl font-black text-[#13452D]">{summary.total_products}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Inventory across vendors</CardDescription>
            <CardTitle className="text-3xl sm:text-4xl font-black text-[#13452D]">{summary.total_inventory}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by vendor name, ID, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F764D] focus:border-transparent transition-all text-black"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900">Vendor cards</h2>
          <p className="text-sm text-gray-500">Click a card to open details, stats, and editing.</p>
        </div>
        <div className="shrink-0 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
          {summary.total_ordered_quantity} units ordered in total
        </div>
      </div>

      {nurseries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
          <Trees className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-lg font-semibold text-gray-900">No vendors found</p>
          <p className="mt-1 text-sm text-gray-600">
            {searchQuery
              ? 'No vendors match your search. Try a different name or contact detail.'
              : 'Create your first vendor to attach products and work orders.'}
          </p>
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-6 px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
            >
              Clear search
            </button>
          ) : (
            <Link href={`${basePath}/create`} className="mt-6 inline-block">
              <Button className="bg-[#13452D] hover:bg-[#0f3522]">
                <Plus className="mr-2 h-4 w-4" />
                Add vendor
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
          {nurseries.map((nursery) => (
            <Link
              key={nursery.nursery_id}
              href={`${basePath}/${nursery.nursery_id}`}
              className="group min-w-0 rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-[#1F764D] hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">Vendor</p>
                  <h3 className="mt-1 text-lg sm:text-xl font-black text-gray-900 wrap-break-word group-hover:text-[#1F764D]">
                    {nursery.nursery_name}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-gray-500">
                    {nursery.contact_email ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate max-w-[200px]">{nursery.contact_email}</span>
                      </span>
                    ) : null}
                    {nursery.contact_phone ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {nursery.contact_phone}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0 rounded-2xl bg-[#13452D] p-3 text-white">
                  <Trees className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 grid min-w-0 grid-cols-2 gap-3 text-sm">
                <div className="min-w-0 rounded-xl bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500 wrap-break-word">Plant types</p>
                  <p className="mt-1 text-xl font-black text-gray-900">{nursery.products_count || 0}</p>
                </div>
                <div className="min-w-0 rounded-xl bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500 wrap-break-word">Inventory</p>
                  <p className="mt-1 text-xl font-black text-gray-900">{nursery.total_inventory || 0}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <span>{nursery.total_ordered_quantity || 0} units bought</span>
                <ChevronRight className="h-4 w-4 text-[#1F764D]" />
              </div>

              {nursery.featured_products && nursery.featured_products.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {nursery.featured_products.slice(0, 3).map((product) => (
                    <span
                      key={product}
                      className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                    >
                      {product}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalVendors}
        pageSize={itemsPerPage}
        itemLabel="vendors"
        pageSizeOptions={[12, 24, 48]}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setItemsPerPage(size)
          setCurrentPage(1)
        }}
        isLoading={isRefreshing}
      />
    </div>
  )
}
