'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, Edit, Printer, User, Calendar, ClipboardCheck, ScanLine, FilePenLine, Truck, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate, formatDateTime } from '@/app/lib/utils'
import { toast } from 'sonner'
import { orders as ordersApi, products as productsApi, notifications as notificationsApi } from '@/app/lib/api'
import { printOrderPickList } from '@/app/lib/orderPickListPrint'
import { getZoneDisplayLabel } from '@/app/lib/zone'
import { getProductSectionLabel } from '@/app/lib/productCategory'
import { formatOrderPickListSize } from '@/app/lib/size'
import { formatWorkOrderTypeLabel } from '@/app/lib/workOrderType'

interface OrderedProduct {
  product_id: string
  quantity: number
  unit_price: string
  rate_percentage: string | null
  total_price: string
}

interface Order {
  order_id: string
  user_id: string
  client_name: string
  work_order_type: string
  designer_name?: string | null
  status: string
  total_order_amount: string
  ordered_at: string
  updated_at: string
  invoice_generated_at?: string | null
  paid_at?: string | null
  items: OrderedProduct[]
}

interface ProductDetails {
  product_id: string
  item_name: string
  size: string
  nursery_id: string
  inventory_quantity: number
  section?: string | null
  zones: number
  subzone?: string | null
  height_feet?: string | null
  caliper_inches?: string | null
  gallons?: string | number | null
}

interface OrderActivity {
  notification_id: string
  type: string
  title: string
  message: string
  actor_user_id?: string | null
  reference_id?: string | null
  created_at: string
}

