'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Search, ScanLine, CheckCircle, Package, ArrowRight } from 'lucide-react'
import { formatCurrency, formatDate } from '@/app/lib/utils'
import { orders as ordersApi } from '@/app/lib/api'
import { toast } from 'sonner'
import { PaginationControls } from '@/app/components/ui/PaginationControls'
import { formatWorkOrderTypeLabel } from '@/app/lib/workOrderType'

interface Order {
  order_id: string
  user_id: string
  client_name: string
  work_order_type: 'MAINTENANCE' | 'INSTALL'
  designer_name?: string | null
  total_order_amount: string
  status: string
  ordered_at: string
  updated_at: string
  invoice_generated_at?: string | null
  paid_at?: string | null
  items_count: number
}

interface OrderSummary {
  total: number
  created: number
  in_progress: number
  completed: number
}

const DEFAULT_SUMMARY: OrderSummary = {
  total: 0,
  created: 0,
  in_progress: 0,
  completed: 0,
}

export default function EmployeeOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [summary, setSummary] = useState<OrderSummary>(DEFAULT_SUMMARY)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [totalOrders, setTotalOrders] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const basePath = typeof window !== 'undefined' && localStorage.getItem('user_role') === 'nursery' ? '/nursery' : '/employee'

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
      setCurrentPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  const fetchOrders = useCallback(async () => {
    try {
      const [response, summaryResponse] = await Promise.all([
        ordersApi.getPaid({
          page: currentPage,
          page_size: itemsPerPage,
          search: debouncedSearch || undefined,
          status: statusFilter,
        }),
        ordersApi.getSummary({
          search: debouncedSearch || undefined,
          scannable_only: true,
        }),
      ])

      setOrders(response.items)
      setTotalOrders(response.total)
      setTotalPages(response.total_pages)
      setSummary(summaryResponse)
    } catch (error: unknown) {
      console.error('Error fetching orders:', error)
      toast.error('Failed to load work orders')
    }
  }, [currentPage, debouncedSearch, itemsPerPage, statusFilter])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await fetchOrders()
      setIsLoading(false)
    }
    loadData()
  }, [fetchOrders])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-[#1F764D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading work orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="bg-gradient-to-r from-[#13452D] to-[#1F764D] rounded-2xl p-5 sm:p-8 text-white shadow-xl">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Approved work orders</h1>
        <p className="text-white/90 text-sm sm:text-lg">
          Scan and process approved work orders. After admin approval, they appear here.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-2xl p-5 sm:p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium mb-1">Total approved work orders</p>
              <p className="text-3xl sm:text-4xl font-bold">{summary.total}</p>
            </div>
            <div className="p-2.5 sm:p-3 bg-white/20 rounded-xl">
              <ScanLine className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">In Progress</p>
              <p className="text-3xl sm:text-4xl font-bold text-[#1F764D]">{summary.in_progress}</p>
            </div>
            <div className="p-2.5 sm:p-3 bg-[#1F764D]/10 rounded-xl">
              <Package className="h-6 w-6 sm:h-8 sm:w-8 text-[#1F764D]" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">Completed</p>
              <p className="text-3xl sm:text-4xl font-bold text-green-600">{summary.completed}</p>
            </div>
            <div className="p-2.5 sm:p-3 bg-green-50 rounded-xl">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by work order ID, client, or designer..."
                className="w-full h-12 pl-12 pr-4 text-black border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#1F764D] transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-3">
            {(['all', 'IN_PROGRESS', 'COMPLETED'] as const).map((value) => (
              <button
                key={value}
                onClick={() => {
                  setStatusFilter(value)
                  setCurrentPage(1)
                }}
                className={`px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-semibold transition-all duration-300 cursor-pointer ${statusFilter === value
                    ? 'bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {value === 'all' ? 'All' : value === 'IN_PROGRESS' ? 'In Progress' : 'Completed'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-lg border border-gray-100">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
              <ScanLine className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No work orders found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || statusFilter !== 'all'
                ? 'No work orders match your current filters.'
                : 'No approved work orders are available at the moment.'}
            </p>
            {(searchQuery || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                }}
                className="px-6 py-3 bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300 cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.order_id} className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-[#1F764D]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                    <h3 className="text-2xl sm:text-3xl lg:text-2xl font-bold text-gray-900 break-all">{order.order_id}</h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${order.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-700'
                          : order.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                    >
                      {order.status === 'IN_PROGRESS' ? (
                        <>
                          <Package className="h-3 w-3" />
                          In Progress
                        </>
                      ) : order.status === 'COMPLETED' ? (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          Completed
                        </>
                      ) : (
                        <>
                          <ScanLine className="h-3 w-3" />
                          Ready to Start
                        </>
                      )}
                    </span>
                  </div>

                  <div className="mb-4">
                    <p className="text-base sm:text-lg font-medium text-gray-700 break-words">{order.client_name}</p>
                    {order.designer_name && (
                      <p className="text-sm text-gray-500 mt-1">Designer: {order.designer_name}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">Type: {formatWorkOrderTypeLabel(order.work_order_type)}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-600">Items:</span>
                      <span className="font-semibold text-gray-900">{order.items_count}</span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(parseFloat(order.total_order_amount))}</span>
                    </div>
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-gray-600">Created:</span>
                      <span className="font-semibold text-gray-900 break-words">{formatDate(order.ordered_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="w-full lg:w-auto lg:ml-6">
                  <Link href={`${basePath}/orders/${order.order_id}`}>
                    <button
                      className={`w-full lg:w-auto px-5 sm:px-6 py-3 sm:py-4 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer ${order.status === 'IN_PROGRESS'
                          ? 'bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white hover:shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      <ScanLine className="h-5 w-5" />
                      {order.status === 'IN_PROGRESS'
                        ? 'Continue Scanning'
                        : order.status === 'COMPLETED'
                          ? 'View Details'
                          : 'Start Scanning'}
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalOrders}
        pageSize={itemsPerPage}
        itemLabel="work orders"
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setItemsPerPage(size)
          setCurrentPage(1)
        }}
        isLoading={isRefreshing}
      />

      <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-2xl p-6 border-l-4 border-l-[#1F764D]">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-[#1F764D] rounded-lg">
            <ScanLine className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg mb-1">Important Information</p>
            <p className="text-gray-700">
              Only approved work orders are visible here. Use Start Scanning or Continue Scanning to process line items.
              Scan everything before marking a work order complete.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
