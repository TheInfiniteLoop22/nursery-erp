'use client'

import { useState, useEffect } from 'react'
import { ScanLine, Package, CheckCircle, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { orders as ordersApi } from '@/app/lib/api'
import { toast } from 'sonner'
import { formatCurrency } from '@/app/lib/utils'

interface Order {
  order_id: string
  user_id: string
  client_name: string
  total_order_amount: string
  status: string
  ordered_at: string
  updated_at: string
  invoice_generated_at?: string | null
  paid_at?: string | null
  items_count: number
}

export default function EmployeeDashboard() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [totalOrders, setTotalOrders] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const userName = typeof window !== 'undefined' ? localStorage.getItem('user_id') || 'Employee' : 'Employee'
  const basePath = typeof window !== 'undefined' && localStorage.getItem('user_role') === 'nursery' ? '/nursery' : '/employee'

  useEffect(() => {
    if (typeof window === 'undefined') return
    const role = localStorage.getItem('user_role')
    if (role === 'head_installation' || role === 'head_maintenance') {
      router.replace('/employee/planning')
      return
    }
    const fetchOrders = async () => {
      try {
        const data = await ordersApi.getPaid({ page: 1, page_size: 50 })
        setOrders(data.items)
        setTotalOrders(data.total)
      } catch (error: unknown) {
        console.error('Error fetching orders:', error)
        toast.error('Failed to load orders')
      } finally {
        setIsLoading(false)
      }
    }
    fetchOrders()
  }, [router])

  const stats = {
    available: totalOrders,
    inProgress: orders.filter(o => o.status === 'IN_PROGRESS').length,
    completed: orders.filter(o => o.status === 'COMPLETED').length,
    totalItems: orders.reduce((sum, o) => sum + o.items_count, 0),
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-[#1F764D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-5 sm:space-y-8 animate-fade-in">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-[#13452D] to-[#1F764D] rounded-2xl p-5 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Good Morning, {userName}! 👋</h2>
            <p className="text-white/90 text-sm sm:text-lg">You have {stats.available} orders available. Let&apos;s get started!</p>
          </div>
          <Link href={`${basePath}/orders`}>
            <button className="w-full sm:w-auto px-5 py-2.5 sm:px-6 sm:py-3 bg-white text-[#13452D] font-semibold rounded-lg hover:bg-white/90 transition-all duration-300 cursor-pointer">
              View All Orders
            </button>
          </Link>
        </div>
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-2xl p-5 sm:p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium mb-1">Orders Available</p>
              <p className="text-3xl sm:text-4xl font-bold">{stats.available}</p>
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
              <p className="text-3xl sm:text-4xl font-bold text-[#1F764D]">{stats.inProgress}</p>
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
              <p className="text-3xl sm:text-4xl font-bold text-green-600">{stats.completed}</p>
            </div>
            <div className="p-2.5 sm:p-3 bg-green-50 rounded-xl">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">Total Items</p>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900">{stats.totalItems}</p>
            </div>
            <div className="p-2.5 sm:p-3 bg-gray-100 rounded-xl">
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-gray-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Recent Orders</h2>
            <p className="text-gray-600 text-sm mt-1">Paid orders ready for processing</p>
          </div>
          <Link href={`${basePath}/orders`}>
            <button className="w-full sm:w-auto px-4 py-2 text-[#1F764D] border-2 border-[#1F764D] font-semibold rounded-lg hover:bg-[#1F764D] hover:text-white transition-all duration-300 cursor-pointer">
              View All
            </button>
          </Link>
        </div>
        
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Package className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No orders available</h3>
            <p className="text-gray-600 text-sm">Check back later for new assignments</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.slice(0, 3).map((order) => (
              <div key={order.order_id} className="border border-gray-200 rounded-xl p-4 sm:p-5 hover:border-[#1F764D] hover:shadow-md transition-all duration-300">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 break-all">{order.order_id}</h3>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        order.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-700'
                          : order.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {order.status === 'IN_PROGRESS' ? 'In Progress' : order.status}
                      </span>
                    </div>
                    <p className="text-gray-600 font-medium">{order.client_name}</p>
                  </div>
                  <Link href={`${basePath}/orders/${order.order_id}`}>
                    <button className={`w-full sm:w-auto px-4 sm:px-5 py-2 rounded-lg font-semibold transition-all duration-300 cursor-pointer ${
                      order.status === 'IN_PROGRESS' 
                        ? 'bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white hover:shadow-lg' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}>
                      {order.status === 'IN_PROGRESS' ? 'Continue' : 'View Order'}
                    </button>
                  </Link>
                </div>
                
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6 text-sm mt-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-700"><span className="font-semibold">{order.items_count}</span> items</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-gray-700">Amount: <span className="font-semibold">{formatCurrency(parseFloat(order.total_order_amount))}</span></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        <Link href={`${basePath}/orders`}>
          <div className="bg-white border-2 border-gray-200 rounded-xl p-5 sm:p-6 text-center hover:border-[#1F764D] hover:shadow-lg transition-all duration-300 cursor-pointer">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-xl mb-4">
              <ScanLine className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">Scan Products</h3>
            <p className="text-sm text-gray-600">Use barcode scanner to update order inventory</p>
          </div>
        </Link>
        
        <Link href={`${basePath}/orders`}>
          <div className="bg-white border-2 border-gray-200 rounded-xl p-5 sm:p-6 text-center hover:border-[#1F764D] hover:shadow-lg transition-all duration-300 cursor-pointer">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-xl mb-4">
              <Package className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">View Orders</h3>
            <p className="text-sm text-gray-600">Check all order details and current status</p>
          </div>
        </Link>
        
        <Link href={`${basePath}/orders`}>
          <div className="bg-white border-2 border-gray-200 rounded-xl p-5 sm:p-6 text-center hover:border-[#1F764D] hover:shadow-lg transition-all duration-300 cursor-pointer">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-xl mb-4">
              <CheckCircle className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">Complete Orders</h3>
            <p className="text-sm text-gray-600">Finalize scanned orders for client delivery</p>
          </div>
        </Link>
      </div>
    </div>
  )
}