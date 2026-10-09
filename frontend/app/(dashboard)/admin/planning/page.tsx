'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ClipboardList, Clock, DollarSign, Eye, Check, RefreshCw, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatDate } from '@/app/lib/utils'
import { planning, type PlanningJob } from '@/app/lib/api'

interface WorkOrderSummary {
  work_order_id: string
  client_name: string
  department: string
  total_days: number
  total_hours: number
  total_labor_cost: number
  completion_date: string
  status: 'SUBMITTED' | 'APPROVED' | 'COMPLETED'
}

export default function AdminPlanningPage() {
  const [plans, setPlans] = useState<PlanningJob[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const fetchPlans = useCallback(async () => {
    try {
      const response = await planning.getAll({
        page_size: 1000 // Fetch all plans for grouping
      })
      setPlans(response.items || [])
    } catch (error: unknown) {
      console.error('Failed to load Day Sheets:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load Day Sheets')
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      await fetchPlans()
      setIsLoading(false)
    }
    load()
  }, [fetchPlans])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchPlans()
    toast.success('Day Sheets refreshed')
    setIsRefreshing(false)
  }

  const handleApprove = async (workOrderId: string) => {
    if (!workOrderId) return
    setApprovingId(workOrderId)
    try {
      await planning.approveByWorkOrder(workOrderId)
      toast.success(`Work Order ${workOrderId} Day Sheets approved successfully`)
      await fetchPlans()
    } catch (error: unknown) {
      console.error('Failed to approve Day Sheets:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to approve Day Sheets')
    } finally {
      setApprovingId(null)
    }
  }

  const workOrdersGrouped = useMemo(() => {
    const groups = new Map<string, WorkOrderSummary>()

    plans.forEach(plan => {
      const id = plan.work_order_id || plan.plan_id
      const client = plan.client_name || 'Unknown Client'
      const dept = plan.plan_type === 'MAINTENANCE' ? 'Maintenance' : 'Install'
      
      const hours = parseFloat(plan.totals.actual_hours || '0')
      const laborCost = parseFloat(plan.totals.actual_labor_total || '0')
      const planDate = plan.updated_at
      const planStatus = plan.status

      // We only care about work orders that have been submitted, approved, or completed.
      if (!['SUBMITTED', 'APPROVED', 'COMPLETED'].includes(planStatus)) {
        return
      }

      if (groups.has(id)) {
        const existing = groups.get(id)!
        existing.total_days += 1
        existing.total_hours += hours
        existing.total_labor_cost += laborCost
        if (new Date(planDate) > new Date(existing.completion_date)) {
          existing.completion_date = planDate
        }
        
        // If any plan in the group is SUBMITTED, the overall state of the work order needs review
        if (planStatus === 'SUBMITTED') {
          existing.status = 'SUBMITTED'
        } else if (existing.status !== 'SUBMITTED' && planStatus === 'APPROVED') {
          existing.status = 'APPROVED'
        }
      } else {
        groups.set(id, {
          work_order_id: plan.work_order_id || '',
          client_name: client,
          department: dept,
          total_days: 1,
          total_hours: hours,
          total_labor_cost: laborCost,
          completion_date: planDate,
          status: planStatus as 'SUBMITTED' | 'APPROVED' | 'COMPLETED'
        })
      }
    })

    let results = Array.from(groups.values())
    
    // Sort by completion/update date descending
    results.sort((a, b) => new Date(b.completion_date).getTime() - new Date(a.completion_date).getTime())

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      results = results.filter(wo => 
        wo.work_order_id.toLowerCase().includes(q) || 
        wo.client_name.toLowerCase().includes(q)
      )
    }

    return results
  }, [plans, searchQuery])

  const awaitingReview = useMemo(() => {
    return workOrdersGrouped.filter(wo => wo.status === 'SUBMITTED')
  }, [workOrdersGrouped])

  const approvedAndCompleted = useMemo(() => {
    return workOrdersGrouped.filter(wo => wo.status === 'APPROVED' || wo.status === 'COMPLETED')
  }, [workOrdersGrouped])

  const stats = useMemo(() => {
    return {
      awaitingReviewCount: awaitingReview.length,
      approvedCount: approvedAndCompleted.length,
      totalHours: workOrdersGrouped.reduce((sum, wo) => sum + wo.total_hours, 0),
      totalLaborCost: workOrdersGrouped.reduce((sum, wo) => sum + wo.total_labor_cost, 0),
    }
  }, [awaitingReview, approvedAndCompleted, workOrdersGrouped])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-[#1F764D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading Day Sheets...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Work Order Day Sheet Review</h1>
          <p className="text-gray-500">Review, audit per-employee labor costs, and approve day sheets submitted by department heads.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-xl p-6 shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-white/80">Awaiting Review</p>
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
          <p className="text-3xl font-bold">{stats.awaitingReviewCount}</p>
        </div>
        <div className="bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-xl p-6 shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-white/80">Approved / Finalized</p>
            <Check className="h-6 w-6 text-white" />
          </div>
          <p className="text-3xl font-bold">{stats.approvedCount}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-500">Total Labor Cost</p>
            <DollarSign className="h-6 w-6 text-emerald-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900 wrap-break-word">{formatCurrency(stats.totalLaborCost)}</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by work order ID or client name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F764D] focus:border-transparent transition-all text-black"
            />
          </div>
        </div>
      </div>

      {/* Section 1: Awaiting Review */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <span className="h-3 w-3 rounded-full bg-amber-500 animate-pulse" />
          <h2 className="text-xl font-bold text-gray-900">Awaiting Review ({awaitingReview.length})</h2>
        </div>
        
        {awaitingReview.length === 0 ? (
          <div className="bg-amber-50/30 rounded-xl p-8 text-center border border-amber-100">
            <p className="text-amber-700 font-medium">No plans are currently awaiting review.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {awaitingReview.map((wo, idx) => (
              <div key={wo.work_order_id || idx} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:border-amber-300 hover:shadow-md transition-all overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="p-5 border-b border-gray-100 bg-amber-50/15">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span className="inline-flex px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        NEEDS REVIEW
                      </span>
                      <span className="rounded-lg bg-[#EAF7F0] px-3 py-1.5 text-xs font-semibold text-[#13452D]">
                        {wo.department}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 wrap-break-word">{wo.client_name}</h3>
                    <p className="text-sm text-gray-600 mt-1">Order: {wo.work_order_id || 'N/A'}</p>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Submitted Date</p>
                        <p className="font-semibold text-gray-900">{formatDate(new Date(wo.completion_date))}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Total Days</p>
                        <p className="font-semibold text-gray-900">{wo.total_days}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Total Hours</p>
                        <p className="font-semibold text-gray-900">{wo.total_hours.toFixed(1)}</p>
                      </div>
                      <div className="rounded-lg bg-amber-50/50 p-3 border border-amber-100">
                        <p className="text-xs text-amber-800">Estimated Cost</p>
                        <p className="font-bold text-amber-900">{formatCurrency(wo.total_labor_cost)}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-2">
                  <Link href={`/admin/planning/${wo.work_order_id || 'misc'}`} className="w-full">
                    <button className="w-full h-10 px-3 bg-white border border-[#B6DCC9] text-[#13452D] rounded-lg font-medium hover:bg-[#EAF7F0]/30 transition-all flex items-center justify-center gap-1.5 text-xs">
                      <Eye className="h-3.5 w-3.5" />
                      Breakdown
                    </button>
                  </Link>
                  <button
                    onClick={() => handleApprove(wo.work_order_id)}
                    disabled={approvingId === wo.work_order_id}
                    className="w-full h-10 px-3 bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white rounded-lg font-semibold hover:shadow-md transition-all flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {approvingId === wo.work_order_id ? 'Approve...' : 'Approve'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Approved & Completed */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <span className="h-3 w-3 rounded-full bg-emerald-600" />
          <h2 className="text-xl font-bold text-gray-900">Approved & Finalized ({approvedAndCompleted.length})</h2>
        </div>
        
        {approvedAndCompleted.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200">
            <p className="text-gray-500 font-medium">No approved work orders found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {approvedAndCompleted.map((wo, idx) => (
              <div key={wo.work_order_id || idx} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        wo.status === 'APPROVED' 
                          ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {wo.status}
                      </span>
                      <span className="rounded-lg bg-[#EAF7F0] px-3 py-1.5 text-xs font-semibold text-[#13452D]">
                        {wo.department}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 wrap-break-word">{wo.client_name}</h3>
                    <p className="text-sm text-gray-600 mt-1">Order: {wo.work_order_id || 'N/A'}</p>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Last Date</p>
                        <p className="font-semibold text-gray-900">{formatDate(new Date(wo.completion_date))}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Total Days</p>
                        <p className="font-semibold text-gray-900">{wo.total_days}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Total Hours</p>
                        <p className="font-semibold text-gray-900">{wo.total_hours.toFixed(1)}</p>
                      </div>
                      <div className="rounded-lg bg-[#EAF7F0] p-3 border border-[#B6DCC9]">
                        <p className="text-xs text-[#13452D]">Final Cost</p>
                        <p className="font-bold text-[#13452D]">{formatCurrency(wo.total_labor_cost)}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 border-t border-gray-100">
                  <Link href={`/admin/planning/${wo.work_order_id || 'misc'}`}>
                    <button className="w-full h-10 px-4 bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white rounded-lg font-medium hover:shadow-md transition-all flex items-center justify-center gap-2 text-sm">
                      <Eye className="h-4 w-4" />
                      View Cost Breakdown
                    </button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {workOrdersGrouped.length === 0 && (
        <div className="bg-white rounded-xl p-8 sm:p-16 text-center shadow-sm border border-gray-100">
          <div className="mb-6 inline-flex p-4 bg-gray-100 rounded-full">
            <Users className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No planning records found</h3>
          <p className="text-gray-500 mb-6">Work orders will appear here once department heads add planning entries and submit them.</p>
        </div>
      )}
    </div>
  )
}