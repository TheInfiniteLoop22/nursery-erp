'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Search, Package, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/app/lib/utils'
import { toast } from 'sonner'
import { products as productsApi, orders as ordersApi, nurseries as nurseriesApi } from '@/app/lib/api'
import { buildSizeLabel } from '@/app/lib/size'
import { finalUnitPriceFromBaseAndRate } from '@/app/lib/pricing'
import { WORK_ORDER_DESIGNER_OPTIONS } from '@/app/lib/workOrderDesigners'
import { WORK_ORDER_TYPE_OPTIONS, formatWorkOrderTypeLabel } from '@/app/lib/workOrderType'
import { orderCreateSchema, type OrderCreateFormValues } from '@/app/lib/schemas'
import { firstErrorMessage } from '@/app/lib/rhf-bridge'
import { FieldError } from '@/app/components/ui/field-error'

interface Product {
  product_id: string
  nursery_id: string
  item_name: string
  size: string
  height_feet: string
  caliper_inches: string
  inventory_quantity: number
  ordered_quantity: number
  base_price_per_unit: string
  rate_percentage: string
  image_url?: string | null
}

interface OrderProduct extends Product {
  quantity: number
}

interface Nursery {
  nursery_id: string
  nursery_name: string
}

export default function CreateOrderPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([])
  const [productsPage, setProductsPage] = useState(1)
  const [productsTotalPages, setProductsTotalPages] = useState(0)
  const [isProductsLoading, setIsProductsLoading] = useState(false)
  const [nurseries, setNurseries] = useState<Nursery[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // RHF owns the header fields and the line items (useFieldArray). Display data for each
  // product lives in `productInfo`, so the form values stay exactly what the API needs.
  const form = useForm<OrderCreateFormValues>({
    resolver: zodResolver(orderCreateSchema),
    defaultValues: {
      client_name: '',
      user_id: '',
      work_order_type: 'INSTALL',
      designer_name: 'Alex',
      items: [],
    },
  })
  const { register, control, formState: { errors } } = form
  const { prepend, remove } = useFieldArray({ control, name: 'items' })
  const formData = form.watch()
  const watchedItems = form.watch('items')
  const [productInfo, setProductInfo] = useState<Record<string, Product>>({})
  const selectedProducts: OrderProduct[] = watchedItems
    .filter((item) => productInfo[item.product_id])
    .map((item) => ({ ...productInfo[item.product_id], quantity: item.quantity }))

  useEffect(() => {
    const fetchData = async () => {
      try {
        const nurseriesData = await nurseriesApi.getAll()
        setNurseries(nurseriesData)
      } catch (error: unknown) {
        console.error('Error fetching data:', error)
        toast.error('Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (!showProductSearch) return
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          setIsProductsLoading(true)
          const data = await productsApi.getAll({
            page: productsPage,
            page_size: 12,
            search: searchQuery || undefined,
          })
          const selectedIds = new Set(selectedProducts.map((p) => p.product_id))
          setProductSearchResults(data.items.filter((p) => !selectedIds.has(p.product_id)))
          setProductsTotalPages(data.total_pages)
        } catch (error) {
          console.error('Failed to search products:', error)
        } finally {
          setIsProductsLoading(false)
        }
      })()
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [showProductSearch, productsPage, searchQuery, selectedProducts])

  const addProduct = (product: Product) => {
    if (watchedItems.some((item) => item.product_id === product.product_id)) {
      toast.error('Product already added to this work order')
      return
    }

    if (product.inventory_quantity === 0) {
      toast.error('Product is out of stock')
      return
    }

    // New products go to the top of the list
    setProductInfo((prev) => ({ ...prev, [product.product_id]: product }))
    prepend({ product_id: product.product_id, quantity: 1 })
    setShowProductSearch(false)
    setSearchQuery('')
    setProductsPage(1)
  }

  const removeProduct = (productId: string) => {
    const index = watchedItems.findIndex((item) => item.product_id === productId)
    if (index >= 0) remove(index)
  }

  const updateQuantity = (productId: string, value: string) => {
    const index = watchedItems.findIndex((item) => item.product_id === productId)
    if (index < 0) return
    const path = `items.${index}.quantity` as const
    // Allow an empty box so the user can clear it and type a new value
    if (value === '') {
      form.setValue(path, NaN, { shouldDirty: true })
      return
    }
    const quantity = parseInt(value)
    if (Number.isNaN(quantity)) return
    form.setValue(path, quantity, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
  }

  const calculateProductTotal = (product: OrderProduct) => {
    const basePrice = parseFloat(product.base_price_per_unit)
    const rate = parseFloat(product.rate_percentage)
    const unitPrice = finalUnitPriceFromBaseAndRate(basePrice, rate)
    const safe = Number.isFinite(unitPrice) ? unitPrice : 0
    return safe * product.quantity
  }

  const getUnitPrice = (product: Product) => {
    const basePrice = parseFloat(product.base_price_per_unit)
    const rate = parseFloat(product.rate_percentage)
    const unitPrice = finalUnitPriceFromBaseAndRate(basePrice, rate)
    return Number.isFinite(unitPrice) ? unitPrice : 0
  }

  const getNurseryName = (nurseryId: string) => {
    const nursery = nurseries.find(n => n.nursery_id === nurseryId)
    return nursery?.nursery_name || nurseryId
  }

  const calculateOrderTotal = () => {
    return selectedProducts.reduce((sum, product) => sum + calculateProductTotal(product), 0)
  }

  const stockShortfalls = selectedProducts
    .map((product) => ({
      ...product,
      needed_to_stock: Math.max(0, product.quantity - product.inventory_quantity),
    }))
    .filter((item) => item.needed_to_stock > 0)

  const onSubmit = async (values: OrderCreateFormValues) => {
    setIsSubmitting(true)

    try {
      // Step 1: Create order
      const orderResponse = await ordersApi.create({
        user_id: values.user_id,
        client_name: values.client_name,
        work_order_type: values.work_order_type,
        designer_name: values.designer_name as 'Alex' | 'Jordan' | 'Taylor',
      })
      
      const orderId = orderResponse.order_id
      
      // Step 2: Add products to order
      for (const product of selectedProducts) {
        await ordersApi.addProduct(orderId, {
          product_id: product.product_id,
          quantity: product.quantity,
          unit_price: parseFloat(product.base_price_per_unit),
          rate_percentage: parseFloat(product.rate_percentage)
        })
      }
      
      toast.success('Work order created successfully!')
      router.push('/admin/orders')
    } catch (error: unknown) {
      console.error('Error creating order:', error)
      const message = error instanceof Error ? error.message : 'Failed to create work order'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-[#1F764D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading products...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 sm:gap-4">
          <Link href="/admin/orders">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900">Create New Work Order</h1>
            <p className="text-gray-500 mt-2">Build a new work order with products and client details</p>
          </div>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit, (errs) => toast.error(firstErrorMessage(errs)))} noValidate>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Form */}
          <div className="xl:col-span-2 space-y-4 sm:space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Work Order Information</h2>
                <p className="text-sm text-gray-500">Enter client, designer, and admin details</p>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Client Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('client_name')}
                    placeholder="Enter client or company name"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F764D] focus:border-transparent transition-all text-black"
                  />
                  <FieldError error={errors.client_name} />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Admin User ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('user_id')}
                    placeholder="e.g., ADM001"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F764D] focus:border-transparent transition-all text-black"
                  />
                  <FieldError error={errors.user_id} />
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Use your admin user ID from login
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Designer <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('designer_name')}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F764D] focus:border-transparent transition-all text-black bg-white"
                  >
                    {WORK_ORDER_DESIGNER_OPTIONS.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Work Order Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('work_order_type')}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F764D] focus:border-transparent transition-all text-black bg-white"
                  >
                    {WORK_ORDER_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {formatWorkOrderTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Work Order Products</h2>
                  <p className="text-sm text-gray-500">Add products to this work order</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowProductSearch(!showProductSearch)
                    setProductsPage(1)
                  }}
                  className="px-4 py-2.5 bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white rounded-lg font-medium hover:shadow-md transition-all flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Product
                </button>
              </div>
              <div className="space-y-4">
                {/* Product Search */}
                {showProductSearch && (
                  <div className="border-2 border-[#1F764D]/20 rounded-xl p-5 bg-gradient-to-br from-green-50/50 to-white">
                    <div className="relative mb-4">
                      <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by name, height, caliper, or size..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          setProductsPage(1)
                        }}
                        className="w-full text-black pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F764D] focus:border-transparent transition-all"
                      />
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                      {isProductsLoading ? (
                        <div className="py-8 text-center text-sm text-gray-500">Loading products...</div>
                      ) : productSearchResults.map(product => (
                        <div
                          key={product.product_id}
                          onClick={() => addProduct(product)}
                          className="group relative bg-white rounded-xl p-4 cursor-pointer border-2 border-gray-100 hover:border-[#1F764D] hover:shadow-lg transition-all duration-300"
                        >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            {/* Left side - Product info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-3">
                                <div className="p-2.5 bg-gradient-to-br from-[#1F764D]/10 to-[#13452D]/10 rounded-lg group-hover:from-[#1F764D]/20 group-hover:to-[#13452D]/20 transition-colors">
                                  <Package className="h-5 w-5 text-[#1F764D]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-gray-900 text-base truncate group-hover:text-[#1F764D] transition-colors">{product.item_name}</h4>
                                  <p className="text-sm text-gray-600 mt-0.5">{product.size || buildSizeLabel(product.height_feet, product.caliper_inches)}</p>
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <span className="w-1.5 h-1.5 bg-[#1F764D] rounded-full"></span>
                                    <span className="text-xs text-gray-500 font-medium">{getNurseryName(product.nursery_id)}</span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Stock info badges */}
                              <div className="flex gap-2 mt-3">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-md border border-green-200">
                                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                  <span className="text-xs font-semibold text-green-700">Stock: {product.inventory_quantity}</span>
                                </div>
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-md border border-blue-200">
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                  <span className="text-xs font-semibold text-blue-700">Ordered: {product.ordered_quantity}</span>
                                </div>
                              </div>
                            </div>

                            {/* Right side - Price */}
                            <div className="text-left sm:text-right">
                              <div className="px-3 py-1.5 bg-gradient-to-r from-[#13452D] to-[#1F764D] rounded-lg">
                                <p className="text-xs text-white/80 font-medium">Price</p>
                                <p className="text-lg font-bold text-white">
                                  {formatCurrency(getUnitPrice(product))}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Hover indicator */}
                          <div className="absolute inset-0 border-2 border-transparent group-hover:border-[#1F764D] rounded-xl pointer-events-none transition-all"></div>
                        </div>
                      ))}
                      {!isProductsLoading && productSearchResults.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <p className="font-medium">No products found</p>
                          <p className="text-sm mt-1">Try a different search term</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                      <button
                        type="button"
                        disabled={productsPage <= 1}
                        onClick={() => setProductsPage((p) => Math.max(1, p - 1))}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600">Page {productsPage} of {Math.max(1, productsTotalPages)}</span>
                      <button
                        type="button"
                        disabled={productsPage >= productsTotalPages}
                        onClick={() => setProductsPage((p) => p + 1)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {/* Selected Products */}
                <FieldError error={errors.items?.root} />
                {selectedProducts.length === 0 ? (
                  <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-white rounded-2xl border-2 border-dashed border-gray-300">
                    <div className="inline-flex p-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl mb-4 shadow-inner">
                      <Plus className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="font-bold text-gray-900 text-lg">No products added yet</p>
                    <p className="text-sm text-gray-500 mt-2">Click &quot;Add Product&quot; to start building this work order</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stockShortfalls.length > 0 && (
                      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                        <p className="flex items-center gap-2 font-semibold text-amber-900">
                          <AlertTriangle className="h-4 w-4" />
                          Stock Required Before Full Scan
                        </p>
                        <div className="mt-2 space-y-1 text-sm text-amber-800">
                          {stockShortfalls.map((item) => (
                            <p key={item.product_id}>
                              {item.item_name}: need {item.needed_to_stock} more in stock
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedProducts.map(product => (
                      <div key={product.product_id} className="group relative bg-white border-2 border-gray-200 rounded-2xl p-4 sm:p-6 hover:border-[#1F764D] hover:shadow-xl transition-all duration-300">
                        {/* Product Header */}
                        <div className="flex items-start gap-3 sm:gap-4 mb-5">
                          {/* Product Icon */}
                          <div className="p-3 bg-gradient-to-br from-[#1F764D]/10 to-[#13452D]/10 rounded-xl group-hover:from-[#1F764D]/20 group-hover:to-[#13452D]/20 transition-colors">
                            <Package className="h-6 w-6 text-[#1F764D]" />
                          </div>
                          
                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 text-base sm:text-lg mb-1 wrap-break-word">{product.item_name}</h4>
                            <p className="text-sm text-gray-600 mb-2">{product.size || buildSizeLabel(product.height_feet, product.caliper_inches)}</p>
                            
                            <div className="flex items-center gap-2 mb-3">
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-[#1F764D] rounded-full"></span>
                                <span className="text-xs text-gray-600 font-medium">{getNurseryName(product.nursery_id)}</span>
                              </div>
                            </div>
                            
                            {/* Stock badges */}
                            <div className="flex flex-wrap gap-2">
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-lg border border-green-200">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-xs font-bold text-green-700">Stock: {product.inventory_quantity}</span>
                              </div>
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span className="text-xs font-bold text-blue-700">Ordered: {product.ordered_quantity}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => removeProduct(product.product_id)}
                            className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-all hover:scale-110"
                            title="Remove product"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                        
                        {/* Quantity and Price Section */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-5 border-t-2 border-gray-100">
                          <div>
                            <label className="text-xs font-bold text-gray-700 uppercase mb-2 block tracking-wide">Quantity</label>
                            <input
                              type="number"
                              min="1"
                              value={product.quantity || ''}
                              onFocus={(e) => {
                                e.target.select()
                              }}
                              onChange={(e) => updateQuantity(product.product_id, e.target.value)}
                              onBlur={(e) => {
                                if (!e.target.value || parseInt(e.target.value) < 1) {
                                  updateQuantity(product.product_id, '1')
                                }
                              }}
                              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F764D] focus:border-[#1F764D] text-gray-900 font-bold text-center transition-all"
                            />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-bold text-gray-700 uppercase mb-2 tracking-wide">Unit Price</p>
                            <div className="px-3 py-2.5 bg-gray-50 rounded-xl border-2 border-gray-100">
                              <p className="text-base font-bold text-gray-900">
                                {formatCurrency(getUnitPrice(product))}
                              </p>
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-bold text-gray-700 uppercase mb-2 tracking-wide">Subtotal</p>
                            <div className="px-3 py-2.5 bg-gradient-to-r from-[#13452D] to-[#1F764D] rounded-xl shadow-md">
                              <p className="text-base font-bold text-white">
                                {formatCurrency(calculateProductTotal(product))}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 xl:sticky xl:top-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h2>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Client</span>
                  <span className="font-semibold text-gray-900 wrap-break-word text-right">{formData.client_name || '-'}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Admin ID</span>
                  <span className="font-semibold text-gray-900 wrap-break-word text-right">{formData.user_id || '-'}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Products</span>
                  <span className="font-semibold text-gray-900">{selectedProducts.length}</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-sm text-gray-600">Total Items</span>
                  <span className="font-semibold text-gray-900">
                    {selectedProducts.reduce((sum, p) => sum + (p.quantity || 0), 0)}
                  </span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-xl p-5 mb-6">
                <p className="text-sm text-white/80 mb-2 font-medium">Order Total</p>
                <p className="text-2xl sm:text-3xl font-bold text-white wrap-break-word">
                  {formatCurrency(calculateOrderTotal())}
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={isSubmitting || selectedProducts.length === 0}
                  className="w-full px-6 py-3.5 bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating Order...
                    </span>
                  ) : 'Create Order'}
                </button>
                <Link href="/admin/orders">
                  <button
                    type="button"
                    className="w-full px-6 py-3.5 bg-white border border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                </Link>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex items-start gap-2 text-xs text-gray-500">
                  <svg className="h-4 w-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-medium mb-1">Note:</p>
                    <p>Order status will be set to CREATED. You can generate an invoice after order creation.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}