'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Clock3, Package, User } from 'lucide-react'
import { toast } from 'sonner'
import { products as productsApi } from '@/app/lib/api'
import { formatDateTime } from '@/app/lib/utils'
import { buildSizeLabel } from '@/app/lib/size'
import { getProductSectionLabel, normalizeProductSection } from '@/app/lib/productCategory'
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
  image_url?: string | null
  status: string
  approved_product_id?: string | null
  reviewed_by?: string | null
  created_at: string
  updated_at: string
}

export default function ProductSubmissionsPage() {
  const [submissions, setSubmissions] = useState<ProductSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1)
      setSearch(searchInput.trim())
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true)
        const data = await productsApi.getPendingSubmissions({
          page,
          page_size: pageSize,
          search,
        })
        setSubmissions(data.items)
        setTotal(data.total)
        setTotalPages(data.total_pages)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load submissions'
        toast.error(message)
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [page, pageSize, search])

  if (isLoading) {
    return <div className="text-gray-600">Loading submissions...</div>
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-linear-to-r from-[#13452D] to-[#1F764D] p-5 sm:p-6 text-white shadow-xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Product Submissions</h1>
          <p className="text-white/85 mt-1">Nursery-submitted products awaiting base price and rate approval</p>
        </div>
        <div className="rounded-2xl bg-white/15 px-4 py-2 text-right backdrop-blur-sm">
          <p className="text-xs uppercase tracking-wide text-white/70">Pending</p>
          <p className="text-3xl font-bold">{total}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by item, size, request ID, nursery"
            className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 md:col-span-3"
          />
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-900"
          >
            <option value={12}>12 / page</option>
            <option value={24}>24 / page</option>
            <option value={36}>36 / page</option>
          </select>
        </div>
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h2 className="mt-4 text-2xl font-bold text-gray-900">No pending submissions</h2>
          <p className="mt-2 text-gray-600">{search ? 'No pending submissions match your search.' : 'Nursery users have not submitted any products for review yet.'}</p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {submissions.map((submission) => {
            const sec = normalizeProductSection(submission.section)
            const sectionBadgeClass =
              sec === 'shrubs'
                ? 'bg-emerald-100 text-emerald-800'
                : sec === 'perennials'
                  ? 'bg-violet-100 text-violet-800'
                  : 'bg-blue-100 text-blue-800'
            return (
            <Link key={submission.submission_id} href={`/admin/products/submissions/${submission.submission_id}`}>
              <div className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-[#1F764D] hover:shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-amber-700">
                      <Clock3 className="h-4 w-4" />
                      Waiting for pricing
                    </div>
                    <div className="mt-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${sectionBadgeClass}`}>
                        {getProductSectionLabel(submission.section)}
                      </span>
                    </div>
                    <h2 className="mt-2 text-lg sm:text-xl font-bold text-gray-900 wrap-break-word">{submission.item_name}</h2>
                    <p className="text-sm text-gray-500">{getZoneDisplayLabel(submission.zones, submission.subzone || null)}</p>
                    <p className="text-sm text-gray-600">{submission.size || buildSizeLabel(submission.height_feet, submission.caliper_inches)}</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3 text-amber-700">
                    <Package className="h-6 w-6" />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Submitted by</p>
                    <div className="mt-1 flex items-center gap-2 font-medium">
                      <User className="h-4 w-4 text-gray-500" />
                      {submission.employee_username}
                    </div>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Inventory</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{submission.inventory_quantity}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-xs text-gray-500">
                  <span>{formatDateTime(submission.created_at)}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#1F764D]">
                    Review now <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </Link>
            )
          })}
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600">
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50 text-black"
            >
              Previous
            </button>
            <span className="text-sm font-medium text-gray-700">Page {page} of {Math.max(1, totalPages)}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50 text-black"
            >
              Next
            </button>
          </div>
        </div>
        </>
      )}
    </div>
  )
}

