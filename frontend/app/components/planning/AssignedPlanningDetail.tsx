'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { formatCurrency } from '@/app/lib/utils'
import { formatPlanningCategory, planning, type PlanningJob } from '@/app/lib/api'
import { laborActualsSchema, type LaborActualsFormValues } from '@/app/lib/schemas'
import { firstErrorMessage } from '@/app/lib/rhf-bridge'
import { FieldError } from '@/app/components/ui/field-error'

interface AssignedPlanningDetailProps {
  basePath: '/employee' | '/nursery'
  params: Promise<{ id: string }> | { id: string }
}

type LaborEntry = PlanningJob['labor_entries'][number]

/** One labour entry's actual hours + notes, each row validated by its own React Hook Form. */
function LaborActualsRow({
  entry,
  onSave,
}: {
  entry: LaborEntry
  onSave: (laborId: string, values: LaborActualsFormValues) => Promise<void>
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LaborActualsFormValues>({
    resolver: zodResolver(laborActualsSchema),
    defaultValues: { actual_hours: String(entry.actual_hours ?? '0'), notes: entry.notes || '' },
  })

  return (
    <div className="rounded-xl border border-gray-200 p-4">
              <div className="grid grid-cols-1 lg:grid-cols-6 gap-3 lg:items-end">
                <div className="lg:col-span-2">
                  <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Category</p>
                  <p className="font-bold text-gray-900">{formatPlanningCategory(entry.category)}</p>
                  <p className="text-xs text-gray-500 mt-1">Planned {entry.planned_hours} h</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Actual hours</label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    {...register('actual_hours')}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-black"
                  />
                  <FieldError error={errors.actual_hours} />
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Notes</label>
                  <input
                    type="text"
                    {...register('notes')}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-black"
                    placeholder="Field notes"
                  />
                </div>
                <button onClick={handleSubmit((values) => onSave(entry.labor_entry_id, values), (errs) => toast.error(firstErrorMessage(errs)))} className="px-4 py-2.5 bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white rounded-lg font-semibold flex items-center justify-center gap-2">
                  <Save className="h-4 w-4" />
                  Save
                </button>
              </div>
            </div>
  )
}

export default function AssignedPlanningDetail({ basePath, params }: AssignedPlanningDetailProps) {
  const [planId, setPlanId] = useState<string | null>(null)
  const [plan, setPlan] = useState<PlanningJob | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await Promise.resolve(params)
      setPlanId(resolved.id)
    }
    resolveParams()
  }, [params])

  const loadPlan = async (id: string) => {
    const data = await planning.getById(id)
    setPlan(data)
  }

  useEffect(() => {
    if (!planId) return
    const load = async () => {
      setIsLoading(true)
      try {
        await loadPlan(planId)
      } catch (error: unknown) {
        console.error('Failed to load assigned plan:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to load assigned plan')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [planId])

  const myEntries = useMemo(() => {
    if (!plan || typeof window === 'undefined') return []
    const userId = localStorage.getItem('user_id')
    return plan.labor_entries.filter((entry) => entry.employee_id === userId)
  }, [plan])

  const saveActuals = async (laborId: string, values: LaborActualsFormValues) => {
    if (!plan || !planId) return
    try {
      await planning.updateLabor(plan.plan_id, laborId, {
        actual_hours: Number(values.actual_hours || 0),
        notes: values.notes || null,
      })
      await loadPlan(planId)
      toast.success('Actual hours updated')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update actual hours')
    }
  }

  if (isLoading || !plan) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-[#1F764D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading day sheet...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-8 animate-fade-in">
      <div className="flex items-start gap-3 sm:gap-4">
        <Link href={`${basePath}/planning`}>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors mt-1">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 wrap-break-word">{plan.job_name}</h1>
          <p className="text-gray-600 mt-2">{plan.location || 'No location set'}</p>
          <p className="text-sm text-gray-500 mt-1">{plan.job_date} {plan.time_in ? `from ${plan.time_in}` : ''}{plan.time_out ? ` to ${plan.time_out}` : ''}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-xl p-6 shadow-lg text-white">
          <p className="text-sm text-white/80 mb-2">Your entries</p>
          <p className="text-3xl font-bold">{myEntries.length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-2">Your actual hours</p>
          <p className="text-3xl font-bold text-gray-900">{myEntries.reduce((sum, entry) => sum + Number(entry.actual_hours || 0), 0).toFixed(1)}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-2">Job actual total</p>
          <p className="text-3xl font-bold text-gray-900 wrap-break-word">{formatCurrency(Number(plan.totals.actual_grand_total))}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Your Labor</h2>
          <p className="text-sm text-gray-500">Update actual hours and field notes for your assigned work.</p>
        </div>
        <div className="space-y-4">
          {myEntries.map((entry) => (
            <LaborActualsRow key={entry.labor_entry_id} entry={entry} onSave={saveActuals} />
          ))}
          {myEntries.length === 0 && <p className="text-center py-8 text-gray-500">You do not have labor entries on this day sheet.</p>}
        </div>
      </div>
    </div>
  )
}
