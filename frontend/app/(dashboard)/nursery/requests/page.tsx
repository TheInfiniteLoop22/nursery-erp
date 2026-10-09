'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock3, CheckCircle2, Printer, Package } from 'lucide-react'
import { toast } from 'sonner'
import { products as productsApi } from '@/app/lib/api'
import { Button } from '@/app/components/ui/button'
import { formatDateTime } from '@/app/lib/utils'
import { getZoneDisplayLabel } from '@/app/lib/zone'
import { buildSizeLabel } from '@/app/lib/size'
import { barcodeCountForProduct, getProductSectionLabel } from '@/app/lib/productCategory'
import { printBarcode } from '@/app/lib/barcodePrinter'

interface ProductSubmission {
  submission_id: string
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

export default function NurseryRequestsPage() {
  const [requests, setRequests] = useState<ProductSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activePrintId, setActivePrintId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'pending' | 'approved'>('all')

  const loadRequests = async () => {
    try {
      setIsLoading(true)
      const data = await productsApi.getMySubmissions({
        page,
        page_size: pageSize,
        search,
        status,
      })
      setRequests(data.items)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load request status'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1)
      setSearch(searchInput.trim())
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  useEffect(() => {
    void loadRequests()
  }, [page, pageSize, search, status])

  const handlePrint = async (request: ProductSubmission) => {
    if (!request.approved_product_id) {
      toast.error('Approved product is missing for this request')
      return
    }

    const requestedQuantity = parseInt(String(request.inventory_quantity), 10)
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      toast.error('Invalid quantity for printing')
      return
    }

    const quantity = barcodeCountForProduct(request.section, requestedQuantity)
    if (quantity <= 0) {
      toast.error('No barcode quantity available to print')
      return
    }

    setActivePrintId(request.submission_id)
    const printWindow = window.open('', '_blank')
    try {
      toast.info(`Preparing to print ${quantity} barcode(s)...`)
      await printBarcode(request.approved_product_id, request.item_name, quantity, printWindow, {
        section: request.section,
        height: request.height_feet,
        caliper: request.caliper_inches,
        gallons: request.gallons,
      })
      await productsApi.updateSubmissionBarcodeStatus(request.submission_id, 'PRINTED_BY_NURSERY')
      toast.success(`Printed ${quantity} barcode(s).`)
      await loadRequests()
    } catch (error: unknown) {
      printWindow?.close()
      const message = error instanceof Error ? error.message : 'Failed to print barcode'
      toast.error(message)
    } finally {
      setActivePrintId(null)
    }
  }

  if (isLoading) {
    return <div className="text-gray-600">Loading request status...</div>
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      <div className="rounded-2xl bg-linear-to-r from-[#13452D] to-[#1F764D] p-5 sm:p-6 text-white shadow-xl">
        <h1 className="text-2xl sm:text-3xl font-bold">Product Request Status</h1>
        <p className="mt-1 text-white/85">Track your submissions and print barcodes when admin assigns printing to nursery.</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by product, size, or request ID"
            className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 md:col-span-2"
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as 'all' | 'pending' | 'approved')
              setPage(1)
            }}
            className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-900"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
          </select>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-900"
          >
            <option value={8}>8 / page</option>
            <option value={12}>12 / page</option>
            <option value={20}>20 / page</option>
          </select>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <Package className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-3 text-gray-700">{search || status !== 'all' ? 'No requests match your filters.' : 'No product requests submitted yet.'}</p>
          <Link href="/nursery/products/create" className="mt-4 inline-flex text-sm font-semibold text-[#1F764D]">
            Submit your first request
          </Link>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {requests.map((request) => {
            const isApproved = request.status === 'APPROVED'
            const canNurseryPrint = isApproved && request.barcode_status === 'PENDING_NURSERY_PRINT' && !!request.approved_product_id
            const isPrinted = request.barcode_status === 'PRINTED_BY_ADMIN' || request.barcode_status === 'PRINTED_BY_NURSERY'
            const printedByAdmin = request.barcode_status === 'PRINTED_BY_ADMIN'
            const printedByNursery = request.barcode_status === 'PRINTED_BY_NURSERY'
            return (
              <div key={request.submission_id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{getProductSectionLabel(request.section)}</p>
                    <h2 className="mt-1 text-lg font-bold text-gray-900">{request.item_name}</h2>
                    <p className="text-sm text-gray-600">{getZoneDisplayLabel(request.zones, request.subzone || null)}</p>
                    <p className="text-sm text-gray-500">{request.size || buildSizeLabel(request.height_feet, request.caliper_inches)}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {isApproved ? 'Approved' : 'Pending'}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                  <Clock3 className="h-4 w-4" />
                  Requested on {formatDateTime(request.created_at)}
                </div>

                <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                  {isPrinted ? (
                    <span className="inline-flex items-center gap-2 font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      {printedByAdmin ? 'Barcode printed by admin' : printedByNursery ? 'Barcode printed by you' : 'Barcode already printed'}
                    </span>
                  ) : canNurseryPrint ? (
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      onClick={() => void handlePrint(request)}
                      disabled={activePrintId === request.submission_id}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      {activePrintId === request.submission_id ? 'Printing...' : 'Print Barcode'}
                    </Button>
                  ) : isApproved && request.barcode_status === 'NOT_SET' ? (
                    <p>Waiting for admin to assign barcode printing.</p>
                  ) : (
                    <p>{isApproved ? 'Admin will handle barcode printing.' : 'Waiting for admin approval.'}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600">
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-2 text-black">
            <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <span className="text-sm font-medium text-gray-700">
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <Button type="button" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
        </>
      )}
    </div>
  )
}
