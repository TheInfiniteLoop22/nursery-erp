'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, ScanLine, CheckCircle, Package, AlertCircle, AlertTriangle, Printer } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { BarcodeScanner } from '@/app/components/barcode/BarcodeScanner'
import { toast } from 'sonner'
import { orders as ordersApi, products as productsApi, scans as scansApi } from '@/app/lib/api'
import { formatCurrency } from '@/app/lib/utils'
import { useLiveEvents } from '@/app/lib/useLiveEvents'
import { finalUnitPriceFromBaseAndRate } from '@/app/lib/pricing'
import { convertToEAN13Format, calculateEAN13CheckDigit } from '@/app/lib/barcodePrinter'
import { isShrubsProduct, normalizeProductSection, sectionUsesGallonPotFields } from '@/app/lib/productCategory'
import { Input } from '@/app/components/ui/input'
import { getZoneDisplayLabel } from '@/app/lib/zone'
import { printOrderPickList } from '@/app/lib/orderPickListPrint'
import { getProductSectionLabel } from '@/app/lib/productCategory'
import { formatOrderPickListSize } from '@/app/lib/size'

interface OrderProduct {
  product_id: string
  name: string
  size: string
  section: string
  zones: number
  subzone?: string | null
  height_feet: string | null
  caliper_inches: string | null
  gallons: string | null
  quantity: number
  /** Base unit price stored on the line (before rate multiplier). */
  unit_price: string
  rate_percentage: string | null
  total_price: string
  scanned_quantity: number
  is_shrubs: boolean
  inventory_quantity: number
}

interface Order {
  order_id: string
  client_name: string
  designer_name?: string | null
  status: string
  total_order_amount: string
  paid_at: string | null
  ordered_at: string
}

const initialProducts: OrderProduct[] = []