export default function OrderDetailsPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter()
  const [isApproving, setIsApproving] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const [productsDetails, setProductsDetails] = useState<Map<string, ProductDetails>>(new Map())
  const [activities, setActivities] = useState<OrderActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [orderId, setOrderId] = useState<string | null>(null)

  const getActivityPresentation = (activity: OrderActivity) => {
    if (activity.type === 'order_edit') {
      const message = activity.message.toLowerCase()
      if (message.includes(' added ')) {
        return {
          label: 'Added',
          Icon: FilePenLine,
          badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
          dotClass: 'bg-blue-600'
        }
      }
      if (message.includes('removed')) {
        return {
          label: 'Removed',
          Icon: FilePenLine,
          badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
          dotClass: 'bg-rose-600'
        }
      }
    }

    switch (activity.type) {
      case 'order_scan':
        return {
          label: 'Scanned',
          Icon: ScanLine,
          badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
          dotClass: 'bg-emerald-500'
        }
      case 'order_edit':
        return {
          label: 'Edited',
          Icon: FilePenLine,
          badgeClass: 'bg-[#EAF7F0] text-[#13452D] border border-[#B6DCC9]',
          dotClass: 'bg-[#1F764D]'
        }
      case 'order_approved':
        return {
          label: 'Approved',
          Icon: ClipboardCheck,
          badgeClass: 'bg-[#EAF7F0] text-[#13452D] border border-[#B6DCC9]',
          dotClass: 'bg-[#13452D]'
        }
      case 'order_completed':
        return {
          label: 'Completed',
          Icon: Truck,
          badgeClass: 'bg-green-50 text-green-700 border border-green-200',
          dotClass: 'bg-green-600'
        }
      default:
        return {
          label: activity.type.replace('_', ' '),
          Icon: Calendar,
          badgeClass: 'bg-gray-100 text-gray-700 border border-gray-200',
          dotClass: 'bg-gray-400'
        }
    }
  }

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await Promise.resolve(params)
      setOrderId(resolvedParams.id)
    }
    resolveParams()
  }, [params])

  useEffect(() => {
    if (!orderId) return

    const loadOrderActivities = async () => {
      try {
        const data = await notificationsApi.getAll({
          page: 1,
          page_size: 100,
          reference_id: orderId,
          types: ['order_scan', 'order_edit', 'order_approved', 'order_completed'],
        })
        setActivities(data.items)
      } catch (error) {
        console.error('Failed to load order activity logs:', error)
      }
    }

    const loadOrderDetails = async () => {
      try {
        setIsLoading(true)
        console.log('Fetching order with ID:', orderId)
        const orderData = await ordersApi.getById(orderId)
        setOrder(orderData)
        
        // Fetch product details for each item
        const detailsMap = new Map<string, ProductDetails>()
        for (const item of orderData.items) {
          try {
            const productData = await productsApi.getById(item.product_id)
            detailsMap.set(item.product_id, {
              product_id: productData.product_id,
              item_name: productData.item_name,
              size: productData.size,
              nursery_id: productData.nursery_id,
              inventory_quantity: productData.inventory_quantity,
              section: productData.section ?? null,
              zones: productData.zones ?? 1,
              subzone: productData.subzone ?? null,
              height_feet: productData.height_feet ?? null,
              caliper_inches: productData.caliper_inches ?? null,
              gallons: productData.gallons ?? null,
            })
          } catch (error) {
            console.error(`Failed to fetch product ${item.product_id}:`, error)
          }
        }
        setProductsDetails(detailsMap)
        await loadOrderActivities()
      } catch (error: unknown) {
        console.error('Error fetching order:', error)
        const message = error instanceof Error ? error.message : 'Failed to load order'
        toast.error(message)
        router.push('/admin/orders')
      } finally {
        setIsLoading(false)
      }
    }

    loadOrderDetails()
  }, [orderId, router])

  const handleApproveOrder = async () => {
    if (!order) return

    setIsApproving(true)
    try {
      const response = await ordersApi.approve(order.order_id)
      toast.success('Work order approved successfully')
      toast.info('This work order is now visible for vendor and employee scanning')
      setOrder(prev => prev ? {
        ...prev,
        status: response.status
      } : null)
      if (orderId) {
        const data = await notificationsApi.getAll({
          page: 1,
          page_size: 100,
          reference_id: orderId,
          types: ['order_scan', 'order_edit', 'order_approved', 'order_completed'],
        })
        setActivities(data.items)
      }
    } catch (error: unknown) {
      console.error('Error approving order:', error)
      const message = error instanceof Error ? error.message : 'Failed to approve work order'
      toast.error(message)
    } finally {
      setIsApproving(false)
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
        lines: order.items.map((item) => {
          const d = productsDetails.get(item.product_id)
          return {
            productName: d?.item_name || item.product_id,
            size: formatOrderPickListSize(
              d?.section,
              d?.size,
              d?.height_feet,
              d?.caliper_inches,
              d?.gallons
            ),
            quantity: item.quantity,
            zoneLabel: getZoneDisplayLabel(d?.zones ?? 1, d?.subzone ?? null),
            sectionLabel: getProductSectionLabel(d?.section),
            productId: item.product_id,
          }
        }),
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not open print window'
      toast.error(message)
    }
  }

  if (isLoading || !order) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-[#1F764D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading work order details...</p>
        </div>
      </div>
    )
  }

  const stockShortfalls = order.items
    .map((item) => {
      const productDetail = productsDetails.get(item.product_id)
      const inventoryQuantity = productDetail?.inventory_quantity ?? 0
      return {
        product_id: item.product_id,
        item_name: productDetail?.item_name || item.product_id,
        needed_to_stock: Math.max(0, item.quantity - inventoryQuantity)
      }
    })
    .filter((item) => item.needed_to_stock > 0)

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            margin: 2cm;
          }
        }
      `}</style>

      {/* Hidden Print Invoice Template */}
      <div className="print-content hidden print:block">
        <div className="max-w-4xl mx-auto p-8 bg-white">
          {/* Header */}
          <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-900">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">INVOICE</h1>
              <p className="text-sm text-gray-600">Nursery ERP</p>
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              <img src="/assets/logo.svg" alt="Nursery ERP" className="h-16 w-auto" />
              <p className="text-xl font-bold text-gray-900">{order.order_id}</p>
              <p className="text-sm text-gray-600">Date: {formatDate(new Date(order.ordered_at))}</p>
              {order.paid_at && (
                <p className="text-sm font-semibold text-green-600 mt-1">PAID</p>
              )}
            </div>
          </div>

          {/* Bill To */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">Bill To:</h3>
            <p className="text-lg font-bold text-gray-900">{order.client_name}</p>
          </div>

          {/* Items Table */}
          <table className="w-full mb-8">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="text-left py-3 text-sm font-bold text-gray-900 uppercase">Item</th>
                <th className="text-center py-3 text-sm font-bold text-gray-900 uppercase">Qty</th>
                <th className="text-right py-3 text-sm font-bold text-gray-900 uppercase">Unit Price</th>
                <th className="text-right py-3 text-sm font-bold text-gray-900 uppercase">Rate</th>
                <th className="text-right py-3 text-sm font-bold text-gray-900 uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => {
                const productDetail = productsDetails.get(item.product_id)
                return (
                  <tr key={item.product_id} className="border-b border-gray-200">
                    <td className="py-4">
                      <p className="font-semibold text-gray-900">{productDetail?.item_name || item.product_id}</p>
                      <p className="text-sm text-gray-600">{productDetail?.size || 'Unknown size'}</p>
                    </td>
                    <td className="text-center py-4 font-medium text-gray-900">{item.quantity}</td>
                    <td className="text-right py-4 font-medium text-gray-900">{formatCurrency(parseFloat(item.unit_price))}</td>
                    <td className="text-right py-4 font-medium text-gray-900">{item.rate_percentage ? `×${item.rate_percentage}` : '-'}</td>
                    <td className="text-right py-4 font-bold text-gray-900">{formatCurrency(parseFloat(item.total_price))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Summary */}
          <div className="flex justify-end mb-8">
            <div className="w-64">
              <div className="flex justify-between py-2 text-gray-600">
                <span>Subtotal:</span>
                <span className="font-semibold">{formatCurrency(parseFloat(order.total_order_amount))}</span>
              </div>
              <div className="flex justify-between py-3 border-t-2 border-gray-900">
                <span className="text-lg font-bold text-gray-900">Total:</span>
                <span className="text-lg font-bold text-gray-900">{formatCurrency(parseFloat(order.total_order_amount))}</span>
              </div>
            </div>
          </div>

          {/* Thank You Note */}
          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-gray-600">Thank you for your business!</p>
          </div>
        </div>
      </div>

      {/* Screen View */}
      <div className="space-y-5 sm:space-y-8 animate-fade-in print:hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3 sm:gap-4">
          <Link href="/admin/orders">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors mt-1 cursor-pointer">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 break-all">{order.order_id}</h1>
              <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${
                order.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                order.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {order.status.replace('_', ' ')}
              </span>
              <span className="px-4 py-1.5 rounded-full text-sm font-semibold bg-[#EAF7F0] text-[#13452D] border border-[#B6DCC9]">
                {formatWorkOrderTypeLabel(order.work_order_type as 'MAINTENANCE' | 'INSTALL')}
              </span>
            </div>
            <p className="text-base sm:text-lg text-gray-600">{order.client_name}</p>
            {order.designer_name && (
              <p className="text-sm text-gray-500 mt-1">Designer: {order.designer_name}</p>
            )}
            <p className="text-sm text-gray-500 mt-1">
              {order.items.length} products • {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 w-full lg:w-auto">
          {order.status === 'CREATED' && (
            <button
              onClick={handleApproveOrder}
              disabled={isApproving}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white rounded-lg font-medium hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              <CheckCircle className="h-4 w-4" />
              {isApproving ? 'Approving...' : 'Approve work order'}
            </button>
          )}
          {/* <button 
            onClick={() => window.print()} 
            className="w-full px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Print
          </button> */}
          <button
            type="button"
            onClick={handlePrintPickList}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Print pick list
          </button>
          <Link href={`/admin/orders/${order.order_id}/edit`}>
            <button className="w-full px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-2 cursor-pointer">
              <Edit className="h-4 w-4" />
              Edit
            </button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Content */}
        <div className="xl:col-span-2 space-y-4 sm:space-y-6">
          {stockShortfalls.length > 0 && (
            <div className="rounded-2xl border border-amber-300 bg-linear-to-r from-amber-50 via-amber-50 to-orange-50 p-4 sm:p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    Stock Required Before Full Scan
                  </p>
                  <p className="mt-1 text-xs text-amber-800">
                    These items can be ordered now, but need restocking to complete full employee scan.
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900">
                  {stockShortfalls.length} item{stockShortfalls.length > 1 ? 's' : ''} pending stock
                </span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {stockShortfalls.map((item) => (
                  <div key={item.product_id} className="rounded-xl border border-amber-200 bg-white/80 p-3">
                    <p className="text-sm font-semibold text-amber-900">{item.item_name}</p>
                    <p className="mt-1 text-xs text-amber-800">
                      Need <span className="font-semibold">{item.needed_to_stock}</span> more in stock
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Products */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Line items</h2>
              <p className="text-sm text-gray-500">Products included in this work order</p>
            </div>
            <div className="space-y-4">
              {order.items.map((item) => {
                const productDetail = productsDetails.get(item.product_id)
                return (
                  <div key={item.product_id} className="border border-gray-200 rounded-xl p-4 sm:p-5 bg-gradient-to-r from-white to-gray-50 hover:shadow-md transition-all">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 text-base sm:text-lg break-words">{productDetail?.item_name || item.product_id}</h4>
                        <p className="text-sm text-gray-600 mt-1">{productDetail?.size || 'Unknown size'}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-xs text-gray-500 mb-1">Total</p>
                        <p className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#13452D] to-[#1F764D] bg-clip-text text-transparent">{formatCurrency(parseFloat(item.total_price))}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-4 border-t border-gray-200">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Quantity</p>
                        <p className="text-lg font-bold text-gray-900">{item.quantity}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Unit Price</p>
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(parseFloat(item.unit_price))}</p>
                      </div>
                      <div className="sm:text-right">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Rate</p>
                        <p className="text-lg font-bold text-gray-900">{item.rate_percentage ? `×${item.rate_percentage}` : 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Work order activity</h2>
              <p className="text-sm text-gray-500">Audit trail for scans, approvals, and edits</p>
            </div>
            {activities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#B6DCC9] bg-[#F6FBF8] p-4">
                <p className="text-sm text-[#13452D]">No activity recorded yet for this work order.</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto pr-1">
                <div className="relative space-y-4 pl-6">
                  <div className="pointer-events-none absolute left-2 top-0 h-full w-px bg-gradient-to-b from-[#13452D]/30 via-[#1F764D]/25 to-transparent" />
                  {activities.map((activity) => {
                    const presentation = getActivityPresentation(activity)
                    const Icon = presentation.Icon
                    return (
                      <div key={activity.notification_id} className="relative">
                        <span className={`absolute -left-6 top-5 h-3 w-3 rounded-full ring-4 ring-white ${presentation.dotClass}`} />
                        <div className="rounded-2xl border border-[#DCEFE5] bg-gradient-to-r from-[#F8FCFA] to-white p-3 sm:p-4 shadow-sm transition-all hover:shadow-md">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF7F0] text-[#1F764D]">
                                  <Icon className="h-4 w-4" />
                                </span>
                                <p className="font-semibold text-gray-900">{activity.title}</p>
                              </div>
                              <p className="mt-2 text-sm text-gray-700 wrap-break-word">{activity.message}</p>
                              <p className="mt-3 text-xs text-gray-500">{formatDateTime(activity.created_at)}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.badgeClass}`}>
                              {presentation.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          {/* Order Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Work order information</h2>
            <div className="space-y-5">
              <div className="pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2 text-gray-500 mb-2">
                  <User className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase">Client</span>
                </div>
                <p className="font-semibold text-gray-900">{order.client_name}</p>
              </div>

              <div className="pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2 text-gray-600 mb-2">
                  <User className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase">Designer</span>
                </div>
                <p className="font-semibold text-gray-900">{order.designer_name || '—'}</p>
              </div>

              <div className="pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2 text-gray-600 mb-2">
                  <ClipboardCheck className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase">Work Order Type</span>
                </div>
                <p className="font-semibold text-gray-900">{formatWorkOrderTypeLabel(order.work_order_type as 'MAINTENANCE' | 'INSTALL')}</p>
              </div>

              <div className="pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2 text-gray-500 mb-2">
                  <User className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase">Admin User</span>
                </div>
                <p className="font-semibold text-gray-900">{order.user_id}</p>
              </div>
              
              <div className="pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2 text-gray-500 mb-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase">Created</span>
                </div>
                <p className="font-semibold text-gray-900">{formatDate(new Date(order.ordered_at))}</p>
              </div>
              
              <div className="pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2 text-gray-500 mb-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase">Last Updated</span>
                </div>
                <p className="font-semibold text-gray-900">{formatDate(new Date(order.updated_at))}</p>
              </div>
              
              {order.paid_at && (
                <div>
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase">Payment Received</span>
                  </div>
                  <p className="font-semibold text-emerald-700">{formatDate(new Date(order.paid_at))}</p>
                </div>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Work order summary</h2>
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Products</span>
                <span className="font-semibold text-gray-900">{order.items.length}</span>
              </div>
              <div className="flex justify-between items-center py-2 pb-4 border-b border-gray-100">
                <span className="text-gray-600">Total Items</span>
                <span className="font-semibold text-gray-900">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</span>
              </div>
            </div>
            <div className="bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-xl p-5">
              <p className="text-sm text-white/80 mb-2 font-medium">Total</p>
              <p className="text-2xl sm:text-3xl font-bold text-white wrap-break-word">
                {formatCurrency(parseFloat(order.total_order_amount))}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}