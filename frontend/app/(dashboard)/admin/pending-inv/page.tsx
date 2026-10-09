'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Printer,
  Package,
  Clock3,
  User,
  Search,
  Leaf,
  Barcode,
  AlertCircle,
  Filter,
  ChevronDown,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { PaginationControls } from '@/app/components/ui/PaginationControls'
import { products as productsApi, nurseries as nurseriesApi } from '@/app/lib/api'
import { printBarcode } from '@/app/lib/barcodePrinter'
import { formatDateTime } from '@/app/lib/utils'
import { buildSizeLabel } from '@/app/lib/size'
import {
  barcodeCountForProduct,
  getProductSectionLabel,
  normalizeProductSection,
} from '@/app/lib/productCategory'
import { getZoneDisplayLabel } from '@/app/lib/zone'

interface ProductSubmission {
  submission_id: string
  employee_id: string
  employee_username: string
  nursery_id: string
  item_name: string
  section: string
  zones: number
  subzone?: string | null
  size: string
  height_feet: string
  caliper_inches: string
  gallons?: string | null
  inventory_quantity: number
  status: string
  approved_product_id?: string | null
  barcode_status: string
  created_at: string
  updated_at: string
}

interface Nursery {
  nursery_id: string
  nursery_name: string
}

function sectionBadgeClass(section: string) {
  const normalized = normalizeProductSection(section)
  if (normalized === 'shrubs') return 'bg-emerald-200/90 text-emerald-900'
  if (normalized === 'perennials') return 'bg-violet-200/90 text-violet-900'
  return 'bg-blue-200/90 text-blue-900'
}

