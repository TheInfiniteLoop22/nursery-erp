'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Eye, CheckCircle, Clock, FileText, RefreshCw, Download, MoreVertical, Package, ClipboardList } from 'lucide-react'
import { formatCurrency, formatDate } from '@/app/lib/utils'
import { OrderStatus } from '@/app/lib/types'
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
  status: OrderStatus
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

const statusColors = {
  CREATED: 'bg-amber-50 text-amber-700 border border-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
}

const statusIcons = {
  CREATED: Clock,
  IN_PROGRESS: RefreshCw,
  COMPLETED: CheckCircle,
}

const DEFAULT_SUMMARY: OrderSummary = {
  total: 0,
  created: 0,
  in_progress: 0,
  completed: 0,
}

export default function OrdersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [orders, setOrders] = useState<Order[]>([])
  const [summary, setSummary] = useState<OrderSummary>(DEFAULT_SUMMARY)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [totalOrders, setTotalOrders] = useState(0)
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

  const fetchOrders = useCallback(async () => {
    try {
      const [response, summaryResponse] = await Promise.all([
        ordersApi.getAll({
          page: currentPage,
          page_size: itemsPerPage,
          search: debouncedSearch || undefined,
          status: statusFilter,
        }),
        ordersApi.getSummary({
          search: debouncedSearch || undefined,
        }),
      ])

      setOrders(response.items.map((order) => ({
        ...order,
        status: order.status as OrderStatus,
      })))
      setTotalOrders(response.total)
      setTotalPages(response.total_pages)
      setSummary(summaryResponse)
    } catch (error: unknown) {
      console.error('Error fetching orders:', error)
      const message = error instanceof Error ? error.message : 'Failed to load work orders'
      toast.error(message)
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

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchOrders()
    setIsRefreshing(false)
    toast.success('Work orders refreshed')
  }

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
    <div className="space-y-5 sm:space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Work orders</h1>
          <p className="text-gray-500">Track and manage all your project work orders in one place</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="w-full px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm">
            <Download className="h-4 w-4" />
            Export
          </button>
          <Link href="/admin/orders/create">
            <button className="w-full px-6 py-2.5 bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2 shadow-md">
              <Plus className="h-4 w-4" />
              New work order
            </button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gray-100 rounded-lg">
              <Package className="h-6 w-6 text-gray-700" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">Total work orders</p>
            <p className="text-3xl font-bold text-gray-900">{summary.total}</p>
            <p className="text-xs text-gray-400">All time</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-50 rounded-lg">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">Pending</p>
            <p className="text-3xl font-bold text-gray-900">{summary.created}</p>
            <p className="text-xs text-amber-600 font-medium">Awaiting processing</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <RefreshCw className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">In Progress</p>
            <p className="text-3xl font-bold text-gray-900">{summary.in_progress}</p>
            <p className="text-xs text-blue-600 font-medium">Currently processing</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-xl p-6 shadow-lg hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-white/80">Completed</p>
            <p className="text-3xl font-bold text-white">{summary.completed}</p>
            <p className="text-xs text-white/90 font-medium">Successfully delivered</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order ID, client, or designer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F764D] focus:border-transparent transition-all text-black"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as OrderStatus | 'all')
              setCurrentPage(1)
            }}
            className="h-12 px-4 border border-gray-200 rounded-lg bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#1F764D] focus:border-transparent transition-all sm:min-w-[150px]"
          >
            <option value="all">All Status</option>
            <option value="CREATED">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {orders.map((order) => {
          const StatusIcon = statusIcons[order.status]

          return (
            <div key={order.order_id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-[#1F764D]/30 transition-all duration-300 overflow-hidden group">
              <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${statusColors[order.status]}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {order.status.replace('_', ' ')}
                  </span>
                  <button className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                    <MoreVertical className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1 break-all">{order.order_id}</h3>
                <p className="text-sm text-gray-600 font-medium truncate">{order.client_name}</p>
                {order.designer_name && (
                  <p className="text-xs text-gray-500 mt-1">Designer: {order.designer_name}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Type: {formatWorkOrderTypeLabel(order.work_order_type)}</p>
              </div>

              <div className="p-5 space-y-4">
                <div className="bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-lg p-4 text-center">
                  <p className="text-xs text-white/80 mb-1 font-medium">Total Amount</p>
                  <p className="text-2xl sm:text-3xl font-bold text-white wrap-break-word">
                    {formatCurrency(parseFloat(order.total_order_amount))}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Package className="h-4 w-4" />
                      <span className="text-sm">Items</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{order.items_count}</span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">Created</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 text-right">{formatDate(new Date(order.ordered_at))}</span>
                  </div>

                  {order.invoice_generated_at && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <div className="flex items-center gap-2 text-gray-600">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">Invoice</span>
                      </div>
                      <span className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-semibold">
                        Generated
                      </span>
                    </div>
                  )}

                  {order.paid_at && (
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2 text-gray-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">Payment</span>
                      </div>
                      <span className="inline-flex items-center px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-semibold">
                        Completed
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 bg-gray-50 border-t border-gray-100">
                <Link href={`/admin/orders/${order.order_id}`} className="w-full">
                  <button className="w-full px-4 py-2.5 bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white rounded-lg font-medium hover:shadow-md transition-all flex items-center justify-center gap-2 text-sm">
                    <Eye className="h-4 w-4" />
                    View Details
                  </button>
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {orders.length === 0 && (
        <div className="bg-white rounded-xl p-8 sm:p-16 text-center shadow-sm border border-gray-100">
          <div className="max-w-md mx-auto">
            <div className="mb-6 inline-flex p-4 bg-gray-100 rounded-full">
              <FileText className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No work orders found</h3>
            <p className="text-gray-500 mb-6">
              {searchQuery || statusFilter !== 'all'
                ? 'No work orders match your search criteria. Try adjusting your filters.'
                : 'You have not created any work orders yet. Start by creating your first work order.'}
            </p>
            {(searchQuery || statusFilter !== 'all') ? (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                }}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
              >
                Clear Filters
              </button>
            ) : (
              <Link href="/admin/orders/create">
                <button className="px-6 py-2.5 bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white rounded-lg font-medium hover:shadow-lg transition-all">
                  Create your first work order
                </button>
              </Link>
            )}
          </div>
        </div>
      )}

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
    </div>
  )
}
