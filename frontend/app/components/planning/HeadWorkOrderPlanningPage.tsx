'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Lock, Pencil, Plus, Trash2, Users, X } from 'lucide-react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { laborEntrySchema, type LaborEntryFormValues } from '@/app/lib/schemas'
import { createFormDataSetter, firstErrorMessage } from '@/app/lib/rhf-bridge'
import {
  employees,
  formatPlanningCategory,
  orders,
  planning,
  planningCategories,
  type PlanningJob,
  type PlanningJobType,
  type PlanningLaborEntry,
} from '@/app/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkOrder {
  order_id: string
  client_name: string
  work_order_type: PlanningJobType
  status: string
  updated_at: string
}

interface EmployeeOption {
  employee_id: string
  username: string
  role: string
  hourly_rate?: string
}

type EntryForm = LaborEntryFormValues

function todayString() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0]
}

function matchesSearch(value: string, q: string) {
  return value.toLowerCase().includes(q.trim().toLowerCase())
}

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

// ─── Main Component ─────────────────────────────────────────────────────────────

interface HeadWorkOrderPlanningPageProps {
  workOrderId: string
  basePath: '/employee' | '/nursery'
}

export default function HeadWorkOrderPlanningPage({ workOrderId, basePath }: HeadWorkOrderPlanningPageProps) {
  const [role, setRole] = useState<string | null>(null)
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [allPlans, setAllPlans] = useState<PlanningJob[]>([])
  const [employeesList, setEmployeesList] = useState<EmployeeOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<(PlanningLaborEntry & { plan_id: string; plan_type: PlanningJobType }) | null>(null)

  // Calendar state
  const now = new Date()
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [selectedDate, setSelectedDate] = useState(todayString())

  // Form state
  // React Hook Form holds the modal's state and runs the Zod schema on save. The modal swaps whole
  // task lists when the employee changes, so `setForm` keeps that updater style on top of RHF.
  const entryForm = useForm<EntryForm>({
    resolver: zodResolver(laborEntrySchema),
    defaultValues: { date: todayString(), employee_id: '', jobs: [{ category: '', actual_hours: '0', notes: '' }] },
  })
  const form = entryForm.watch()
  const setForm = createFormDataSetter(entryForm)
  const [empSearch, setEmpSearch] = useState('')
  const [taskSearch, setTaskSearch] = useState('')

  const planType: PlanningJobType = role === 'head_maintenance' ? 'MAINTENANCE' : 'INSTALL'
  const categories = planningCategories[planType]

  // ── Derived ────────────────────────────────────────────────────────────────
  const isLocked = useMemo(() =>
    allPlans.length > 0 && allPlans.every((p) => ['SUBMITTED', 'APPROVED', 'COMPLETED'].includes(p.status)),
    [allPlans]
  )

  const highlightedDates = useMemo(() => {
    const s = new Set<string>()
    for (const plan of allPlans) {
      if (plan.labor_entries.length > 0) s.add(plan.job_date)
    }
    return s
  }, [allPlans])

  const planForSelectedDate = useMemo(() =>
    allPlans.find((p) => p.job_date === selectedDate) ?? null,
    [allPlans, selectedDate]
  )

  const laborForSelectedDate = useMemo(() =>
    planForSelectedDate?.labor_entries ?? [],
    [planForSelectedDate]
  )

  // Group labor entries by employee for the selected date
  const entriesByEmployee = useMemo(() => {
    const map = new Map<string, (PlanningLaborEntry & { plan_id: string; plan_type: PlanningJobType })[]>()
    if (!planForSelectedDate) return map
    for (const entry of planForSelectedDate.labor_entries) {
      const key = entry.employee_id
      const list = map.get(key) ?? []
      list.push({ ...entry, plan_id: planForSelectedDate.plan_id, plan_type: planForSelectedDate.plan_type })
      map.set(key, list)
    }
    return map
  }, [planForSelectedDate, laborForSelectedDate])

  const workerOptions = useMemo(
    () => employeesList.filter((e) => e.role === 'employee' || e.role === 'nursery'),
    [employeesList]
  )

  const filteredEmployees = useMemo(
    () => workerOptions.filter((e) => matchesSearch(`${e.username} ${e.employee_id}`, empSearch)),
    [workerOptions, empSearch]
  )

  const filteredCategories = useMemo(
    () => categories.filter((c) => matchesSearch(formatPlanningCategory(c), taskSearch)),
    [categories, taskSearch]
  )

  // Totals across all plans for the work order
  const allEntries = useMemo(() => allPlans.flatMap((p) => p.labor_entries), [allPlans])
  const totalHours = useMemo(() => allEntries.reduce((s, e) => s + Number(e.actual_hours || 0), 0), [allEntries])
  const totalWorkers = useMemo(() => new Set(allEntries.map((e) => e.employee_id)).size, [allEntries])

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadData = async () => {
    const [orderData, plansData, employeeData] = await Promise.all([
      orders.getById(workOrderId),
      planning.getAll({ page: 1, page_size: 200, work_order_id: workOrderId }),
      employees.getAll({ page: 1, page_size: 200 }),
    ])
    setWorkOrder({
      order_id: orderData.order_id,
      client_name: orderData.client_name,
      work_order_type: orderData.work_order_type,
      status: orderData.status,
      updated_at: orderData.updated_at,
    })
    setAllPlans(plansData.items)
    setEmployeesList(employeeData.items)
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRole(localStorage.getItem('user_role'))
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      setIsLoading(true)
      try {
        await loadData()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to load Day Sheet data')
      } finally {
        setIsLoading(false)
      }
    }
    run()
  }, [workOrderId])

  useEffect(() => {
    if (!categories.length) return
    setForm((f) => ({
      ...f,
      jobs: f.jobs.map((j) => ({ ...j, category: j.category || categories[0] })),
    }))
  }, [categories])

  // ── Modal helpers ───────────────────────────────────────────────────────────
  const resetForm = (date?: string) => {
    setEditingEntry(null)
    setEmpSearch('')
    setTaskSearch('')
    setForm({
      date: date ?? selectedDate,
      employee_id: '',
      jobs: [{ category: categories[0] || '', actual_hours: '0', notes: '' }]
    })
  }

  const openAddModal = (date?: string, prefillEmployeeId?: string) => {
    setEditingEntry(null)
    setEmpSearch('')
    setTaskSearch('')
    const targetDate = date ?? selectedDate
    
    if (prefillEmployeeId) {
      const emp = workerOptions.find((e) => e.employee_id === prefillEmployeeId)
      setEmpSearch(emp?.username ?? '')
      const empEntries = entriesByEmployee.get(prefillEmployeeId) || []
      const jobs = empEntries.length === 0
        ? [{ category: categories[0] || '', actual_hours: '0', notes: '' }]
        : empEntries.map((e) => ({
            labor_entry_id: e.labor_entry_id,
            category: e.category,
            actual_hours: e.actual_hours,
            notes: e.notes ?? '',
          }))
      setForm({
        date: targetDate,
        employee_id: prefillEmployeeId,
        jobs,
      })
    } else {
      setForm({
        date: targetDate,
        employee_id: '',
        jobs: [{ category: categories[0] || '', actual_hours: '0', notes: '' }],
      })
    }
    setIsModalOpen(true)
  }

  const openEditModal = (entry: PlanningLaborEntry & { plan_id: string; plan_type: PlanningJobType }, date: string) => {
    setEditingEntry(entry)
    const emp = workerOptions.find((e) => e.employee_id === entry.employee_id)
    setEmpSearch(emp?.username ?? '')
    const empEntries = entriesByEmployee.get(entry.employee_id) || []
    const jobs = empEntries.length === 0
      ? [{ category: entry.category, actual_hours: entry.actual_hours, notes: entry.notes ?? '' }]
      : empEntries.map((e) => ({
          labor_entry_id: e.labor_entry_id,
          category: e.category,
          actual_hours: e.actual_hours,
          notes: e.notes ?? '',
        }))
    setForm({
      date,
      employee_id: entry.employee_id,
      jobs,
    })
    setIsModalOpen(true)
  }

  const handleEmployeeChange = (employeeId: string) => {
    const emp = workerOptions.find((e) => e.employee_id === employeeId)
    setEmpSearch(emp?.username ?? '')
    
    if (employeeId) {
      const empEntries = entriesByEmployee.get(employeeId) || []
      const jobs = empEntries.length === 0
        ? [{ category: categories[0] || '', actual_hours: '0', notes: '' }]
        : empEntries.map((e) => ({
            labor_entry_id: e.labor_entry_id,
            category: e.category,
            actual_hours: e.actual_hours,
            notes: e.notes ?? '',
          }))
      setForm((f) => ({
        ...f,
        employee_id: employeeId,
        jobs,
      }))
    } else {
      setForm((f) => ({
        ...f,
        employee_id: '',
        jobs: [{ category: categories[0] || '', actual_hours: '0', notes: '' }],
      }))
    }
  }

  const closeModal = () => {
    setIsModalOpen(false)
    resetForm()
  }

  // ── Ensure plan exists for a date ───────────────────────────────────────────
  const ensurePlan = async (date: string): Promise<PlanningJob> => {
    const existing = allPlans.find((p) => p.job_date === date)
    if (existing) return existing
    if (!workOrder) throw new Error('Work order not loaded')
    return planning.create({
      plan_type: planType,
      job_name: workOrder.client_name,
      work_order_id: workOrderId,
      job_date: date,
      billable: true,
      create_calendar_event: false,
      notes: `Crew tracking for ${date}`,
    })
  }

  // ── Save entry ──────────────────────────────────────────────────────────────
  const saveEntry = async (values: EntryForm) => {
    setIsSaving(true)
    try {
      const plan = await ensurePlan(values.date)
      await planning.saveBulkLabor(plan.plan_id, {
        employee_id: values.employee_id,
        entries: values.jobs.map((j) => ({
          labor_entry_id: j.labor_entry_id,
          category: j.category,
          planned_hours: 0,
          actual_hours: Number(j.actual_hours || 0),
          notes: j.notes || null,
        })),
      })
      await loadData()
      setSelectedDate(values.date)
      closeModal()
      toast.success('Crew labor saved')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save entry')
    } finally {
      setIsSaving(false)
    }
  }

  const deleteEntry = async (entry: PlanningLaborEntry & { plan_id: string }) => {
    try {
      await planning.deleteLabor(entry.plan_id, entry.labor_entry_id)
      await loadData()
      toast.success('Entry deleted')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete entry')
    }
  }

  // ── Mark complete ───────────────────────────────────────────────────────────
  const markComplete = async () => {
    if (allPlans.length === 0) {
      toast.error('No Day Sheet entries to submit')
      return
    }
    setIsSubmitting(true)
    try {
      await planning.submitByWorkOrder(workOrderId)
      await loadData()
      toast.success('Day Sheet submitted for admin review')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit Day Sheet')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-[#1F764D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading Day Sheet for work order...</p>
        </div>
      </div>
    )
  }

  if (!workOrder) return null

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <Link href={`${basePath}/planning`}>
          <button className="p-2 mt-1 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{workOrder.client_name}</h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#EAF7F0] text-[#13452D] border border-[#B6DCC9]">
              {workOrder.work_order_type === 'MAINTENANCE' ? 'Maintenance' : 'Install'}
            </span>
            {isLocked && (
              <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                <Lock className="h-3 w-3" />
                Submitted
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{workOrder.order_id}</p>
        </div>
        {!isLocked && (
          <button
            onClick={markComplete}
            disabled={isSubmitting || allPlans.length === 0}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-800 text-white font-semibold text-sm shadow-md disabled:opacity-50 hover:shadow-lg transition-all"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isSubmitting ? 'Submitting...' : 'Mark Complete'}
          </button>
        )}
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/80 font-medium">Total Workers</p>
            <Users className="h-4 w-4 text-white/80" />
          </div>
          <p className="text-3xl font-bold">{totalWorkers}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 font-medium">Total Hours</p>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalHours.toFixed(1)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 font-medium">Days Tracked</p>
            <CalendarDays className="h-4 w-4 text-[#1F764D]" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{highlightedDates.size}</p>
        </div>
      </div>

      {/* ── Main layout: Calendar + Day view ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-1">
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

          {!isLocked && (
            <button
              onClick={() => openAddModal(selectedDate)}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="h-4 w-4" />
              Add entry for {selectedDate}
            </button>
          )}
        </div>

        {/* Day view */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-lg font-bold text-gray-900">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {laborForSelectedDate.length === 0 ? 'No entries — click a date with a dot or add a new entry.' : `${laborForSelectedDate.length} labor entr${laborForSelectedDate.length === 1 ? 'y' : 'ies'}`}
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {Array.from(entriesByEmployee.entries()).map(([employeeId, entries]) => {
                const empName = entries[0]?.employee_username ?? employeeId
                const empTotalHours = entries.reduce((s, e) => s + Number(e.actual_hours || 0), 0)
                return (
                  <div key={employeeId} className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#13452D] to-[#1F764D] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {empName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{empName}</p>
                          <p className="text-xs text-gray-500">{empTotalHours.toFixed(1)}h total</p>
                        </div>
                      </div>
                      {!isLocked && (
                        <button
                          onClick={() => openAddModal(selectedDate, employeeId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1F764D] text-[#1F764D] text-xs font-semibold hover:bg-[#EAF7F0] transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          Add job
                        </button>
                      )}
                    </div>
                    <div className="space-y-2 ml-10">
                      {entries.map((entry) => (
                        <div key={entry.labor_entry_id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#1F764D]">{formatPlanningCategory(entry.category)}</p>
                            {entry.notes && <p className="text-xs text-gray-500 mt-0.5 truncate">{entry.notes}</p>}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-xl font-bold text-gray-900">{Number(entry.actual_hours).toFixed(1)}</p>
                              <p className="text-xs text-gray-400">hours</p>
                            </div>
                            {!isLocked && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => openEditModal(entry, selectedDate)}
                                  className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 transition-all text-gray-500"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteEntry(entry)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 hover:shadow-sm border border-transparent hover:border-red-200 transition-all text-red-400"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {laborForSelectedDate.length === 0 && (
                <div className="p-12 text-center">
                  <Users className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium mb-1">No labour tracked for this date</p>
                  {!isLocked && (
                    <p className="text-sm text-gray-400">
                      Click{' '}
                      <button onClick={() => openAddModal(selectedDate)} className="text-[#1F764D] font-semibold underline">
                        Add entry
                      </button>{' '}
                      to get started.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Add/Edit modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{editingEntry ? 'Edit entry' : 'Add labour entry'}</h3>
                <p className="text-sm text-gray-500">{workOrder.client_name}</p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
              {/* Date — inside the form */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  disabled={Boolean(editingEntry)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-black disabled:bg-gray-50"
                />
              </div>

              {/* Employee */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Employee</label>
                <input
                  type="text"
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  placeholder="Search employee..."
                  disabled={Boolean(editingEntry)}
                  className="mb-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-black text-sm disabled:bg-gray-50"
                />
                <select
                  value={form.employee_id}
                  onChange={(e) => handleEmployeeChange(e.target.value)}
                  disabled={Boolean(editingEntry)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-black bg-white disabled:bg-gray-50"
                >
                  <option value="">Choose employee</option>
                  {filteredEmployees.map((e) => (
                    <option key={e.employee_id} value={e.employee_id}>
                      {e.username} ({e.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Job Rows Section */}
              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-gray-900">Tasks & Hours</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        jobs: [
                          ...f.jobs,
                          { category: categories[0] || '', actual_hours: '0', notes: '' },
                        ],
                      }))
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-[#1F764D] hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Task
                  </button>
                </div>
                
                <div className="space-y-4 pr-1">
                  {form.jobs.map((job, index) => (
                    <div key={index} className="p-3 border border-gray-100 rounded-xl bg-gray-50/50 space-y-3 relative">
                      {form.jobs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setForm((f) => ({
                              ...f,
                              jobs: f.jobs.filter((_, idx) => idx !== index),
                            }))
                          }}
                          className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Task</label>
                          <select
                            value={job.category}
                            onChange={(e) => {
                              const nextJobs = [...form.jobs]
                              nextJobs[index].category = e.target.value
                              setForm({ ...form, jobs: nextJobs })
                            }}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-black text-sm bg-white"
                          >
                            {categories.map((c) => (
                              <option key={c} value={c}>{formatPlanningCategory(c)}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Hours</label>
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            value={job.actual_hours}
                            onChange={(e) => {
                              const nextJobs = [...form.jobs]
                              nextJobs[index].actual_hours = e.target.value
                              setForm({ ...form, jobs: nextJobs })
                            }}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-black text-sm"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
                        <input
                          type="text"
                          value={job.notes}
                          onChange={(e) => {
                            const nextJobs = [...form.jobs]
                            nextJobs[index].notes = e.target.value
                            setForm({ ...form, jobs: nextJobs })
                          }}
                          placeholder="Optional notes"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-black text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button onClick={closeModal} className="px-5 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold">
                Cancel
              </button>
              <button
                onClick={entryForm.handleSubmit(saveEntry, (errs) => toast.error(firstErrorMessage(errs)))}
                disabled={isSaving}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white font-semibold disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : editingEntry ? 'Save changes' : 'Save entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
