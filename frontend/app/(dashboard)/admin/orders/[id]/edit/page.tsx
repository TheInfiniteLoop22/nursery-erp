'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Plus, Search, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { orders as ordersApi, products as productsApi } from '@/app/lib/api'
import { formatCurrency } from '@/app/lib/utils'
import { buildSizeLabel } from '@/app/lib/size'
import { finalUnitPriceFromBaseAndRate } from '@/app/lib/pricing'
import { WORK_ORDER_DESIGNER_OPTIONS } from '@/app/lib/workOrderDesigners'
import { orderDetailsSchema, type OrderDetailsFormValues } from '@/app/lib/schemas'
import { firstErrorMessage } from '@/app/lib/rhf-bridge'
import { FieldError } from '@/app/components/ui/field-error'
import { WORK_ORDER_TYPE_OPTIONS, formatWorkOrderTypeLabel } from '@/app/lib/workOrderType'

interface Product {
  product_id: string
  item_name: string
  size: string
  height_feet: string
  caliper_inches: string
  inventory_quantity: number
  base_price_per_unit: string
  rate_percentage: string
}

interface OrderItem {
  product_id: string
  quantity: number
  unit_price: string
  rate_percentage: string | null
  total_price: string
}

interface EditableItem {
  product_id: string
  item_name: string
  size: string
  inventory_quantity: number
  quantity: number
  unit_price: number
  rate_percentage: number
}

interface OrderDetails {
  order_id: string
  user_id: string
  client_name: string
  work_order_type: 'MAINTENANCE' | 'INSTALL'
  designer_name?: string | null
  status: string
  items: OrderItem[]
}

