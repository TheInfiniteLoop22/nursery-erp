'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Boxes, ClipboardList, DollarSign, History, User, PlusSquare, PackageCheck, Truck, CheckCircle2, ChartBar, Activity, Edit3, Save, X } from 'lucide-react'
import { employees as employeesApi } from '@/app/lib/api'
import { formatDate, formatCurrency } from '@/app/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { buildSizeLabel } from '@/app/lib/size'
import { formatRateMultiplierString } from '@/app/lib/pricing'
import { hourlyRateSchema, type HourlyRateFormValues } from '@/app/lib/schemas'
import { firstErrorMessage } from '@/app/lib/rhf-bridge'

interface EmployeeDetail {
  employee_id: string
  username: string
  role: string
  hourly_rate: string
  hourly_rate_multiplier: string
  created_at: string
  items_scanned: number
  orders_completed: number
  inventory_updated: number
  products_added_count: number
  status: string
  scanned_products: Array<{
    product_id: string
    item_name: string
    size: string
    height_feet: string
    caliper_inches: string
    total_scanned: number
    last_scanned_at: string
  }>
  scanned_orders: Array<{
    order_id: string
    client_name: string
    status: string
    scan_events: number
    total_scanned: number
    last_scanned_at: string
  }>
  inventory_updates: Array<{
    notification_id: string
    product_id: string
    item_name?: string | null
    size?: string | null
    height_feet?: string | null
    caliper_inches?: string | null
    title: string
    message: string
    created_at: string
  }>
  recent_scans: Array<{
    scan_id: string
    order_id: string
    product_id: string
    scanned_quantity: number
    scanned_at: string
  }>
}

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>()
  const [isLoading, setIsLoading] = useState(true)
  const [details, setDetails] = useState<EmployeeDetail | null>(null)
  const [isEditingRate, setIsEditingRate] = useState(false)
  const rateForm = useForm<HourlyRateFormValues>({
    resolver: zodResolver(hourlyRateSchema),
    defaultValues: { hourly_rate: '0', hourly_rate_multiplier: '1.000000', final_hourly_rate: '0.00' },
  })
  const [isSavingRate, setIsSavingRate] = useState(false)

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        if (!params?.id) return
        const data = await employeesApi.getById(params.id)
        setDetails(data as EmployeeDetail)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load employee details'
        toast.error(message)
      } finally {
        setIsLoading(false)
      }
    }
    fetchDetails()
  }, [params?.id])

  const totals = useMemo(() => ({
    productsTouched: details?.scanned_products.length || 0,
    ordersTouched: details?.scanned_orders.length || 0,
    productsAdded: details?.products_added_count || 0,
  }), [details])

  const handleEditRate = () => {
    const base = Number(details?.hourly_rate || 0)
    const mult = Number(details?.hourly_rate_multiplier || 1.0)
    rateForm.reset({
      hourly_rate: details?.hourly_rate || '0',
      hourly_rate_multiplier: details?.hourly_rate_multiplier || '1.000000',
      final_hourly_rate: (base * mult).toFixed(2),
    })
    setIsEditingRate(true)
  }

  // Base x multiplier = final; editing the final rate back-solves the multiplier.
  const recomputeFinal = (base: string, multiplier: string) => {
    const b = parseFloat(base)
    const r = parseFloat(multiplier)
    if (Number.isFinite(b) && Number.isFinite(r)) {
      rateForm.setValue('final_hourly_rate', (b * r).toFixed(2))
    }
  }

  const baseField = rateForm.register('hourly_rate', {
    onChange: (e) => recomputeFinal(e.target.value, rateForm.getValues('hourly_rate_multiplier')),
  })
  const multiplierField = rateForm.register('hourly_rate_multiplier', {
    onChange: (e) => recomputeFinal(rateForm.getValues('hourly_rate'), e.target.value),
  })
  const finalField = rateForm.register('final_hourly_rate', {
    onChange: (e) => {
      const value: string = e.target.value
      if (value.trim() === '') return
      const base = parseFloat(rateForm.getValues('hourly_rate'))
      const fin = parseFloat(value)
      if (Number.isFinite(base) && base > 0 && Number.isFinite(fin)) {
        rateForm.setValue('hourly_rate_multiplier', formatRateMultiplierString(fin / base))
      }
    },
  })

  const handleSaveRate = async (values: HourlyRateFormValues) => {
    if (!details) return
    setIsSavingRate(true)
    try {
      const result = await employeesApi.update(details.employee_id, {
        hourly_rate: Number(values.hourly_rate || 0),
        hourly_rate_multiplier: Number(values.hourly_rate_multiplier || 1.0),
      })
      setDetails({
        ...details,
        hourly_rate: result.hourly_rate,
        hourly_rate_multiplier: result.hourly_rate_multiplier,
      })
      setIsEditingRate(false)
      toast.success('Hourly rate updated successfully')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update hourly rate'
      toast.error(message)
    } finally {
      setIsSavingRate(false)
    }
  }

  const statusBadge = (status: string) => {
    if (status === 'COMPLETED') {
      return 'bg-emerald-100 text-emerald-800 border border-emerald-200'
    }
    if (status === 'IN_PROGRESS') {
      return 'bg-blue-100 text-blue-800 border border-blue-200'
    }
    return 'bg-gray-100 text-gray-700 border border-gray-200'
  }

  if (isLoading) {
    return <div className="text-gray-600">Loading employee details...</div>
  }

  if (!details) {
    return <div className="text-red-600">Employee details not found.</div>
  }

  return (
    <div className="space-y-5 sm:space-y-7">
      <section className="rounded-2xl bg-gradient-to-r from-[#13452D] to-[#1F764D] p-5 sm:p-6 text-white shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link href="/admin/employees">
              <button className="h-11 w-11 rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center">
                <ArrowLeft className="h-5 w-5" />
              </button>
            </Link>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold leading-tight">Employee Profile</h1>
              <p className="text-white/85 mt-1 text-sm sm:text-lg">Performance and inventory activity for @{details.username}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20">{details.employee_id}</span>
                <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20">Joined {formatDate(details.created_at)}</span>
                <span className="px-3 py-1 rounded-full bg-emerald-200/20 border border-emerald-100/30 text-emerald-50">Active</span>
              </div>
            </div>
          </div>
          <div className="hidden md:flex h-16 w-16 rounded-2xl bg-white/15 items-center justify-center">
            <User className="h-8 w-8 text-white" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Items Scanned</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-gray-900">{details.items_scanned}</p>
            <Activity className="h-5 w-5 text-[#1F764D]" />
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Orders Completed</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-gray-900">{details.orders_completed}</p>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Orders Scanned</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-gray-900">{totals.ordersTouched}</p>
            <Truck className="h-5 w-5 text-blue-600" />
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Products Scanned</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-gray-900">{totals.productsTouched}</p>
            <Boxes className="h-5 w-5 text-[#1F764D]" />
          </div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/40 border border-emerald-200 p-4 shadow-sm">
          <p className="text-xs text-emerald-700 mb-1">Products Added/Updated</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-emerald-700">{totals.productsAdded}</p>
            <PackageCheck className="h-5 w-5 text-emerald-700" />
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm relative">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500 font-medium">Hourly Rate</p>
            {!isEditingRate ? (
              <button
                onClick={handleEditRate}
                className="p-1 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                title="Edit hourly rate"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={rateForm.handleSubmit(handleSaveRate, (errs) => toast.error(firstErrorMessage(errs)))}
                  disabled={isSavingRate}
                  className="p-1 text-[#1F764D] hover:bg-[#EAF7F0] rounded-lg transition-colors disabled:opacity-50"
                  title="Save"
                >
                  <Save className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setIsEditingRate(false)}
                  className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Cancel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          
          {isEditingRate ? (
            <div className="space-y-3 mt-2 w-full">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Base Rate ($)</label>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-gray-400">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    {...baseField}
                    className="w-full text-sm font-bold text-gray-900 border-b border-[#1F764D] bg-transparent focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Rate (multiplier)</label>
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  {...multiplierField}
                  className="w-full text-sm font-bold text-gray-900 border-b border-[#1F764D] bg-transparent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Final Hourly Rate ($)</label>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-gray-400">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    {...finalField}
                    className="w-full text-sm font-bold text-gray-900 border-b border-[#1F764D] bg-transparent focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-end justify-between mt-1">
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {formatCurrency(Number(details.hourly_rate || 0) * Number(details.hourly_rate_multiplier || 1.0))}
                </p>
                <p className="text-[11px] text-gray-500 mt-1 leading-normal">
                  Base: {formatCurrency(Number(details.hourly_rate || 0))} × {details.hourly_rate_multiplier || '1.0'}
                </p>
              </div>
              <DollarSign className="h-5 w-5 text-[#1F764D] self-start mt-1" />
            </div>
          )}
          {!isEditingRate && <p className="text-[10px] text-gray-400 mt-1">per hour (final rate)</p>}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/70">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Boxes className="h-4 w-4 text-[#1F764D]" />Products Scanned</h2>
          </div>
          <div className="p-4 space-y-3 max-h-110 overflow-auto">
            {details.scanned_products.length === 0 ? (
              <p className="text-sm text-gray-500">No scanned products yet.</p>
            ) : (
              details.scanned_products.map((p) => (
                <div key={p.product_id} className="rounded-xl border border-gray-100 p-4 hover:border-[#1F764D]/25 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{p.item_name} <span className="text-gray-500 font-medium">({p.size || buildSizeLabel(p.height_feet, p.caliper_inches)})</span></p>
                      <p className="text-xs text-gray-500 mt-1">Product ID: {p.product_id}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-[#1F764D]/10 text-[#13452D] border border-[#1F764D]/20">{p.total_scanned} scanned</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Last scan: {formatDate(p.last_scanned_at)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/70">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2"><ClipboardList className="h-4 w-4 text-[#1F764D]" />Orders Scanned</h2>
          </div>
          <div className="p-4 space-y-3 max-h-110 overflow-auto">
            {details.scanned_orders.length === 0 ? (
              <p className="text-sm text-gray-500">No scanned orders yet.</p>
            ) : (
              details.scanned_orders.map((o) => (
                <div key={o.order_id} className="rounded-xl border border-gray-100 p-4 hover:border-[#1F764D]/25 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{o.order_id} <span className="text-gray-500 font-medium">- {o.client_name}</span></p>
                      <p className="text-sm text-gray-600 mt-1">Scan events: {o.scan_events} | Total scanned: {o.total_scanned}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${statusBadge(o.status)}`}>
                      {o.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Last scan: {formatDate(o.last_scanned_at)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-emerald-50/40">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><PlusSquare className="h-4 w-4 text-emerald-700" />Products Added / Inventory Updates</h2>
        </div>
        <div className="p-4 space-y-3 max-h-110 overflow-auto">
          {details.inventory_updates.length === 0 ? (
            <p className="text-sm text-gray-500">No product additions or stock updates yet.</p>
          ) : (
            details.inventory_updates.map((update) => (
              <div key={update.notification_id} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {update.item_name
                        ? `${update.item_name}${update.size
                          ? ` (${update.size})`
                          : (update.height_feet || update.caliper_inches)
                            ? ` (${buildSizeLabel(update.height_feet, update.caliper_inches)})`
                            : ''}`
                        : (update.product_id || 'Product')}
                    </p>
                    <p className="text-sm text-gray-700 mt-1">{update.message}</p>
                  </div>
                  <ChartBar className="h-4 w-4 text-emerald-700 mt-1" />
                </div>
                <p className="text-xs text-gray-500 mt-2">{formatDate(update.created_at)}{update.product_id ? ` | Product ID: ${update.product_id}` : ''}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/70">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><History className="h-4 w-4 text-[#1F764D]" />Recent Scan Logs</h2>
        </div>
        <div className="p-4 space-y-3 max-h-96 overflow-auto">
          {details.recent_scans.length === 0 ? (
            <p className="text-sm text-gray-500">No recent scans.</p>
          ) : (
            details.recent_scans.map((log) => (
              <div key={log.scan_id} className="rounded-xl border border-gray-100 p-4 text-sm hover:border-[#1F764D]/20 transition-colors">
                <p className="text-gray-900 font-semibold">{log.scan_id}</p>
                <p className="text-gray-600 mt-1 wrap-break-word">Order: {log.order_id} | Product: {log.product_id}</p>
                <p className="text-gray-600">Quantity: {log.scanned_quantity}</p>
                <p className="text-xs text-gray-500 mt-2">{formatDate(log.scanned_at)}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
