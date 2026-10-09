'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Boxes, TrendingUp, Warehouse } from 'lucide-react'
import { analytics as analyticsApi, nurseries as nurseriesApi } from '@/app/lib/api'
import { toast } from 'sonner'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

interface NurserySummary {
  nursery_id: string
  nursery_name: string
}

interface NurseryOverview {
  nursery_id: string
  nursery_name: string
  products_count: number
  total_inventory: number
  total_ordered_quantity: number
  top_products: Array<{
    product_id: string
    item_name: string
    inventory_quantity: number
    ordered_quantity: number
  }>
}

export default function NurseryAnalyticsPage() {
  const [nurseries, setNurseries] = useState<NurserySummary[]>([])
  const [selectedNurseryId, setSelectedNurseryId] = useState<string>('')
  const [overview, setOverview] = useState<NurseryOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isOverviewLoading, setIsOverviewLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await nurseriesApi.getAll()
        setNurseries(data)
        if (data.length > 0) {
          setSelectedNurseryId(data[0].nursery_id)
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load nurseries'
        toast.error(message)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    const loadOverview = async () => {
      if (!selectedNurseryId) {
        setOverview(null)
        return
      }
      try {
        setIsOverviewLoading(true)
        const data = await analyticsApi.getNurseryOverview(selectedNurseryId)
        setOverview(data)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load nursery analytics'
        toast.error(message)
      } finally {
        setIsOverviewLoading(false)
      }
    }
    loadOverview()
  }, [selectedNurseryId])

  if (isLoading) return <div className="text-gray-600">Loading nursery analytics...</div>

  const chartData = overview?.top_products.slice(0, 8).map((product) => ({
    name: product.item_name.length > 16 ? `${product.item_name.slice(0, 16)}...` : product.item_name,
    ordered: product.ordered_quantity,
    inventory: product.inventory_quantity,
  })) || []

  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-[#13452D] via-[#1B613F] to-[#1F764D] p-5 sm:p-8 text-white shadow-xl">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Nursery Analytics</h1>
        <p className="mt-2 text-sm sm:text-base text-white/90">Performance, inventory balance, and top-product insights by nursery.</p>
      </div>

      <div className="rounded-2xl border bg-white p-4 sm:p-6 shadow-sm">
        <label className="text-sm font-semibold text-gray-700">Select Nursery</label>
        <select
          value={selectedNurseryId}
          onChange={(e) => setSelectedNurseryId(e.target.value)}
          className="mt-2 h-11 w-full rounded-lg border border-gray-300 px-3 text-gray-900"
        >
          {nurseries.map((nursery) => (
            <option key={nursery.nursery_id} value={nursery.nursery_id}>
              {nursery.nursery_name}
            </option>
          ))}
        </select>
      </div>

      {isOverviewLoading || !overview ? (
        <div className="rounded-2xl border bg-white p-8 text-gray-600">Loading overview...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Product Types</p>
                <Boxes className="h-5 w-5 text-[#1F764D]" />
              </div>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 mt-2">{overview.products_count}</p>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Total Inventory</p>
                <Warehouse className="h-5 w-5 text-[#1F764D]" />
              </div>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 mt-2">{overview.total_inventory}</p>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Total Ordered Quantity</p>
                <TrendingUp className="h-5 w-5 text-[#1F764D]" />
              </div>
              <p className="text-3xl sm:text-4xl font-black text-gray-900 mt-2">{overview.total_ordered_quantity}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-6">
            <div className="rounded-2xl border bg-white p-4 sm:p-6 xl:col-span-3 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#1F764D]" />
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Inventory vs Ordered</h2>
              </div>
              {chartData.length === 0 ? (
                <p className="text-gray-600">No chart data available for this nursery.</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="ordered" fill="#13452D" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="inventory" fill="#1F764D" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-4 sm:p-6 xl:col-span-2 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#1F764D]" />
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Top Products</h2>
              </div>
              {overview.top_products.length === 0 ? (
                <p className="text-gray-600">No products found for this nursery.</p>
              ) : (
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {overview.top_products.map((product, idx) => (
                    <div key={product.product_id} className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">#{idx + 1} {product.item_name}</p>
                          <p className="text-xs text-gray-500">{product.product_id}</p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-gray-700">Ordered: <span className="font-semibold">{product.ordered_quantity}</span></p>
                          <p className="text-gray-700">Inventory: <span className="font-semibold">{product.inventory_quantity}</span></p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 sm:p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#1F764D]" />
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Top Products for {overview.nursery_name}</h2>
            </div>
            {overview.top_products.length === 0 ? (
              <p className="text-gray-600">No products found for this nursery.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {overview.top_products.map((product) => (
                  <div key={product.product_id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{product.item_name}</p>
                        <p className="text-xs text-gray-500">{product.product_id}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-gray-700">Ordered: <span className="font-semibold">{product.ordered_quantity}</span></p>
                        <p className="text-gray-700">Inventory: <span className="font-semibold">{product.inventory_quantity}</span></p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