export default function EditOrderPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter()
  const [orderId, setOrderId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [productsPage, setProductsPage] = useState(1)
  const [productsTotalPages, setProductsTotalPages] = useState(0)
  const [isProductsLoading, setIsProductsLoading] = useState(false)

  const form = useForm<OrderDetailsFormValues>({
    resolver: zodResolver(orderDetailsSchema),
    defaultValues: { client_name: '', work_order_type: 'INSTALL', designer_name: 'Alex' },
  })
  const { register, formState: { errors } } = form
  const [userId, setUserId] = useState('')
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])
  const [selectedItems, setSelectedItems] = useState<EditableItem[]>([])
  const [originalItemsMap, setOriginalItemsMap] = useState<Record<string, EditableItem>>({})

  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await Promise.resolve(params)
      setOrderId(resolved.id)
    }
    resolveParams()
  }, [params])

  useEffect(() => {
    if (!orderId) return
    const load = async () => {
      try {
        setIsLoading(true)
        const orderData = await ordersApi.getById(orderId) as OrderDetails
        if (orderData.status === 'COMPLETED') {
          toast.error('Completed work orders cannot be edited')
          const role = typeof window !== 'undefined' ? localStorage.getItem('user_role') : null
          router.push(role === 'nursery' ? `/nursery/orders/${orderId}` : `/admin/orders/${orderId}`)
          return
        }
        const orderItemProductIds = Array.from(new Set(orderData.items.map((item) => item.product_id)))
        const orderedProducts = await Promise.all(
          orderItemProductIds.map(async (productId) => {
            try {
              return await productsApi.getById(productId) as Product
            } catch {
              return null
            }
          })
        )

        const knownDesigner = (WORK_ORDER_DESIGNER_OPTIONS as readonly string[]).includes(orderData.designer_name ?? '')
        form.reset({
          client_name: orderData.client_name,
          work_order_type: orderData.work_order_type || 'INSTALL',
          designer_name: knownDesigner ? (orderData.designer_name as string) : 'Alex',
        })
        setUserId(orderData.user_id)
        setAvailableProducts(orderedProducts.filter((item): item is Product => item !== null))

        const productById = new Map(orderedProducts.filter((item): item is Product => item !== null).map((p) => [p.product_id, p]))

        const hydratedItems: EditableItem[] = orderData.items.map((item) => {
          const product = productById.get(item.product_id)
          return {
            product_id: item.product_id,
            item_name: product?.item_name || item.product_id,
            size: product?.size || buildSizeLabel(product?.height_feet || 'N/A', product?.caliper_inches || 'N/A'),
            inventory_quantity: product?.inventory_quantity ?? 0,
            quantity: item.quantity,
            unit_price: Number(item.unit_price),
            rate_percentage: Number(item.rate_percentage ?? 0),
          }
        })

        setSelectedItems(hydratedItems)
        setOriginalItemsMap(
          hydratedItems.reduce<Record<string, EditableItem>>((acc, current) => {
            acc[current.product_id] = { ...current }
            return acc
          }, {})
        )
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load work order'
        toast.error(message)
        router.push('/admin/orders')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [orderId, router])

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
          }) as { items: Product[]; total_pages: number }
          setAvailableProducts(data.items)
          setProductsTotalPages(data.total_pages)
        } catch (error) {
          console.error('Failed to search products:', error)
        } finally {
          setIsProductsLoading(false)
        }
      })()
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [showProductSearch, productsPage, searchQuery])

  const selectedProductIds = useMemo(() => new Set(selectedItems.map((item) => item.product_id)), [selectedItems])

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return availableProducts.filter((product) => {
      if (selectedProductIds.has(product.product_id)) return false
      if (!query) return true
      const sizeLabel = product.size || buildSizeLabel(product.height_feet, product.caliper_inches)
      return (
        product.item_name.toLowerCase().includes(query) ||
        product.product_id.toLowerCase().includes(query) ||
        sizeLabel.toLowerCase().includes(query)
      )
    })
  }, [availableProducts, searchQuery, selectedProductIds])

  const addProduct = (product: Product) => {
    if (product.inventory_quantity <= 0) {
      toast.error('Product is out of stock')
      return
    }
    setSelectedItems((prev) => [
      {
        product_id: product.product_id,
        item_name: product.item_name,
        size: product.size || buildSizeLabel(product.height_feet, product.caliper_inches),
        inventory_quantity: product.inventory_quantity,
        quantity: 1,
        unit_price: Number(product.base_price_per_unit),
        rate_percentage: Number(product.rate_percentage),
      },
      ...prev,
    ])
    setShowProductSearch(false)
    setSearchQuery('')
  }

  const removeProduct = (productId: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.product_id !== productId))
  }

  const updateQuantity = (productId: string, rawValue: string) => {
    const qty = Number(rawValue)
    if (!Number.isInteger(qty) || qty < 1) return
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? { ...item, quantity: qty }
          : item
      )
    )
  }

  const lineTotal = (item: EditableItem) => {
    const unit = finalUnitPriceFromBaseAndRate(item.unit_price, item.rate_percentage)
    const safe = Number.isFinite(unit) ? unit : 0
    return safe * item.quantity
  }

  const orderTotal = selectedItems.reduce((sum, item) => sum + lineTotal(item), 0)
  const stockShortfalls = selectedItems
    .map((item) => ({
      ...item,
      needed_to_stock: Math.max(0, item.quantity - item.inventory_quantity),
    }))
    .filter((item) => item.needed_to_stock > 0)

  const handleSave = async (values: OrderDetailsFormValues) => {
    if (selectedItems.length === 0) {
      toast.error('At least one product is required')
      return
    }

    try {
      setIsSaving(true)

      await ordersApi.updateDetails(orderId, {
        client_name: values.client_name,
        work_order_type: values.work_order_type,
        designer_name: values.designer_name as 'Alex' | 'Jordan' | 'Taylor',
      })

      const currentMap = selectedItems.reduce<Record<string, EditableItem>>((acc, item) => {
        acc[item.product_id] = item
        return acc
      }, {})

      const removedProductIds = Object.keys(originalItemsMap).filter((id) => !currentMap[id])
      for (const productId of removedProductIds) {
        await ordersApi.removeProduct(orderId, { product_id: productId })
      }

      for (const item of selectedItems) {
        const originalItem = originalItemsMap[item.product_id]
        const isNewItem = !originalItem
        const hasQuantityChanged = !!originalItem && originalItem.quantity !== item.quantity
        const hasUnitPriceChanged = !!originalItem && originalItem.unit_price !== item.unit_price
        const hasRateChanged = !!originalItem && originalItem.rate_percentage !== item.rate_percentage

        if (isNewItem || hasQuantityChanged || hasUnitPriceChanged || hasRateChanged) {
          await ordersApi.addProduct(orderId, {
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            rate_percentage: item.rate_percentage,
          })
        }
      }

      toast.success('Work order updated successfully')
      router.push(`/admin/orders/${orderId}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update work order'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="text-gray-600">Loading work order editor...</div>
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-start gap-3">
        <Link href={`/admin/orders/${orderId}`}>
          <button className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Edit Work Order</h1>
          <p className="text-sm text-gray-600">Update client, designer, and products for this work order</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(handleSave, (errs) => toast.error(firstErrorMessage(errs)))} noValidate className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <div className="xl:col-span-2 space-y-4 sm:space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Work Order Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
                <input
                  {...register('client_name')}
                  className="w-full h-11 rounded-lg border border-gray-300 px-3 text-gray-900"
                />
                <FieldError error={errors.client_name} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designer *</label>
                <select
                  {...register('designer_name')}
                  className="w-full h-11 rounded-lg border border-gray-300 px-3 bg-white text-gray-900"
                >
                  {WORK_ORDER_DESIGNER_OPTIONS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work Order Type *</label>
                <select
                  {...register('work_order_type')}
                  className="w-full h-11 rounded-lg border border-gray-300 px-3 bg-white text-gray-900"
                >
                  {WORK_ORDER_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {formatWorkOrderTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin User ID</label>
                <input
                  value={userId}
                  readOnly
                  className="w-full h-11 rounded-lg border border-gray-200 bg-gray-50 px-3 text-gray-600"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Products</h2>
              <button
                type="button"
                onClick={() => {
                  setShowProductSearch((prev) => !prev)
                  setProductsPage(1)
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-linear-to-r from-[#13452D] to-[#1F764D] px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" /> Add Product
              </button>
            </div>

            {showProductSearch && (
              <div className="mb-4 rounded-xl border border-gray-200 p-3 sm:p-4">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setProductsPage(1)
                    }}
                    placeholder="Search products..."
                    className="w-full h-10 rounded-lg border border-gray-300 pl-9 pr-3 text-sm text-gray-900"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {isProductsLoading ? (
                    <p className="text-sm text-gray-500">Loading products...</p>
                  ) : filteredProducts.map((product) => (
                    <button
                      key={product.product_id}
                      type="button"
                      onClick={() => addProduct(product)}
                      className="w-full rounded-lg border border-gray-200 p-3 text-left hover:border-[#1F764D]"
                    >
                      <p className="font-semibold text-gray-900">{product.item_name}</p>
                      <p className="text-xs text-gray-500">
                        {product.size || buildSizeLabel(product.height_feet, product.caliper_inches)} · Stock {product.inventory_quantity}
                      </p>
                    </button>
                  ))}
                  {!isProductsLoading && filteredProducts.length === 0 && <p className="text-sm text-gray-500">No products found.</p>}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
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

            <div className="space-y-3">
              {stockShortfalls.length > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                    <AlertTriangle className="h-4 w-4" />
                    Stock Required
                  </p>
                  <div className="mt-1 space-y-1 text-xs text-amber-800">
                    {stockShortfalls.map((item) => (
                      <p key={item.product_id}>
                        {item.item_name}: need {item.needed_to_stock} more in stock
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {selectedItems.map((item) => (
                <div key={item.product_id} className="rounded-xl border border-gray-200 p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{item.item_name}</p>
                      <p className="text-xs text-gray-500">{item.size}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProduct(item.product_id)}
                      className="inline-flex items-center gap-1 text-sm text-red-600"
                    >
                      <Trash2 className="h-4 w-4" /> Remove
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.product_id, e.target.value)}
                        className="mt-1 w-full h-10 rounded-lg border border-gray-300 px-3 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Unit Price</label>
                      <div className="mt-1 h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 flex items-center">
                        {formatCurrency(
                          finalUnitPriceFromBaseAndRate(item.unit_price, item.rate_percentage) || 0
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Line Total</label>
                      <div className="mt-1 h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-900 flex items-center">
                        {formatCurrency(lineTotal(item))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Products</span>
                <span className="font-semibold text-gray-900">{selectedItems.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Items</span>
                <span className="font-semibold text-gray-900">
                  {selectedItems.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              </div>
              <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-gray-700 font-medium">Order Total</span>
                <span className="text-xl font-bold text-gray-900">{formatCurrency(orderTotal)}</span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full rounded-lg bg-linear-to-r from-[#13452D] to-[#1F764D] px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <Link href={`/admin/orders/${orderId}`}>
                <button
                  type="button"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
