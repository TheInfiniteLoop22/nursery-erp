'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, DollarSign, Package, Users, ShoppingCart, Calendar } from 'lucide-react'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatCurrency } from '@/app/lib/utils'
import { analytics as analyticsApi } from '@/app/lib/api'
import { toast } from 'sonner'

interface AnalyticsOverview {
  total_revenue: string
  total_orders: number
  total_products: number
  active_employees: number
  orders_by_status: Record<string, number>
  revenue_growth: number
  orders_growth: number
}

interface DesignerStat {
  user_id: string
  username: string
  orders: number
  revenue: string
  avg_order_value: string
}

interface TopProduct {
  product_id: string
  name: string
  sold: number
  revenue: string
}

interface RevenueTrendData {
  date: string
  revenue: number
}

interface OrdersTrendData {
  date: string
  orders: number
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [designers, setDesigners] = useState<DesignerStat[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrendData[]>([])
  const [ordersTrend, setOrdersTrend] = useState<OrdersTrendData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        // Check if user is logged in
        const token = localStorage.getItem('access_token')
        if (!token) {
          toast.error('Please login to view analytics')
          window.location.href = '/login'
          return
        }

        const [overviewData, designersData, productsData, revenueData, ordersData] = await Promise.all([
          analyticsApi.getOverview(),
          analyticsApi.getDesigners(),
          analyticsApi.getTopProducts(10),
          analyticsApi.getRevenueTrend(30),
          analyticsApi.getOrdersTrend(30),
        ])

        setOverview(overviewData)
        setDesigners(designersData)
        setTopProducts(productsData)
        setRevenueTrend(revenueData)
        setOrdersTrend(ordersData)
      } catch (error: unknown) {
        console.error('Error fetching analytics:', error)

        // Handle authentication errors
        const message = error instanceof Error ? error.message : 'Unknown error'
        if (message.includes('401') || message.includes('Unauthorized')) {
          toast.error('Session expired. Please login again')
          localStorage.clear()
          window.location.href = '/login'
        } else {
          toast.error('Failed to load analytics data')
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-[#1F764D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (!overview) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">No analytics data available</p>
      </div>
    )
  }
  
  return (
    <div className="space-y-5 sm:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#13452D] to-[#1F764D] rounded-2xl p-5 sm:p-8 text-white shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Analytics Dashboard</h1>
            <p className="text-sm sm:text-lg text-white/90">Business insights and performance metrics</p>
          </div>
          <div className="p-3 sm:p-4 bg-white/20 rounded-xl">
            <TrendingUp className="h-10 w-10 text-white" />
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-2xl p-4 sm:p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium mb-1">Total Revenue</p>
              <p className="text-2xl sm:text-3xl font-bold wrap-break-word">{formatCurrency(parseFloat(overview.total_revenue))}</p>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <div className={`flex items-center gap-1 ${overview.revenue_growth > 0 ? 'text-green-300' : 'text-red-300'}`}>
                  <TrendingUp className={`h-4 w-4 ${overview.revenue_growth < 0 ? 'rotate-180' : ''}`} />
                  <span className="font-semibold">{overview.revenue_growth > 0 ? '+' : ''}{overview.revenue_growth.toFixed(1)}%</span>
                </div>
                <span className="text-white/70">vs last month</span>
              </div>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <DollarSign className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">Total Orders</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{overview.total_orders}</p>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <div className={`flex items-center gap-1 ${overview.orders_growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <TrendingUp className={`h-4 w-4 ${overview.orders_growth < 0 ? 'rotate-180' : ''}`} />
                  <span className="font-semibold">{overview.orders_growth > 0 ? '+' : ''}{overview.orders_growth.toFixed(1)}%</span>
                </div>
                <span className="text-gray-600">growth</span>
              </div>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <ShoppingCart className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">Total Products</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{overview.total_products}</p>
              <p className="text-sm text-gray-500 mt-3">Active in inventory</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl">
              <Package className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">Active Employees</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{overview.active_employees}</p>
              <p className="text-sm text-gray-500 mt-3">Team members</p>
            </div>
            <div className="p-3 bg-amber-100 rounded-xl">
              <Users className="h-8 w-8 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Order Status Breakdown */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Orders by Status</h2>
            <p className="text-gray-600 text-sm mt-1">Current order distribution</p>
          </div>
          <div className="p-3 bg-[#1F764D]/10 rounded-xl">
            <ShoppingCart className="h-6 w-6 text-[#1F764D]" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(overview.orders_by_status).map(([status, count]) => {
            const getStatusIcon = (status: string) => {
              if (status.includes('Progress')) return <Calendar className="h-5 w-5" />
              if (status === 'Completed') return <Package className="h-5 w-5" />
              if (status === 'Paid') return <DollarSign className="h-5 w-5" />
              return <ShoppingCart className="h-5 w-5" />
            }
            
            return (
              <div key={status} className="bg-gradient-to-br from-gray-50 via-white to-gray-50 rounded-xl p-4 sm:p-6 border border-gray-200 hover:border-[#1F764D] hover:shadow-lg transition-all duration-300 cursor-pointer group">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-[#1F764D]/10 rounded-lg text-[#1F764D] group-hover:bg-[#1F764D] group-hover:text-white transition-all">
                    {getStatusIcon(status)}
                  </div>
                  <p className="text-gray-600 font-semibold group-hover:text-[#1F764D] transition-colors">{status.replace('_', ' ')}</p>
                </div>
                <p className="text-3xl sm:text-4xl font-bold text-gray-900 group-hover:text-[#1F764D] transition-colors">{count}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Revenue Trend Chart */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Revenue Trend</h2>
              <p className="text-gray-600 text-sm mt-1">Daily revenue over the last 30 days</p>
            </div>
            <div className="p-3 bg-[#1F764D]/10 rounded-xl">
              <DollarSign className="h-6 w-6 text-[#1F764D]" />
            </div>
          </div>
          {revenueTrend.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No revenue data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1F764D" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#1F764D" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Revenue']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#1F764D" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Orders Trend Chart */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Order Volume</h2>
              <p className="text-gray-600 text-sm mt-1">Daily orders over the last 30 days</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <ShoppingCart className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          {ordersTrend.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No order data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ordersTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  formatter={(value) => [String(value ?? 0), 'Orders']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                />
                <Bar dataKey="orders" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Designer Performance & Top Products Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Designer Performance */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Designer Performance</h2>
              <p className="text-gray-600 text-sm mt-1">Sales analytics by designer/admin</p>
            </div>
            <div className="p-3 bg-[#1F764D]/10 rounded-xl">
              <Users className="h-6 w-6 text-[#1F764D]" />
            </div>
          </div>
          {designers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No designer data available</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {designers.map((designer, idx) => (
                <div key={designer.user_id} className="flex items-center justify-between gap-3 p-4 bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#13452D] to-[#1F764D] flex items-center justify-center text-white text-base font-bold flex-shrink-0">
                      {designer.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{designer.username}</p>
                      <p className="text-xs text-gray-600">{designer.orders} orders</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-[#1F764D] text-sm">{formatCurrency(parseFloat(designer.revenue))}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(parseFloat(designer.avg_order_value))}/avg</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Top Selling Products</h2>
              <p className="text-gray-600 text-sm mt-1">Best performing products by revenue</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl">
              <Package className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          {topProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No product sales data available</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {topProducts.map((product, idx) => (
                <div key={product.product_id} className="flex items-center justify-between gap-3 p-4 bg-gradient-to-r from-purple-50 to-purple-100/50 rounded-xl hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-lg flex-shrink-0">
                      #{idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{product.name}</p>
                      <p className="text-xs text-gray-600">{product.sold} units sold</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-[#1F764D] text-sm">{formatCurrency(parseFloat(product.revenue))}</p>
                    <p className="text-xs text-gray-500">revenue</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}