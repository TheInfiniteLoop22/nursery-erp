'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { TrendingUp, Leaf, PackagePlus, Boxes, ArrowRight, Sparkles, ShoppingCart, ClipboardList } from 'lucide-react'
import { products as productsApi, nurseries as nurseriesApi } from '@/app/lib/api'
import { toast } from 'sonner'

export default function NurseryDashboard() {
  const [productsCount, setProductsCount] = useState(0)
  const [inventoryTotal, setInventoryTotal] = useState(0)
  const [nurseriesCount, setNurseriesCount] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const [firstProductsPage, nurseries] = await Promise.all([
          productsApi.getAll({ page: 1, page_size: 100 }),
          nurseriesApi.getAll(),
        ])

        let allProducts = [...firstProductsPage.items]
        for (let page = 2; page <= firstProductsPage.total_pages; page += 1) {
          const nextPage = await productsApi.getAll({ page, page_size: 100 })
          allProducts = allProducts.concat(nextPage.items)
        }

        setProductsCount(firstProductsPage.total)
        setNurseriesCount(nurseries.length)
        setInventoryTotal(allProducts.reduce((sum, p) => sum + p.inventory_quantity, 0))
        setLowStockCount(allProducts.filter((p) => p.inventory_quantity <= 10).length)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load dashboard data'
        toast.error(message)
      } finally {
        setIsLoading(false)
      }
    }
    fetchOverview()
  }, [])

  if (isLoading) return <div className="text-gray-600">Loading dashboard...</div>

  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-[#13452D] via-[#1B613F] to-[#1F764D] p-5 sm:p-8 text-white shadow-xl">
        <div className="flex items-start justify-between gap-4 sm:gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs sm:px-4 sm:text-sm font-semibold">
              <Sparkles className="h-4 w-4" />
              Vendor control center
            </div>
            <h1 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight">Welcome to your vendor workspace</h1>
            <p className="mt-2 max-w-2xl text-sm sm:text-base text-white/90">
              Manage inventory, submit product requests, and track vendor performance from one place.
            </p>
          </div>
          <div className="hidden md:flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15">
            <Leaf className="h-8 w-8" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Products</p>
          <p className="mt-1 text-3xl sm:text-4xl font-black text-gray-900">{productsCount}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Inventory</p>
          <p className="mt-1 text-3xl sm:text-4xl font-black text-gray-900">{inventoryTotal}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Vendors on file</p>
          <p className="mt-1 text-3xl sm:text-4xl font-black text-gray-900">{nurseriesCount}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Low Stock Alerts</p>
          <p className="mt-1 text-3xl sm:text-4xl font-black text-amber-700">{lowStockCount}</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 sm:p-6 shadow-sm">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">Quick Actions</h2>
        <p className="text-sm text-gray-500 mt-1">Most-used vendor actions</p>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
          <Link href="/nursery/orders" className="group rounded-xl border bg-gray-50 p-5 hover:border-[#1F764D] hover:bg-white">
            <ShoppingCart className="h-7 w-7 text-[#1F764D]" />
            <h3 className="mt-3 text-base sm:text-lg font-bold text-gray-900">Orders</h3>
            <p className="mt-1 text-sm text-gray-600">View paid orders, scan barcodes, or edit lines</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#1F764D]">Open <ArrowRight className="h-4 w-4" /></span>
          </Link>
          <Link href="/nursery/products" className="group rounded-xl border bg-gray-50 p-5 hover:border-[#1F764D] hover:bg-white">
            <Boxes className="h-7 w-7 text-[#1F764D]" />
            <h3 className="mt-3 text-base sm:text-lg font-bold text-gray-900">Open Inventory</h3>
            <p className="mt-1 text-sm text-gray-600">View inventory and add stock</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#1F764D]">Open <ArrowRight className="h-4 w-4" /></span>
          </Link>
          <Link href="/nursery/products/create" className="group rounded-xl border bg-gray-50 p-5 hover:border-[#1F764D] hover:bg-white">
            <PackagePlus className="h-7 w-7 text-[#1F764D]" />
            <h3 className="mt-3 text-base sm:text-lg font-bold text-gray-900">Add Product</h3>
            <p className="mt-1 text-sm text-gray-600">Submit a product for admin approval</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#1F764D]">Open <ArrowRight className="h-4 w-4" /></span>
          </Link>
          <Link href="/nursery/requests" className="group rounded-xl border bg-gray-50 p-5 hover:border-[#1F764D] hover:bg-white">
            <ClipboardList className="h-7 w-7 text-[#1F764D]" />
            <h3 className="mt-3 text-base sm:text-lg font-bold text-gray-900">Request status</h3>
            <p className="mt-1 text-sm text-gray-600">Track approvals and print pending barcodes</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#1F764D]">Open <ArrowRight className="h-4 w-4" /></span>
          </Link>
          <Link href="/nursery/nursery" className="group rounded-xl border bg-gray-50 p-5 hover:border-[#1F764D] hover:bg-white">
            <Leaf className="h-7 w-7 text-[#1F764D]" />
            <h3 className="mt-3 text-base sm:text-lg font-bold text-gray-900">Manage vendors</h3>
            <p className="mt-1 text-sm text-gray-600">Create, edit, and remove vendor records</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#1F764D]">Open <ArrowRight className="h-4 w-4" /></span>
          </Link>
        </div>
      </div>

      <Link href="/nursery/analytics" className="block rounded-2xl border bg-white p-4 sm:p-6 shadow-sm hover:border-[#1F764D]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900">Vendor analytics</h3>
            <p className="text-sm text-gray-600 mt-1">Deep insights per vendor with top products and inventory performance.</p>
          </div>
          <TrendingUp className="h-8 w-8 text-[#1F764D]" />
        </div>
      </Link>
    </div>
  )
}
