'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Trash2, Package, TrendingUp, ShoppingCart, BarChart3, DollarSign, AlertTriangle } from 'lucide-react'
import { BarcodeDisplay } from '@/app/components/barcode/BarcodeScanner'
import { formatCurrency } from '@/app/lib/utils'
import { products as productsApi, nurseries as nurseriesApi } from '@/app/lib/api'
import { toast } from 'sonner'
import { printBarcode } from '@/app/lib/barcodePrinter'
import { buildSizeLabel } from '@/app/lib/size'
import { finalUnitPriceFromBaseAndRate } from '@/app/lib/pricing'
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

export default function ProductDetailsPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [nursery, setNursery] = useState<Nursery | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [productId, setProductId] = useState<string | null>(null)

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await Promise.resolve(params)
      setProductId(resolvedParams.id)
    }
    resolveParams()
  }, [params])

  useEffect(() => {
    if (!productId) return

    const loadProduct = async () => {
      try {
        setIsLoading(true)
        console.log('Fetching product with ID:', productId)
        const productData = await productsApi.getById(productId)
        setProduct(productData)
        
        // Fetch nursery name
        const nurseryData = await nurseriesApi.getById(productData.nursery_id)
        setNursery(nurseryData)
      } catch (error: unknown) {
        console.error('Error fetching product:', error)
        const message = error instanceof Error ? error.message : 'Failed to load product'
        toast.error(message)
        router.push('/admin/products')
      } finally {
        setIsLoading(false)
      }
    }

    loadProduct()
  }, [productId, router])

  const handleAddStock = async () => {
    if (!product) return

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
      setProduct(prev => prev ? { ...prev, inventory_quantity: response.inventory_quantity } : prev)

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
        console.error('Stock added but barcode printing failed:', printError)
        const message = printError instanceof Error ? printError.message : 'Unknown error'
        toast.error(`Stock added, but barcode printing failed: ${message}`)
      }
    } catch (error: unknown) {
      printWindow?.close()
      console.error('Failed to add stock:', error)
      const message = error instanceof Error ? error.message : 'Failed to add stock'
      toast.error(message)
    }
  }

  const handleDeleteProduct = async () => {
    if (!product) return

    try {
      setIsDeleting(true)
      const response = await productsApi.delete(product.product_id)
      toast.success(response.message || 'Product deleted successfully')
      setShowDeleteConfirm(false)
      router.push('/admin/products')
    } catch (error: unknown) {
      console.error('Failed to delete product:', error)
      const message = error instanceof Error ? error.message : 'Failed to delete product'
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading || !product) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-[#1F764D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading product...</p>
        </div>
      </div>
    )
  }

  const baseNum = parseFloat(product.base_price_per_unit)
  const rateNum = parseFloat(product.rate_percentage)
  const finalPrice = finalUnitPriceFromBaseAndRate(baseNum, rateNum)
  const safeFinal = Number.isFinite(finalPrice) ? finalPrice : 0
  const markup = safeFinal - (Number.isFinite(baseNum) ? baseNum : 0)
  const sectionKey = normalizeProductSection(product.section)
  const sectionBadgeClass =
    sectionKey === 'shrubs'
      ? 'bg-emerald-200 text-emerald-900'
      : sectionKey === 'perennials'
        ? 'bg-violet-200 text-violet-900'
        : 'bg-blue-200 text-blue-900'

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-[#13452D] to-[#1F764D] rounded-2xl p-5 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3 sm:gap-6">
            <Link href="/admin/products">
              <button className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-all hover:scale-105">
                <ArrowLeft className="h-6 w-6 text-white" />
              </button>
            </Link>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Package className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-4xl font-bold wrap-break-word">{product.item_name}</h1>
                  <p className="text-white/90 text-sm sm:text-lg mt-1 flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 bg-white/20 rounded-lg font-medium">{product.size || buildSizeLabel(product.height_feet, product.caliper_inches)}</span>
                    <span className="text-white/60">•</span>
                    <span className="font-medium">{nursery?.nursery_name || 'Unknown vendor'}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <span className="text-sm text-white/70">Product ID:</span>
                <span className="px-3 py-1 bg-white/20 rounded-lg font-mono text-sm">{product.product_id}</span>
                <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${sectionBadgeClass}`}>
                  {getProductSectionLabel(product.section)}
                </span>
                <span className="px-3 py-1 bg-white/20 rounded-lg text-sm font-semibold">{getZoneDisplayLabel(product.zones, product.subzone || null)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Link href={`/admin/products/${product.product_id}/edit`}>
              <button className="w-full sm:w-auto px-4 py-3 bg-white text-[#13452D] rounded-xl font-semibold hover:bg-white/90 transition-all hover:scale-105 flex items-center justify-center gap-2">
                <Edit className="h-4 w-4" />
                Edit
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        {/* Inventory Card */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6 hover:shadow-2xl hover:border-green-200 transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl">
              <Package className="h-6 w-6 text-white" />
            </div>
            {product.inventory_quantity < 10 && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-lg flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Low
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 font-medium mb-1">In Stock</p>
          <p className={`text-3xl font-bold ${
            product.inventory_quantity < 10 ? 'text-red-600' : 'text-green-600'
          }`}>{product.inventory_quantity}</p>
          <p className="text-xs text-gray-500 mt-2">Available units</p>
        </div>

        {/* Ordered Card */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6 hover:shadow-2xl hover:border-blue-200 transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
              <ShoppingCart className="h-6 w-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-gray-600 font-medium mb-1">Ordered</p>
          <p className="text-3xl font-bold text-blue-600">{product.ordered_quantity}</p>
          <p className="text-xs text-gray-500 mt-2">Pending fulfillment</p>
        </div>

        {/* Price Card */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6 hover:shadow-2xl hover:border-purple-200 transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-gray-600 font-medium mb-1">Final Price</p>
          <p className="text-3xl font-bold bg-gradient-to-r from-[#13452D] to-[#1F764D] bg-clip-text text-transparent">
            {formatCurrency(safeFinal)}
          </p>
          <p className="text-xs text-gray-500 mt-2">Per unit</p>
        </div>

        {/* Total Value Card */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6 hover:shadow-2xl hover:border-emerald-200 transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-gray-600 font-medium mb-1">Total Value</p>
          <p className="text-3xl font-bold text-emerald-600">
            {formatCurrency(safeFinal * product.inventory_quantity)}
          </p>
          <p className="text-xs text-gray-500 mt-2">Inventory worth</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column - Product Details & Pricing */}
        <div className="xl:col-span-2 space-y-4 sm:space-y-6">
          {/* Product Information */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#13452D]/5 to-[#1F764D]/5 border-b-2 border-gray-100 p-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-[#1F764D]" />
                Product Information
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Product Name</p>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${sectionBadgeClass}`}>
                    {getProductSectionLabel(product.section)}
                  </span>
                  <p className="text-lg font-bold text-gray-900">{product.item_name}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Zone</p>
                  <p className="text-lg font-bold text-gray-900">{getZoneDisplayLabel(product.zones, product.subzone || null)}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Size</p>
                  <p className="text-lg font-bold text-gray-900">{product.size || buildSizeLabel(product.height_feet, product.caliper_inches)}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Height (ft)</p>
                  <p className="text-lg font-bold text-gray-900">{product.height_feet || 'N/A'}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Caliper (in)</p>
                  <p className="text-lg font-bold text-gray-900">{product.caliper_inches || 'N/A'}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Vendor</p>
                  <p className="text-lg font-bold text-gray-900">{nursery?.nursery_name || 'Unknown'}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Status</p>
                  <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold ${
                    product.inventory_quantity < 10 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-green-100 text-green-700'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      product.inventory_quantity < 10 ? 'bg-red-500' : 'bg-green-500'
                    } animate-pulse`}></div>
                    {product.inventory_quantity < 10 ? 'Low Stock' : 'In Stock'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#13452D]/5 to-[#1F764D]/5 border-b-2 border-gray-100 p-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-[#1F764D]" />
                Pricing Details
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm text-gray-600 font-medium mb-1">Base Price</p>
                    <p className="text-xs text-gray-500">Cost per unit</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(parseFloat(product.base_price_per_unit))}</p>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#1F764D]/10 to-[#13452D]/10 rounded-xl">
                  <div>
                    <p className="text-sm text-gray-600 font-medium mb-1">Price multiplier</p>
                    <p className="text-xs text-gray-500">Applied as base × rate</p>
                  </div>
                  <p className="text-2xl font-bold text-[#1F764D]">×{product.rate_percentage}</p>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
                  <div>
                    <p className="text-sm text-gray-600 font-medium mb-1">Markup Amount</p>
                    <p className="text-xs text-gray-500">Additional profit</p>
                  </div>
                  <p className="text-2xl font-bold text-green-600">+{formatCurrency(markup)}</p>
                </div>

                <div className="h-px bg-gray-300 my-4"></div>
                
                <div className="flex items-center justify-between p-6 bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-xl text-white">
                  <div>
                    <p className="text-sm text-white/80 font-medium mb-1">Final Selling Price</p>
                    <p className="text-xs text-white/60">Price per unit</p>
                  </div>
                  <p className="text-4xl font-bold">{formatCurrency(safeFinal)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Inventory Status */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#13452D]/5 to-[#1F764D]/5 border-b-2 border-gray-100 p-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Package className="h-6 w-6 text-[#1F764D]" />
                Inventory Status
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-500 rounded-lg">
                      <Package className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Available Stock</p>
                      <p className="text-sm text-gray-600">Ready to sell</p>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-green-600">{product.inventory_quantity}</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500 rounded-lg">
                      <ShoppingCart className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Ordered Quantity</p>
                      <p className="text-sm text-gray-600">Pending orders</p>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-blue-600">{product.ordered_quantity}</p>
                </div>

                {product.inventory_quantity < 10 && (
                  <div className="flex items-center gap-3 p-4 bg-red-50 border-l-4 border-red-500 rounded-xl">
                    <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-red-900">Low Stock Alert</p>
                      <p className="text-sm text-red-700">Stock level is below minimum threshold. Consider reordering.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Barcode & Quick Actions */}
        <div className="space-y-6">
          {/* Barcode Section */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#13452D]/5 to-[#1F764D]/5 border-b-2 border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-900">Product Barcode</h2>
            </div>
            <div className="p-6">
              <div className="bg-gray-50 rounded-xl p-6">
                <BarcodeDisplay 
                  barcode={product.product_id}
                  productName={product.item_name}
                  size="lg"
                />
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#13452D]/5 to-[#1F764D]/5 border-b-2 border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>
            </div>
            <div className="p-6 space-y-3">
              <Link href={`/admin/products/${product.product_id}/edit`}>
                <button className="w-full px-4 py-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2">
                  <Edit className="h-5 w-5" />
                  Edit Product
                </button>
              </Link>
              
              <button
                onClick={handleAddStock}
                className="w-full px-4 py-4 border-2 border-emerald-200 text-emerald-700 rounded-xl font-semibold hover:border-emerald-500 hover:bg-emerald-50 hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                <Package className="h-5 w-5" />
                Add Stock
              </button>
              
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full px-4 py-4 border-2 border-red-200 text-red-600 rounded-xl font-semibold hover:border-red-500 hover:bg-red-50 hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="h-5 w-5" />
                Delete Product
              </button>
            </div>
          </div>

          {/* Product Summary */}
          <div className="bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-2xl shadow-lg p-6 text-white">
            <h3 className="text-lg font-bold mb-4">Product Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-white/80">Total Units:</span>
                <span className="font-bold text-xl">{product.inventory_quantity}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/80">Unit Price:</span>
                <span className="font-bold text-xl">{formatCurrency(safeFinal)}</span>
              </div>
              <div className="h-px bg-white/20 my-2"></div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-white/90 font-semibold">Total Value:</span>
                <span className="font-bold text-2xl">{formatCurrency(safeFinal * product.inventory_quantity)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900">Delete Product?</h3>
            <p className="mt-2 text-sm text-gray-600">
              You are about to delete <span className="font-semibold text-gray-900">{product.item_name}</span> ({product.product_id}).
              This action cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProduct}
                disabled={isDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}