export default function AdminPendingInvPage() {
  const [items, setItems] = useState<ProductSubmission[]>([])
  const [nurseries, setNurseries] = useState<Nursery[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activePrintId, setActivePrintId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNurseries, setSelectedNurseries] = useState<string[]>([])
  const [selectedPlantTypes, setSelectedPlantTypes] = useState<Array<'tree' | 'shrubs' | 'perennials'>>([])
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  const fetchPage = useCallback(async () => {
    return productsApi.getPendingBarcodeSubmissions({
      page,
      page_size: pageSize,
      search: searchQuery || undefined,
      nursery_ids: selectedNurseries,
      sections: selectedPlantTypes,
    })
  }, [page, pageSize, searchQuery, selectedNurseries, selectedPlantTypes])

  const loadItems = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await fetchPage()
      setItems(data.items)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load pending inventory'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [fetchPage])

  useEffect(() => {
    const loadNurseries = async () => {
      try {
        const data = await nurseriesApi.getAll()
        setNurseries(data)
      } catch (error: unknown) {
        console.error('Error fetching nurseries:', error)
      }
    }
    void loadNurseries()
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleNurseryFilter = (nurseryId: string) => {
    setSelectedNurseries((prev) =>
      prev.includes(nurseryId) ? prev.filter((id) => id !== nurseryId) : [...prev, nurseryId]
    )
    setPage(1)
  }

  const togglePlantTypeFilter = (type: 'tree' | 'shrubs' | 'perennials') => {
    setSelectedPlantTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
    )
    setPage(1)
  }

  const clearFilters = () => {
    setSelectedNurseries([])
    setSelectedPlantTypes([])
    setPage(1)
    setShowFilterDropdown(false)
  }

  const hasActiveFilters =
    searchQuery.trim().length > 0 || selectedNurseries.length > 0 || selectedPlantTypes.length > 0

  const getNurseryName = (nurseryId: string) =>
    nurseries.find((n) => n.nursery_id === nurseryId)?.nursery_name || nurseryId

  const handlePrint = async (item: ProductSubmission) => {
    if (!item.approved_product_id) {
      toast.error('Approved product is missing for this item')
      return
    }

    const requestedQuantity = parseInt(String(item.inventory_quantity), 10)
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      toast.error('Invalid quantity for printing')
      return
    }

    const quantity = barcodeCountForProduct(item.section, requestedQuantity)
    if (quantity <= 0) {
      toast.error('No barcode quantity available to print')
      return
    }

    setActivePrintId(item.submission_id)
    const printWindow = window.open('', '_blank')
    try {
      toast.info(`Preparing to print ${quantity} barcode(s)...`)
      await printBarcode(item.approved_product_id, item.item_name, quantity, printWindow, {
        section: item.section,
        height: item.height_feet,
        caliper: item.caliper_inches,
        gallons: item.gallons,
      })
      await productsApi.updateSubmissionBarcodeStatus(item.submission_id, 'PRINTED_BY_ADMIN')
      toast.success(`Printed ${quantity} barcode(s). Product is now live in inventory.`)
      await loadItems()
    } catch (error: unknown) {
      printWindow?.close()
      const message = error instanceof Error ? error.message : 'Failed to print barcode'
      toast.error(message)
    } finally {
      setActivePrintId(null)
    }
  }

  if (isLoading && items.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
        <div className="h-14 rounded-2xl bg-gray-100 animate-pulse" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-72 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      <div className="rounded-2xl bg-linear-to-r from-[#13452D] to-[#1F764D] p-5 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/75">Awaiting barcode labels</p>
            <h1 className="mt-1 text-3xl sm:text-4xl font-bold">Pending Inv</h1>
            <p className="mt-2 max-w-2xl text-sm sm:text-base text-white/90">
              Approved products hidden from Live Inv until an admin or nursery prints labels. Only one party can print each item.
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-center backdrop-blur-sm">
            <p className="text-3xl font-black">{total}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Pending items</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full lg:flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, height, caliper, or size..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#1F764D] transition-colors text-gray-900"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 lg:flex lg:items-center lg:gap-2 lg:shrink-0">
            <button
              type="button"
              onClick={() => togglePlantTypeFilter('tree')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                selectedPlantTypes.includes('tree')
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              Trees
            </button>
            <button
              type="button"
              onClick={() => togglePlantTypeFilter('shrubs')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                selectedPlantTypes.includes('shrubs')
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Shrubs
            </button>
            <button
              type="button"
              onClick={() => togglePlantTypeFilter('perennials')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                selectedPlantTypes.includes('perennials')
                  ? 'bg-violet-600 text-white'
                  : 'bg-violet-50 text-violet-800 hover:bg-violet-100'
              }`}
            >
              Perennials
            </button>
          </div>

          <div className="relative w-full lg:w-auto lg:shrink-0" ref={filterRef}>
            <button
              type="button"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`flex w-full lg:w-auto items-center justify-between lg:justify-start gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                selectedNurseries.length > 0
                  ? 'bg-linear-to-br from-[#13452D] to-[#1F764D] text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md'
              }`}
            >
              <Filter className="h-4 w-4" />
              <span>
                {selectedNurseries.length === 0
                  ? 'Filter by Vendor'
                  : `${selectedNurseries.length} Vendor${selectedNurseries.length > 1 ? 's' : ''} Selected`}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`}
              />
            </button>

            {showFilterDropdown && (
              <div className="absolute top-full left-0 right-0 lg:right-auto mt-2 w-full lg:w-80 bg-white rounded-xl shadow-2xl border-2 border-gray-200 z-50 max-h-96 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-linear-to-r from-[#13452D]/5 to-[#1F764D]/5">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Select Vendors
                  </h3>
                  {selectedNurseries.length > 0 && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                    >
                      <X className="h-3 w-3" />
                      Clear
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {nurseries.map((nursery) => {
                    const isSelected = selectedNurseries.includes(nursery.nursery_id)
                    return (
                      <label
                        key={nursery.nursery_id}
                        className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleNurseryFilter(nursery.nursery_id)}
                          className="w-5 h-5 rounded border-2 border-gray-300 text-[#1F764D] focus:ring-2 focus:ring-[#1F764D]/50 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{nursery.nursery_name}</div>
                        </div>
                        {isSelected && <div className="w-2 h-2 bg-[#1F764D] rounded-full" />}
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 sm:p-16 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
            <Package className="h-8 w-8 text-amber-600" />
          </div>
          <p className="mt-5 text-xl font-bold text-gray-900">No pending inventory</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
            {hasActiveFilters
              ? 'No items match your filters.'
              : 'All approved products have printed barcodes and appear in Live Inv.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                clearFilters()
              }}
              className="mt-4 px-5 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
            {items.map((item) => {
              const awaitingNursery = item.barcode_status === 'PENDING_NURSERY_PRINT'
              const labelCount = barcodeCountForProduct(item.section, item.inventory_quantity)
              const isPrinting = activePrintId === item.submission_id

              return (
                <article
                  key={item.submission_id}
                  className="group overflow-hidden rounded-2xl border-2 border-gray-100 bg-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:border-[#1F764D]/40 hover:shadow-xl"
                >
                  <div className="grid grid-cols-1 md:grid-cols-5">
                    {/* Left panel — same green as Live Inv */}
                    <div className="md:col-span-2 flex flex-col justify-between bg-linear-to-br from-[#13452D] to-[#1F764D] p-4 sm:p-6 text-white">
                      <div>
                        <div className="mb-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${sectionBadgeClass(item.section)}`}
                          >
                            {getProductSectionLabel(item.section)}
                          </span>
                        </div>
                        <h2 className="text-base font-bold leading-tight wrap-break-word sm:text-lg">
                          {item.item_name}
                        </h2>
                        <p className="mt-1.5 text-sm text-white/80">
                          {getZoneDisplayLabel(item.zones, item.subzone || null)}
                        </p>
                        <p className="text-sm font-medium text-white/80">
                          {item.size || buildSizeLabel(item.height_feet, item.caliper_inches)}
                        </p>
                        <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
                          <Leaf className="h-4 w-4 shrink-0 text-white/70" />
                          <span className="truncate text-xs font-medium">{getNurseryName(item.nursery_id)}</span>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2">
                          <Barcode className="h-4 w-4 shrink-0 text-white/90" />
                          <span className="text-xs font-medium text-white/90">Barcode pending</span>
                        </div>
                        <div>
                          <p className="mb-1 text-xs text-white/70">Product ID</p>
                          <p className="rounded bg-white/15 px-2 py-1 font-mono text-xs text-white/95">
                            {item.approved_product_id?.slice(-8)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Right panel */}
                    <div className="md:col-span-3 flex flex-col p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                            awaitingNursery
                              ? 'bg-blue-50 text-blue-800 ring-1 ring-blue-200'
                              : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                          }`}
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          {awaitingNursery ? 'Nursery assigned' : 'Awaiting print'}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-linear-to-r from-green-50 to-green-100/50 p-3 ring-1 ring-green-100">
                          <p className="text-xs font-medium text-gray-600">Inventory qty</p>
                          <p className="mt-1 text-2xl font-bold text-green-700">{item.inventory_quantity}</p>
                        </div>
                        <div className="rounded-xl bg-linear-to-r from-[#13452D]/5 to-[#1F764D]/10 p-3 ring-1 ring-[#1F764D]/15">
                          <p className="text-xs font-medium text-gray-600">Labels to print</p>
                          <p className="mt-1 text-2xl font-bold text-[#13452D]">{labelCount}</p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 shrink-0 text-gray-400" />
                          <span>
                            Submitted by{' '}
                            <span className="font-semibold text-gray-900">{item.employee_username}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 shrink-0 text-gray-400" />
                          <span>Approved {formatDateTime(item.updated_at)}</span>
                        </div>
                      </div>

                      <div className="mt-auto pt-5">
                        <p className="mb-3 text-xs leading-relaxed text-gray-500">
                          {awaitingNursery
                            ? 'Nursery can print from Request status. You may print here instead — only one print counts.'
                            : 'Print barcode labels to release this product into Live Inv.'}
                        </p>
                        <Button
                          type="button"
                          disabled={isPrinting}
                          onClick={() => void handlePrint(item)}
                          className="h-11 w-full bg-linear-to-r from-[#13452D] to-[#1F764D] text-sm font-semibold shadow-md hover:shadow-lg"
                        >
                          <Printer className="mr-2 h-4 w-4" />
                          {isPrinting ? 'Printing…' : `Print ${labelCount} barcode${labelCount === 1 ? '' : 's'}`}
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          <PaginationControls
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={pageSize}
            itemLabel="pending items"
            pageSizeOptions={[10, 20, 50]}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            isLoading={isLoading}
          />
        </>
      )}
    </div>
  )
}