export default function EmployeeOrderScanPage({ params }: { params: Promise<{ id: string }> }) {
  const [orderId, setOrderId] = useState<string>('')
  const [order, setOrder] = useState<Order | null>(null)
  const [products, setProducts] = useState<OrderProduct[]>(initialProducts)
  const [isLoading, setIsLoading] = useState(true)
  const [scannerActive, setScannerActive] = useState(false)
  const [shrubScanQuantities, setShrubScanQuantities] = useState<Record<string, number>>({})
  const basePath = typeof window !== 'undefined' && localStorage.getItem('user_role') === 'nursery' ? '/nursery' : '/employee'
  const currentRole = typeof window !== 'undefined' ? localStorage.getItem('user_role') : null

  useEffect(() => {
    const loadParams = async () => {
      const resolvedParams = await params
      setOrderId(resolvedParams.id)
    }
    loadParams()
  }, [params])

  useEffect(() => {
    if (!orderId) return

    const fetchOrderDetails = async () => {
      try {
        const orderData = await ordersApi.getById(orderId)
        
        setOrder({
          order_id: orderData.order_id,
          client_name: orderData.client_name,
          designer_name: orderData.designer_name ?? null,
          status: orderData.status,
          total_order_amount: orderData.total_order_amount,
          paid_at: orderData.paid_at || null,
          ordered_at: orderData.ordered_at,
        })

        // Fetch product details for each item
        const productDetails = await Promise.all(
          orderData.items.map(async (item) => {
            try {
              const product = await productsApi.getById(item.product_id)
              return {
                product_id: item.product_id,
                name: product.item_name,
                size: product.size,
                section: product.section || 'tree',
                zones: product.zones ?? 1,
                subzone: product.subzone ?? null,
                height_feet: product.height_feet ?? null,
                caliper_inches: product.caliper_inches ?? null,
                gallons: product.gallons ?? null,
                quantity: item.quantity,
                unit_price: item.unit_price,
                rate_percentage: item.rate_percentage,
                total_price: item.total_price,
                scanned_quantity: 0, // TODO: Fetch from scan logs
                is_shrubs: isShrubsProduct(product.section),
                inventory_quantity: product.inventory_quantity,
              }
            } catch (error: unknown) {
              console.error(`Error fetching product ${item.product_id}:`, error)
              return {
                product_id: item.product_id,
                name: 'Unknown Product',
                size: 'N/A',
                section: 'tree',
                zones: 1,
                subzone: null,
                height_feet: null,
                caliper_inches: null,
                gallons: null,
                quantity: item.quantity,
                unit_price: item.unit_price,
                rate_percentage: item.rate_percentage,
                total_price: item.total_price,
                scanned_quantity: 0,
                is_shrubs: false,
                inventory_quantity: 0,
              }
            }
          })
        )

        setProducts(productDetails)

        const orderedUnitsTotal = orderData.items.reduce((sum, row) => sum + row.quantity, 0)
        console.log('[ERP fetch] order detail (scan page)', {
          orderId,
          apiLineItems: orderData.items.length,
          orderedUnitsTotal,
          hydratedProductRows: productDetails.length,
        })

        // Load existing scan logs so scanned_quantity is accurate on re-visit
        try {
          const scanData = await scansApi.getForOrder(orderId)
          if (scanData.scanned_quantities) {
            const keys = Object.keys(scanData.scanned_quantities)
            const scannedUnitsTotal = keys.reduce(
              (sum, pid) => sum + (scanData.scanned_quantities![pid] ?? 0),
              0
            )
            console.log('[ERP fetch] order scan logs', {
              orderId,
              productsWithScanEntries: keys.length,
              scannedUnitsTotal,
            })
            setProducts(prev =>
              prev.map(p => ({
                ...p,
                scanned_quantity: scanData.scanned_quantities[p.product_id] ?? 0,
              }))
            )
          }
        } catch {
          // Non-fatal – UI still works without restored scan counts
        }
      } catch (error: unknown) {
        console.error('Error fetching order:', error)
        const message = error instanceof Error ? error.message : 'Failed to load work order details'
        toast.error(message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrderDetails()
  }, [orderId])

  // Live sync: scans made by someone else on this order, and status changes, arrive over SSE.
  const { connected: isLive } = useLiveEvents((event) => {
    if (!orderId || event.order_id !== orderId) return
    if (event.type === 'scan') {
      if (event.by_user_id === localStorage.getItem('user_id')) return // our own scan is already applied locally
      setProducts((prev) =>
        prev.map((p) =>
          p.product_id === event.product_id
            ? { ...p, scanned_quantity: p.scanned_quantity + event.quantity_scanned }
            : p
        )
      )
      toast.info(`${event.by} scanned ${event.quantity_scanned} × ${event.product_id}`)
    } else if (event.type === 'order_status') {
      setOrder((prev) => (prev ? { ...prev, status: event.status } : prev))
      toast.info(`Order marked ${event.status.replace('_', ' ')} by ${event.by}`)
    }
  })

  useEffect(() => {
    setShrubScanQuantities(prev => {
      const next: Record<string, number> = {}

      products.forEach(product => {
        if (!product.is_shrubs) {
          return
        }

        const remaining = Math.max(0, product.quantity - product.scanned_quantity)
        if (remaining <= 0) {
          return
        }

        const maxScannable = Math.min(remaining, product.inventory_quantity)
        const existing = prev[product.product_id]
        if (maxScannable < 1) {
          next[product.product_id] = 0
        } else if (!existing || existing < 1 || existing > maxScannable) {
          next[product.product_id] = maxScannable
        } else {
          next[product.product_id] = existing
        }
      })

      return next
    })
  }, [products])

  const getShrubsScanQuantity = (product: OrderProduct) => {
    const remaining = Math.max(0, product.quantity - product.scanned_quantity)
    if (remaining <= 0) {
      return 0
    }

    const maxByInventory = Math.max(0, product.inventory_quantity)
    const cap = Math.min(remaining, maxByInventory)
    if (cap <= 0) {
      return 0
    }

    const requested = shrubScanQuantities[product.product_id] ?? cap
    if (!Number.isFinite(requested) || requested < 1) {
      return Math.min(1, cap)
    }
    return Math.min(cap, Math.floor(requested))
  }

  const handleScan = async (barcode: string) => {
    // Do NOT close the scanner — user wants to keep scanning
    // Strip any non-digit characters a scanner might add (prefix/suffix/CR/LF)
    const cleanBarcode = barcode.replace(/\D/g, '')
    if (!cleanBarcode) {
      toast.error('Invalid barcode — no digits received')
      return
    }

    // EAN-13 scanners send 13 digits (12-digit base + check digit).
    // Some scanners drop leading zeros, so we also compare stripped versions.
    const stripLeadingZeros = (s: string) => s.replace(/^0+/, '') || '0'

    const matched = products.find(p => {
      const ean12     = convertToEAN13Format(p.product_id)          // 12 digits
      const ean13Full = ean12 + calculateEAN13CheckDigit(ean12)     // 13 digits
      return (
        cleanBarcode === ean13Full ||
        cleanBarcode === ean12 ||
        stripLeadingZeros(cleanBarcode) === stripLeadingZeros(ean13Full) ||
        stripLeadingZeros(cleanBarcode) === stripLeadingZeros(ean12)
      )
    })

    if (!matched) {
      toast.error('Scanned barcode does not match any product on this work order')
      return
    }

    if (matched.scanned_quantity >= matched.quantity) {
      toast.warning(`${matched.name} is already fully scanned`)
      return
    }

    const remaining = matched.quantity - matched.scanned_quantity
    const maxByStock = Math.min(remaining, Math.max(0, matched.inventory_quantity))
    const scanQuantity = matched.is_shrubs
      ? Math.min(getShrubsScanQuantity(matched), maxByStock)
      : Math.min(1, maxByStock)

    if (maxByStock <= 0 && remaining > 0) {
      toast.warning(
        `${matched.name}: no units in inventory to scan. Need ${remaining} more in vendor stock before scanning can continue.`
      )
      return
    }

    if (scanQuantity <= 0) {
      toast.warning(`${matched.name} is already fully scanned`)
      return
    }

    try {
      // Sync inventory from API response for shortfall indicators.
      const scanResponse = await scansApi.record({
        order_id: orderId,
        product_id: matched.product_id,
        quantity_scanned: scanQuantity,
      })

      setProducts(prev =>
        prev.map(p =>
          p.product_id === matched.product_id
            ? {
                ...p,
                scanned_quantity: p.scanned_quantity + scanResponse.quantity_scanned,
                inventory_quantity: scanResponse.new_inventory_quantity,
              }
            : p
        )
      )
      toast.success(`Scanned: ${matched.name} (${matched.scanned_quantity + scanResponse.quantity_scanned}/${matched.quantity})`)
      if (scanResponse.shortage_to_stock > 0) {
        toast.warning(`Need ${scanResponse.shortage_to_stock} more in stock for ${matched.name}`)
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to record scan'
      toast.error(message)
    }
  }

  const handleCompleteOrder = async () => {
    const allScanned = products.every(p => p.scanned_quantity >= p.quantity)

    if (!allScanned) {
      toast.error('Please scan all required products before completing the work order')
      return
    }

    try {
      await ordersApi.updateStatus(orderId, 'COMPLETED')
      toast.success('Work order completed successfully!')
      toast.info('Admin has been notified')
      if (order) {
        setOrder({ ...order, status: 'COMPLETED' })
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to complete work order'
      toast.error(message)
    }
  }

  const handlePrintPickList = () => {
    if (!order) return
    try {
      printOrderPickList({
        orderId: order.order_id,
        clientName: order.client_name,
        designerName: order.designer_name,
        status: order.status,
        orderedAt: order.ordered_at,
        lines: products.map((p) => ({
          productName: p.name,
          size: formatOrderPickListSize(p.section, p.size, p.height_feet, p.caliper_inches, p.gallons),
          quantity: p.quantity,
          zoneLabel: getZoneDisplayLabel(p.zones, p.subzone ?? null),
          sectionLabel: getProductSectionLabel(p.section),
          productId: p.product_id,
          scannedQuantity: p.scanned_quantity,
        })),
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not open print window'
      toast.error(message)
    }
  }

  const totalRequired = products.reduce((sum, p) => sum + p.quantity, 0)
  const totalScanned = products.reduce((sum, p) => sum + p.scanned_quantity, 0)
  const progress = totalRequired > 0 ? (totalScanned / totalRequired) * 100 : 0
  const allComplete = products.every(p => p.scanned_quantity >= p.quantity) && products.length > 0
  const shortfalls = products
    .map((p) => {
      const remaining = Math.max(0, p.quantity - p.scanned_quantity)
      const needed = Math.max(0, remaining - p.inventory_quantity)
      const canScanNow = Math.min(remaining, p.inventory_quantity)
      return { ...p, needed, remaining, canScanNow }
    })
    .filter((item) => item.needed > 0)

  const shortfallByProductId = new Map(shortfalls.map((s) => [s.product_id, s]))

  /** Customer-facing unit price (base × rate multiplier from the line). */
  const finalLineUnitPrice = (p: OrderProduct) => {
    const base = parseFloat(p.unit_price)
    const rateRaw = p.rate_percentage
    const rate =
      rateRaw == null || rateRaw === '' || Number.isNaN(parseFloat(rateRaw)) ? 1 : parseFloat(rateRaw)
    const v = finalUnitPriceFromBaseAndRate(base, rate)
    return Number.isFinite(v) ? v : base
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading work order details...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Work order not found</h3>
            <p className="text-gray-600 mb-4">The work order you&apos;re looking for doesn&apos;t exist or is not accessible.</p>
            <Link href={`${basePath}/orders`}>
              <Button>Back to work orders</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-2 sm:gap-3">
          <Link href={`${basePath}/orders`}>
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-black">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="wrap-break-word text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{order.order_id}</h1>
            <span
              className={`mt-1 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${isLive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'animate-pulse bg-emerald-500' : 'bg-gray-400'}`} />
              {isLive ? 'Live' : 'Offline'}
            </span>
            <p className="mt-0.5 text-sm text-gray-600">{order.client_name}</p>
            {order.designer_name && (
              <p className="mt-0.5 text-xs text-gray-500">Designer: {order.designer_name}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <Button type="button" variant="outline" onClick={handlePrintPickList} className="w-full border-gray-200 text-black sm:w-auto">
            <Printer className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Print pick list</span>
            <span className="sm:hidden">Print</span>
          </Button>
          <Button
            onClick={() => setScannerActive(true)}
            disabled={order.status === 'COMPLETED'}
            className="w-full sm:w-auto"
          >
            <ScanLine className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Open Scanner</span>
            <span className="sm:hidden">Scanner</span>
          </Button>
          {allComplete && order.status !== 'COMPLETED' && (
            <Button onClick={handleCompleteOrder} className="w-full bg-green-600 hover:bg-green-700 sm:w-auto">
              <CheckCircle className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Completed & Loaded</span>
              <span className="sm:hidden">Complete</span>
            </Button>
          )}
          {currentRole === 'nursery' && order.status !== 'COMPLETED' && (
            <Link href={`/nursery/orders/${orderId}/edit`} className="w-full sm:w-auto">
              <Button variant="outline" className="w-full text-black">
                Edit
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Summary + progress + restock (single card) */}
      <Card className="overflow-hidden border-gray-200 shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-100 pb-3 text-sm">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                order.status === 'COMPLETED'
                  ? 'bg-green-100 text-green-800'
                  : order.status === 'IN_PROGRESS'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-700'
              }`}
            >
              {order.status}
            </span>
            <span className="text-gray-400">·</span>
            <span className="font-medium text-gray-900">{formatCurrency(parseFloat(order.total_order_amount))}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-600">{totalRequired} items</span>
            <span className="text-gray-400">·</span>
            <span className={order.paid_at ? 'font-medium text-green-700' : 'text-gray-500'}>
              {order.paid_at ? 'Paid' : 'Unpaid'}
            </span>
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-gray-900">
                {totalScanned} / {totalRequired} scanned
              </span>
              <span className="text-sm tabular-nums text-gray-500">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all ${allComplete ? 'bg-green-600' : 'bg-emerald-600'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              {order.status === 'COMPLETED'
                ? 'Work order completed.'
                : allComplete
                  ? 'All lines scanned — tap Complete when loaded.'
                  : `${totalRequired - totalScanned} units left to scan.`}
            </p>
          </div>

          {shortfalls.length > 0 && (
            <div className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2.5">
              <p className="flex items-center gap-2 text-xs font-semibold text-amber-950">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                Nursery restock needed ({shortfalls.length} line{shortfalls.length > 1 ? 's' : ''})
              </p>
              <p className="mt-1 text-[11px] leading-snug text-amber-900/90">
                Scanning is limited to current stock. After restock, continue scanning until each line is full.
              </p>
              <ul className="mt-2 space-y-1 border-t border-amber-200/60 pt-2 text-xs text-amber-950">
                {shortfalls.map((item) => (
                  <li key={item.product_id} className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <span className="min-w-0 truncate font-medium">{item.name}</span>
                    <span className="shrink-0 tabular-nums text-amber-900">
                      +<strong>{item.needed}</strong> nursery · max <strong>{item.canScanNow}</strong> now
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {!allComplete && order.status !== 'COMPLETED' && (
        <details className="group rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
          <summary className="cursor-pointer list-none px-3 py-2.5 font-medium text-gray-800 marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-gray-500" />
              Scan tips
              <span className="text-xs font-normal text-gray-500">(tap to expand)</span>
            </span>
          </summary>
          <ul className="space-y-1 border-t border-gray-100 px-3 py-2.5 text-xs leading-relaxed text-gray-600">
            <li>Use Open Scanner and scan each barcode. Non-shrubs: one unit per scan.</li>
            <li>Shrubs / perennials: set quantity, then scan once (capped by inventory).</li>
            <li>You can pause and resume; finish all lines before Complete.</li>
          </ul>
        </details>
      )}

      {/* Products List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Items</h2>
        {products.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No products found on this work order</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:gap-4">
          {products.map((product) => {
            const isComplete = product.scanned_quantity >= product.quantity
            const remaining = product.quantity - product.scanned_quantity
            const maxScannableThisLine = Math.min(remaining, Math.max(0, product.inventory_quantity))
            const sf = shortfallByProductId.get(product.product_id)

            return (
              <Card
                key={product.product_id}
                className={`border-gray-200 shadow-sm ${isComplete ? 'border-green-200 bg-green-50/50' : ''}`}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        isComplete ? 'bg-green-100' : 'bg-gray-100'
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <Package className="h-5 w-5 text-gray-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="wrap-break-word font-semibold leading-snug text-gray-900">{product.name}</h3>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {product.size} · Zone {getZoneDisplayLabel(product.zones, product.subzone ?? null)} ·{' '}
                            {formatCurrency(finalLineUnitPrice(product))} ea ·{' '}
                            <span className="text-gray-700">{formatCurrency(parseFloat(product.total_price))} line</span>
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                          {sectionUsesGallonPotFields(product.section) && (
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                normalizeProductSection(product.section) === 'perennials'
                                  ? 'bg-violet-100 text-violet-900'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {normalizeProductSection(product.section) === 'perennials' ? 'Perennials' : 'Shrubs'}
                            </span>
                          )}
                          {isComplete && (
                            <span className="rounded-md bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-800">
                              Done
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                          Ord {product.quantity}
                        </span>
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
                          Scan {product.scanned_quantity}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                            remaining === 0 ? 'bg-green-100 text-green-800' : 'bg-orange-50 text-orange-800'
                          }`}
                        >
                          Left {remaining}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                            product.inventory_quantity <= 0 ? 'bg-red-50 text-red-800' : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          Stock {product.inventory_quantity}
                        </span>
                      </div>

                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-600' : 'bg-blue-600'}`}
                          style={{ width: `${(product.scanned_quantity / product.quantity) * 100}%` }}
                        />
                      </div>

                      {!isComplete && remaining > 0 && sf && (
                        <p className="text-[11px] leading-snug text-amber-900">
                          Need <strong>{sf.needed}</strong> from nursery · scan <strong>{sf.canScanNow}</strong> max this visit
                        </p>
                      )}

                      {!isComplete && order.status !== 'COMPLETED' && product.is_shrubs && (
                        <div className="flex flex-col gap-1 border-t border-gray-100 pt-2 sm:flex-row sm:items-end sm:justify-between">
                          <label className="text-[11px] font-medium text-gray-600">
                            Qty this scan <span className="text-gray-400">(max {Math.max(0, maxScannableThisLine)})</span>
                          </label>
                          <div className="flex w-full max-w-34 flex-col gap-1 sm:w-auto">
                            <Input
                              type="number"
                              min={maxScannableThisLine >= 1 ? 1 : 0}
                              max={Math.max(1, maxScannableThisLine)}
                              disabled={maxScannableThisLine < 1}
                              className="h-9"
                              value={
                                maxScannableThisLine < 1
                                  ? 0
                                  : shrubScanQuantities[product.product_id] ?? Math.max(1, maxScannableThisLine)
                              }
                              onChange={(e) => {
                                const value = Number(e.target.value)
                                const capped = Math.min(
                                  Math.max(1, Number.isFinite(value) ? value : 1),
                                  Math.max(1, maxScannableThisLine)
                                )
                                setShrubScanQuantities((prev) => ({
                                  ...prev,
                                  [product.product_id]: maxScannableThisLine >= 1 ? capped : 0,
                                }))
                              }}
                            />
                            {maxScannableThisLine < 1 && remaining > 0 && (
                              <p className="text-[11px] text-amber-800">Wait for restock to scan.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          </div>
        )}
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isActive={scannerActive}
        onScan={handleScan}
        onClose={() => setScannerActive(false)}
        products={products}
      />
    </div>
  )
}