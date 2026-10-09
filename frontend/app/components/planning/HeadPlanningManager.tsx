'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Briefcase, Search } from 'lucide-react'
import { toast } from 'sonner'
import { orders } from '@/app/lib/api'
import type { PlanningJobType } from '@/app/lib/api'

type HeadRole = 'head_installation' | 'head_maintenance'

interface WorkOrder {
  order_id: string
  client_name: string
  work_order_type: PlanningJobType
  status: string
  updated_at: string
  paid_at?: string | null
  total_order_amount: string
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    COMPLETED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    PAID: 'bg-[#EAF7F0] text-[#13452D] border border-[#B6DCC9]',
    IN_PROGRESS: 'bg-amber-50 text-amber-700 border border-amber-200',
  }
  return map[status] ?? 'bg-gray-100 text-gray-700 border border-gray-200'
}

export default function HeadPlanningManager() {
  const [role, setRole] = useState<HeadRole | null>(null)
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  const planType: PlanningJobType = role === 'head_maintenance' ? 'MAINTENANCE' : 'INSTALL'

  useEffect(() => {
    if (typeof window === 'undefined') return
    const r = localStorage.getItem('user_role')
    if (r === 'head_installation' || r === 'head_maintenance') setRole(r)
  }, [])

  useEffect(() => {
    if (!role) return
    const load = async () => {
      setIsLoading(true)
      try {
        // Fetch paid/completed orders — these are the ones needing crew tracking
        const data = await orders.getPaid({ page: 1, page_size: 200 })
        // Filter to only orders that match this head's department type
        const filtered = data.items.filter((o) => o.work_order_type === planType)
        setWorkOrders(filtered as WorkOrder[])
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to load work orders')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [role, planType])

  const filtered = useMemo(() => {
    if (!search.trim()) return workOrders
    const q = search.toLowerCase()
    return workOrders.filter(
      (o) => o.client_name.toLowerCase().includes(q) || o.order_id.toLowerCase().includes(q),
    )
  }, [workOrders, search])

  if (!role) return null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-[#1F764D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading work orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Day Sheets</h1>
        <p className="text-gray-500">
          Select a {planType === 'MAINTENANCE' ? 'maintenance' : 'installation'} work order to track crew labour.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-xl p-6 shadow-lg text-white">
          <p className="text-sm text-white/80 mb-2">Work orders</p>
          <p className="text-3xl font-bold">{workOrders.length}</p>
          <p className="text-xs text-white/70 mt-1 capitalize">{planType.toLowerCase()} type</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500 mb-2">Showing</p>
          <p className="text-3xl font-bold text-gray-900">{filtered.length}</p>
          <p className="text-xs text-gray-400 mt-1">Matching your search</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by client name or order ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 bg-white text-black focus:outline-none focus:ring-2 focus:ring-[#1F764D] focus:border-transparent shadow-sm"
        />
      </div>

      {/* Work order cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {filtered.map((order) => (
          <div
            key={order.order_id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-[#1F764D]/30 transition-all overflow-hidden"
          >
            <div className="p-5 border-b border-gray-50 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between mb-3">
                <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${statusBadge(order.status)}`}>
                  {order.status.replace('_', ' ')}
                </span>
                <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg">
                  {order.work_order_type === 'MAINTENANCE' ? 'Maintenance' : 'Install'}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 break-words mb-1">{order.client_name}</h3>
              <p className="text-xs text-gray-400 font-mono">{order.order_id}</p>
            </div>

            <div className="p-5">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                <Briefcase className="h-4 w-4 text-gray-400" />
                <span>Updated {new Date(order.updated_at).toLocaleDateString()}</span>
              </div>
              <Link href={`/employee/planning/work-order/${order.order_id}`}>
                <button className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all">
                  Open Day Sheet
                  <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
          <Briefcase className="h-12 w-12 text-gray-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No work orders found</h3>
          <p className="text-gray-500">
            {search
              ? 'No results match your search.'
              : `No ${planType.toLowerCase()} work orders are available for planning.`}
          </p>
        </div>
      )}
    </div>
  )
}
