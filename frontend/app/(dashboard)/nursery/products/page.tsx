'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Package, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { products as productsApi, nurseries as nurseriesApi } from '@/app/lib/api'
import { printBarcode } from '@/app/lib/barcodePrinter'
import { formatCurrency } from '@/app/lib/utils'
import { buildSizeLabel } from '@/app/lib/size'
import { barcodeCountForProduct, getProductSectionLabel, normalizeProductSection } from '@/app/lib/productCategory'
import { getZoneDisplayLabel } from '@/app/lib/zone'

interface Product {
  product_id: string
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
  ordered_quantity: number
  base_price_per_unit: string
  rate_percentage: string
  image_url?: string | null
}

interface Nursery {
  nursery_id: string
  nursery_name: string
}

export default function NurseryProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [nurseries, setNurseries] = useState<Nursery[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlantTypes, setSelectedPlantTypes] = useState<Array<'tree' | 'shrubs' | 'perennials'>>([])
  const itemsPerPage = 8

  useEffect(() => {
    const load = async () => {
      try {
        const [productData, nurseryData] = await Promise.all([
          productsApi.getAll({
            page: currentPage,
            page_size: itemsPerPage,
            search: searchQuery || undefined,
            sections: selectedPlantTypes,
          }),
          nurseriesApi.getAll(),
        ])
        setProducts(productData.items)
        setTotalProducts(productData.total)
        setTotalPages(productData.total_pages)
        setNurseries(nurseryData)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load products'
        toast.error(message)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [currentPage, searchQuery, selectedPlantTypes])

  const getNurseryName = useCallback(
    (id: string) => nurseries.find((n) => n.nursery_id === id)?.nursery_name || id,
    [nurseries]
  )

  const finalPrice = (base: string, rate: string) => {
    const b = Number(base)
    const r = Number(rate)
    const v = b * r
    return Number.isFinite(v) ? v : 0
  }

  const togglePlantTypeFilter = (type: 'tree' | 'shrubs' | 'perennials') => {
    setSelectedPlantTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
    )
    setCurrentPage(1)
  }

  const handleAddStock = async (product: Product) => {
    const rawQty = window.prompt(`Add stock for ${product.item_name} (${product.product_id})`, '1')
    if (!rawQty) return

    const qty = Number(rawQty)
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error('Please enter a valid positive quantity')
      return
    }

    const qtyToPrint = barcodeCountForProduct(product.section, qty)
    const printWindow = window.open('', '_blank')

    try {
      const response = await productsApi.addStock(product.product_id, qty)
      setProducts((prev) =>
        prev.map((p) =>
          p.product_id === response.product_id ? { ...p, inventory_quantity: response.inventory_quantity } : p
        )
      )

      try {
        await printBarcode(product.product_id, product.item_name, qtyToPrint, printWindow, {
          section: product.section,
          height: product.height_feet,
          caliper: product.caliper_inches,
          gallons: product.gallons,
        })
        toast.success(`Added ${qty} units and printed ${qtyToPrint} barcode(s)`)
      } catch (printError: unknown) {
        printWindow?.close()
        const message = printError instanceof Error ? printError.message : 'Unknown error'
        toast.error(`Stock added, but barcode printing failed: ${message}`)
      }
    } catch (error: unknown) {
      printWindow?.close()
      const message = error instanceof Error ? error.message : 'Failed to add stock'
      toast.error(message)
    }
  }

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + products.length

  if (isLoading) return <div className="text-gray-600">Loading products...</div>

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-linear-to-r from-[#13452D] to-[#1F764D] rounded-2xl p-5 sm:p-6 text-white">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Inventory</h1>
          <p className="text-sm sm:text-base text-white/90">Stock levels, updates, and product management</p>
        </div>
        <Link href="/nursery/products/create">
          <button className="w-full sm:w-auto px-4 py-2 rounded-lg bg-white text-[#13452D] font-semibold">Add Product</button>
        </Link>
      </div>

      <div className="bg-white text-black rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-100">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full lg:flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search by product name, section, vendor, zone, or product ID..."
              className="w-full h-12 pl-12 pr-4 border-2 text-black border-gray-200 rounded-lg focus:outline-none focus:border-[#1F764D] transition-all"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 lg:flex lg:items-center lg:gap-2 lg:shrink-0">
          <button
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
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {products.map((product) => {
          const sec = normalizeProductSection(product.section)
          const sectionBadgeClass =
            sec === 'shrubs'
              ? 'bg-emerald-100 text-emerald-800'
              : sec === 'perennials'
                ? 'bg-violet-100 text-violet-800'
                : 'bg-blue-100 text-blue-800'
          return (
            <div key={product.product_id} className="bg-white rounded-2xl border border-gray-100 shadow-lg p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold mb-2 ${sectionBadgeClass}`}>
                    {getProductSectionLabel(product.section)}
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 break-words">{product.item_name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{getZoneDisplayLabel(product.zones, product.subzone || null)}</p>
                  <p className="text-sm text-gray-600">{product.size || buildSizeLabel(product.height_feet, product.caliper_inches)}</p>
                  <p className="text-xs text-gray-500 mt-1">Vendor: {getNurseryName(product.nursery_id)}</p>
                  <p className="text-xs text-gray-400">{product.product_id}</p>
                </div>
                <div className="p-2 bg-[#1F764D]/10 rounded-lg">
                  <Package className="h-5 w-5 text-[#1F764D]" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-gray-500">Inventory</p>
                  <p className="text-xl font-bold text-gray-900">{product.inventory_quantity}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-gray-500">Final Price</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(finalPrice(product.base_price_per_unit, product.rate_percentage))}</p>
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={() => handleAddStock(product)}
                  className="w-full rounded-lg border-2 border-[#1F764D]/30 bg-[#1F764D]/10 px-3 py-2 text-sm font-semibold text-[#13452D] hover:border-[#1F764D] hover:bg-[#1F764D]/15 transition-all flex items-center justify-center gap-1"
                >
                  <Plus className="h-4 w-4" /> Add Stock
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {products.length > 0 && totalPages > 1 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{startIndex + 1}</span> to{' '}
            <span className="font-semibold text-gray-900">{Math.min(endIndex, totalProducts)}</span> of{' '}
            <span className="font-semibold text-gray-900">{totalProducts}</span> products
          </div>
          <div className="grid grid-cols-2 w-full sm:w-auto items-center gap-2">
            <button onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1} className="px-4 text-black py-2 border rounded-xl disabled:opacity-50">Previous</button>
            <button onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="px-4 text-black py-2 border rounded-xl disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
