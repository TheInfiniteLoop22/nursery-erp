'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, DollarSign, Users, Briefcase, ChevronLeft, ChevronRight, Lock, CheckCircle2, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatDate } from '@/app/lib/utils'
import { planning, formatPlanningCategory, type PlanningJob, type PlanningLaborEntry } from '@/app/lib/api'

// ─── Mini Calendar ─────────────────────────────────────────────────────────────

interface MiniCalendarProps {
  year: number
  month: number // 0-indexed
  highlightedDates: Set<string>
  selectedDate: string
  onSelectDate: (date: string) => void
  onPrevMonth: () => void
  onNextMonth: () => void
}

function todayString() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0]
}

function MiniCalendar({ year, month, highlightedDates, selectedDate, onSelectDate, onPrevMonth, onNextMonth }: MiniCalendarProps) {
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const today = todayString()

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 select-none">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="h-4 w-4 text-gray-600" />
        </button>
        <p className="text-sm font-bold text-gray-900">{monthName}</p>
        <button onClick={onNextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isSelected = dateStr === selectedDate
          const isToday = dateStr === today
          const hasEntries = highlightedDates.has(dateStr)
          return (
            <button
              key={idx}
              onClick={() => onSelectDate(dateStr)}
              className={`relative w-full aspect-square flex items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-gradient-to-br from-[#13452D] to-[#1F764D] text-white shadow-md'
                  : isToday
                  ? 'border-2 border-[#1F764D] text-[#1F764D]'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              {day}
              {hasEntries && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1F764D]" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Page Component ────────────────────────────────────────────────────────

export default function AdminWorkOrderBreakdownPage() {
  const params = useParams()
  const router = useRouter()
  const workOrderId = params.id as string

  const [plans, setPlans] = useState<PlanningJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isApproving, setIsApproving] = useState(false)

  // Calendar state
  const now = new Date()
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [selectedDate, setSelectedDate] = useState(todayString())

  const fetchPlans = useCallback(async () => {
    try {
      const response = await planning.getAll({
        work_order_id: workOrderId !== 'misc' ? workOrderId : undefined,
        page_size: 200
      })
      
      let fetchedPlans = response.items || []
      
      // If workOrderId is misc, filter for plans without a work_order_id
      if (workOrderId === 'misc') {
        fetchedPlans = fetchedPlans.filter(p => !p.work_order_id)
      }
      
      setPlans(fetchedPlans)
      
      // Set the calendar date to the first plan date if entries exist
      if (fetchedPlans.length > 0) {
        const sortedPlans = [...fetchedPlans].sort((a, b) => new Date(a.job_date).getTime() - new Date(b.job_date).getTime())
        const firstPlanDate = sortedPlans[0].job_date
        setSelectedDate(firstPlanDate)
        const dateParts = firstPlanDate.split('-')
        setCalYear(parseInt(dateParts[0]))
        setCalMonth(parseInt(dateParts[1]) - 1)
      }
    } catch (error: unknown) {
      console.error('Failed to load work order plans:', error)
      toast.error('Failed to load work order details')
    } finally {
      setIsLoading(false)
    }
  }, [workOrderId])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  const handleApprove = async () => {
    if (!workOrderId) return
    setIsApproving(true)
    try {
      await planning.approveByWorkOrder(workOrderId)
      toast.success('Day Sheet approved successfully')
      await fetchPlans()
    } catch (error: unknown) {
      console.error('Failed to approve planning:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to approve planning')
    } finally {
      setIsApproving(false)
    }
  }

  // Highlights dates that have labor entries in the plans list
  const highlightedDates = useMemo(() => {
    const s = new Set<string>()
    plans.forEach(plan => {
      if (plan.labor_entries.length > 0) {
        s.add(plan.job_date)
      }
    })
    return s
  }, [plans])

  const planForSelectedDate = useMemo(() =>
    plans.find((p) => p.job_date === selectedDate) ?? null,
    [plans, selectedDate]
  )

  const entriesByEmployee = useMemo(() => {
    const map = new Map<string, PlanningLaborEntry[]>()
    if (!planForSelectedDate) return map
    for (const entry of planForSelectedDate.labor_entries) {
      const key = entry.employee_id
      const list = map.get(key) ?? []
      list.push(entry)
      map.set(key, list)
    }
    return map
  }, [planForSelectedDate])

  // Overall planning status for this work order
  const overallStatus = useMemo(() => {
    if (plans.length === 0) return 'DRAFT'
    if (plans.some(p => p.status === 'SUBMITTED')) return 'SUBMITTED'
    if (plans.some(p => p.status === 'APPROVED')) return 'APPROVED'
    return plans[0].status
  }, [plans])

  // Aggregate stats across all days
  const stats = useMemo(() => {
    let totalHours = 0
    let totalLaborCost = 0
    const totalDays = highlightedDates.size
    
    const employeeCostMap = new Map<string, {
      name: string,
      hourly_rate: number,
      hours: number,
      jobs: number,
      subtotal: number
    }>()

    plans.forEach(plan => {
      plan.labor_entries.forEach(entry => {
        const empId = entry.employee_id
        const empName = entry.employee_username || 'Unknown Employee'
        const hours = parseFloat(entry.actual_hours || '0')
        const rate = parseFloat(entry.hourly_rate || '0')
        const cost = hours * rate

        totalHours += hours
        totalLaborCost += cost

        if (employeeCostMap.has(empId)) {
          const emp = employeeCostMap.get(empId)!
          emp.hours += hours
          emp.subtotal += cost
          emp.jobs += 1
        } else {
          employeeCostMap.set(empId, {
            name: empName,
            hourly_rate: rate,
            hours,
            jobs: 1,
            subtotal: cost
          })
        }
      })
    })

    return {
      totalHours,
      totalLaborCost,
      totalDays,
      employeeBreakdown: Array.from(employeeCostMap.values()).sort((a, b) => b.subtotal - a.subtotal),
      clientName: plans.length > 0 ? (plans[0].client_name || 'Unknown Client') : 'Unknown Client',
      department: plans.length > 0 ? (plans[0].plan_type === 'MAINTENANCE' ? 'Maintenance' : 'Installation') : 'Unknown'
    }
  }, [plans, highlightedDates])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-[#1F764D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading breakdown details...</p>
        </div>
      </div>
    )
  }

  if (plans.length === 0) {
    return (
      <div className="p-8 text-center max-w-md mx-auto mt-16 bg-white rounded-xl shadow-sm border border-gray-100">
        <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">No Day Sheet Data</h3>
        <p className="text-gray-500 mb-6">Work order not found or no Day Sheets have been initiated yet.</p>
        <button
          onClick={() => router.back()}
          className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors"
        >
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <button 
          onClick={() => router.back()}
          className="p-2 mt-1 hover:bg-gray-100 border border-gray-200 rounded-lg bg-white transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{stats.clientName}</h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#EAF7F0] text-[#13452D] border border-[#B6DCC9]">
              {stats.department}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
              overallStatus === 'SUBMITTED'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : overallStatus === 'APPROVED' || overallStatus === 'COMPLETED'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-gray-50 text-gray-700 border-gray-200'
            }`}>
              {overallStatus === 'SUBMITTED' ? 'Awaiting Review' : overallStatus}
            </span>
          </div>
          <p className="text-sm text-gray-500">Work Order: {workOrderId === 'misc' ? 'N/A' : workOrderId}</p>
        </div>

        {overallStatus === 'SUBMITTED' && (
          <button
            onClick={handleApprove}
            disabled={isApproving}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white font-semibold text-sm shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isApproving ? 'Approving...' : 'Approve Plan'}
          </button>
        )}
      </div>

      {/* ── Stats Summary Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/80 font-medium font-semibold">Total Labor Cost</p>
            <DollarSign className="h-4 w-4 text-white/80" />
          </div>
          <p className="text-3xl font-bold wrap-break-word">{formatCurrency(stats.totalLaborCost)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 font-medium">Total Labor Hours</p>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.totalHours.toFixed(1)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 font-medium">Days Tracked</p>
            <CalendarDays className="h-4 w-4 text-[#1F764D]" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.totalDays}</p>
        </div>
      </div>

      {/* ── Three-column Dashboard Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column 1: Calendar View (3 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <MiniCalendar
            year={calYear}
            month={calMonth}
            highlightedDates={highlightedDates}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onPrevMonth={() => {
              if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1) }
              else setCalMonth((m) => m - 1)
            }}
            onNextMonth={() => {
              if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1) }
              else setCalMonth((m) => m + 1)
            }}
          />
          
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5 border-b border-gray-50 pb-2">
              <Lock className="h-4 w-4 text-[#1F764D]" />
              Day Sheet Status Details
            </h3>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Total Active Days:</span>
                <span className="font-semibold text-gray-900">{highlightedDates.size}</span>
              </div>
              <div className="flex justify-between">
                <span>Unique Employees:</span>
                <span className="font-semibold text-gray-900">{stats.employeeBreakdown.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Labor entries:</span>
                <span className="font-semibold text-gray-900">{plans.reduce((sum, p) => sum + p.labor_entries.length, 0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Selected Date Breakdown (4 cols) */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="border-b border-gray-100 px-5 py-4 bg-[#EAF7F0]/30">
              <h2 className="text-sm font-bold text-[#13452D]">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {planForSelectedDate?.labor_entries.length || 0} labor entries on this day
              </p>
            </div>

            <div className="divide-y divide-gray-100 overflow-y-auto flex-1 max-h-[480px]">
              {Array.from(entriesByEmployee.entries()).map(([employeeId, entries]) => {
                const empName = entries[0]?.employee_username || employeeId
                const empTotalHours = entries.reduce((s, e) => s + Number(e.actual_hours || 0), 0)
                const empTotalCost = entries.reduce((s, e) => s + (Number(e.actual_hours || 0) * Number(e.hourly_rate || 0)), 0)
                return (
                  <div key={employeeId} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#13452D] to-[#1F764D] flex items-center justify-center text-white text-xxs font-bold">
                          {empName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-xs">{empName}</p>
                          <p className="text-[10px] text-gray-400">{empTotalHours.toFixed(1)} hrs</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-[#13452D]">{formatCurrency(empTotalCost)}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 ml-9">
                      {entries.map((entry) => {
                        const entryCost = Number(entry.actual_hours || 0) * Number(entry.hourly_rate || 0)
                        return (
                          <div key={entry.labor_entry_id} className="rounded-lg bg-gray-50 px-3 py-2 text-xs flex justify-between gap-2 border border-gray-100/50">
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-800 leading-tight">{formatPlanningCategory(entry.category)}</p>
                              {entry.notes && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{entry.notes}</p>}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-gray-900">{formatCurrency(entryCost)}</p>
                              <p className="text-[9px] text-gray-400">{Number(entry.actual_hours).toFixed(1)}h @ {formatCurrency(Number(entry.hourly_rate))}/h</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {(!planForSelectedDate || planForSelectedDate.labor_entries.length === 0) && (
                <div className="p-12 text-center my-auto">
                  <Users className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium text-xs">No labor tracked on this date</p>
                  <p className="text-[10px] text-gray-400 mt-1">Select a calendar date marked with a green dot to view employee labor costs.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Column 3: Aggregated Employee Costs (5 cols) */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="border-b border-gray-100 px-5 py-4 bg-gray-50/70">
              <h2 className="text-sm font-bold text-gray-900">Total Employee Breakdown</h2>
              <p className="text-xs text-gray-500 mt-0.5">Aggregated costs across all dates</p>
            </div>
            
            <div className="p-4 space-y-3 overflow-y-auto flex-1 max-h-[480px]">
              {stats.employeeBreakdown.map((emp, index) => (
                <div key={index} className="flex justify-between items-center p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                  <div>
                    <p className="font-bold text-gray-900 text-xs">{emp.name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{emp.jobs} days • {emp.hours.toFixed(1)} hrs @ {formatCurrency(emp.hourly_rate)}</p>
                  </div>
                  <p className="font-bold text-[#1F764D] text-sm">{formatCurrency(emp.subtotal)}</p>
                </div>
              ))}

              {stats.employeeBreakdown.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">No labor tracked.</p>
              )}
            </div>
            
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center mt-auto">
              <p className="font-bold text-gray-900 text-xs">Final Labor Cost</p>
              <p className="text-lg font-bold text-[#13452D]">{formatCurrency(stats.totalLaborCost)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
