'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Clock, Eye, RefreshCw, Users } from 'lucide-react'
import { toast } from 'sonner'
import { planning, type PlanningJob } from '@/app/lib/api'
import HeadPlanningManager from '@/app/components/planning/HeadPlanningManager'

interface AssignedPlanningListProps {
  basePath: '/employee' | '/nursery'
}

function statusLabel(status: string) {
  return status.replaceAll('_', ' ')
}

export default function AssignedPlanningList({ basePath }: AssignedPlanningListProps) {
  const [plans, setPlans] = useState<PlanningJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setUserRole(localStorage.getItem('user_role'))
  }, [])

  const fetchPlans = useCallback(async () => {
    const response = await planning.getAll({ page: 1, page_size: 100 })
    setPlans(response.items)
  }, [])

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        await fetchPlans()
      } catch (error: unknown) {
        console.error('Failed to load assigned plans:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to load assigned Day Sheets')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [fetchPlans])

  const refresh = async () => {
    setIsRefreshing(true)
    try {
      await fetchPlans()
      toast.success('Day Sheets refreshed')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to refresh Day Sheets')
    } finally {
      setIsRefreshing(false)
    }
  }

  if (userRole === 'head_installation' || userRole === 'head_maintenance') {
    return <HeadPlanningManager />
  }

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
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Day Sheets</h1>
          <p className="text-gray-500">Assigned install and maintenance jobs for your crew work.</p>
        </div>
        <button
          onClick={refresh}
          disabled={isRefreshing}
          className="w-full sm:w-auto px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-xl p-6 shadow-lg text-white">
          <div className="flex items-center justify-between mb-4"><p className="text-sm text-white/80">Assigned jobs</p><Users className="h-6 w-6" /></div>
          <p className="text-3xl font-bold">{plans.length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4"><p className="text-sm text-gray-500">Today</p><CalendarDays className="h-6 w-6 text-[#1F764D]" /></div>
          <p className="text-3xl font-bold text-gray-900">{plans.filter((plan) => plan.job_date === new Date().toISOString().split('T')[0]).length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4"><p className="text-sm text-gray-500">Actual hours</p><Clock className="h-6 w-6 text-amber-600" /></div>
          <p className="text-3xl font-bold text-gray-900">{plans.reduce((sum, plan) => sum + Number(plan.totals.actual_hours || 0), 0).toFixed(1)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {plans.map((plan) => (
          <div key={plan.plan_id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-[#1F764D]/30 transition-all overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#EAF7F0] text-[#13452D] border border-[#B6DCC9]">
                  {statusLabel(plan.status)}
                </span>
                <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">
                  {plan.plan_type === 'MAINTENANCE' ? 'Maintenance' : 'Install'}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 wrap-break-word">{plan.job_name}</h3>
              <p className="text-sm text-gray-600 mt-1">{plan.location || 'No location set'}</p>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Date</p><p className="font-semibold text-gray-900">{plan.job_date}</p></div>
              <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Hours</p><p className="font-semibold text-gray-900">{Number(plan.totals.actual_hours).toFixed(1)}</p></div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <Link href={`${basePath}/planning/${plan.plan_id}`}>
                <button className="w-full px-4 py-2.5 bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white rounded-lg font-medium hover:shadow-md transition-all flex items-center justify-center gap-2 text-sm">
                  <Eye className="h-4 w-4" />
                  Open day sheet
                </button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="bg-white rounded-xl p-8 sm:p-16 text-center shadow-sm border border-gray-100">
          <h3 className="text-xl font-bold text-gray-900 mb-2">No assigned planning jobs</h3>
          <p className="text-gray-500">Assigned install and maintenance day sheets will show up here.</p>
        </div>
      )}
    </div>
  )
}
