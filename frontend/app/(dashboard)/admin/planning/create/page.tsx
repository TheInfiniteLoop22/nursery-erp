'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarDays, ClipboardList } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { employees, orders, planning } from '@/app/lib/api'
import { planningCreateSchema, type PlanningCreateFormValues } from '@/app/lib/schemas'
import { FieldError } from '@/app/components/ui/field-error'

interface EmployeeOption {
  employee_id: string
  username: string
  role: string
}

interface OrderOption {
  order_id: string
  client_name: string
}

export default function CreatePlanningPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([])
  const [orderOptions, setOrderOptions] = useState<OrderOption[]>([])
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PlanningCreateFormValues>({
    resolver: zodResolver(planningCreateSchema),
    defaultValues: {
      plan_type: 'MAINTENANCE',
      job_name: '',
      location: '',
      work_order_id: '',
      job_date: new Date().toISOString().split('T')[0],
      time_in: '',
      time_out: '',
      prepared_by: '',
      billable: true,
      create_calendar_event: true,
      notes: '',
    },
  })
  // Live values for the summary panel.
  const formData = watch()

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const defaultWorkOrderId = searchParams.get('work_order_id')
    if (defaultWorkOrderId) {
      setValue('work_order_id', defaultWorkOrderId)
    }
  }, [setValue])

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [employeeData, orderData] = await Promise.all([
          employees.getAll({ page: 1, page_size: 100 }),
          orders.getAll({ page: 1, page_size: 100, status: 'COMPLETED' }),
        ])
        setEmployeeOptions(employeeData.items)
        setOrderOptions(orderData.items)
      } catch (error) {
        console.error('Failed to load planning options:', error)
        toast.error('Failed to load employees or work orders')
      } finally {
        setIsLoading(false)
      }
    }
    loadOptions()
  }, [])

  const onSubmit = async (values: PlanningCreateFormValues) => {
    try {
      const created = await planning.create({
        plan_type: values.plan_type,
        job_name: values.job_name,
        location: values.location || null,
        work_order_id: values.work_order_id || null,
        create_calendar_event: values.create_calendar_event,
        job_date: values.job_date,
        time_in: values.time_in || null,
        time_out: values.time_out || null,
        prepared_by: values.prepared_by || null,
        billable: values.billable,
        notes: values.notes || null,
      })
      toast.success('Day Sheet created')
      router.push(`/admin/planning/${created.plan_id}`)
    } catch (error: unknown) {
      console.error('Failed to create planning job:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create Day Sheet')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-[#1F764D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading Day Sheet form...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-8 animate-fade-in">
      <div className="flex items-start gap-3 sm:gap-4">
        <Link href="/admin/planning">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors mt-1">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900">Create Day Sheet</h1>
          <p className="text-gray-500 mt-2">Start an install or maintenance day sheet from the Excel workflow.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
          <div className="xl:col-span-2 space-y-4 sm:space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Job Information</h2>
                <p className="text-sm text-gray-500">Basic day-sheet details</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Job Type</label>
                  <select {...register('plan_type')} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F764D] text-black bg-white">
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="INSTALL">Install</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                  <input type="date" {...register('job_date')} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F764D] text-black" />
                  <FieldError error={errors.job_date} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Job Name / Location <span className="text-red-500">*</span></label>
                  <input type="text" {...register('job_name')} placeholder="Client, site, or project name" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F764D] text-black" />
                  <FieldError error={errors.job_name} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                  <input type="text" {...register('location')} placeholder="Street, property, or notes for the site" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F764D] text-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Time In</label>
                  <input type="time" {...register('time_in')} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F764D] text-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Time Out</label>
                  <input type="time" {...register('time_out')} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F764D] text-black" />
                  <FieldError error={errors.time_out} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Links and Notes</h2>
                <p className="text-sm text-gray-500">Connect this plan to the existing app</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Linked Work Order</label>
                  <select {...register('work_order_id')} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F764D] text-black bg-white">
                    <option value="">No work order</option>
                    {orderOptions.map((order) => (
                      <option key={order.order_id} value={order.order_id}>{order.order_id} - {order.client_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Prepared By</label>
                  <select {...register('prepared_by')} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F764D] text-black bg-white">
                    <option value="">Current admin / not set</option>
                    {employeeOptions.map((employee) => (
                      <option key={employee.employee_id} value={employee.employee_id}>{employee.username} ({employee.role})</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                  <textarea {...register('notes')} rows={4} placeholder="Crew instructions, site access, client notes..." className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F764D] text-black" />
                </div>
                <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 text-gray-800">
                  <input type="checkbox" {...register('billable')} className="h-5 w-5 accent-[#1F764D]" />
                  Billable job
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 text-gray-800">
                  <input type="checkbox" {...register('create_calendar_event')} className="h-5 w-5 accent-[#1F764D]" />
                  Add to calendar
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 xl:sticky xl:top-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Plan Summary</h2>
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Type</span>
                  <span className="font-semibold text-gray-900">{formData.plan_type === 'MAINTENANCE' ? 'Maintenance' : 'Install'}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Date</span>
                  <span className="font-semibold text-gray-900">{formData.job_date}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Billable</span>
                  <span className="font-semibold text-gray-900">{formData.billable ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Calendar</span>
                  <span className="font-semibold text-gray-900">{formData.create_calendar_event ? 'Create event' : 'Skip'}</span>
                </div>
              </div>
              <div className="rounded-xl bg-[#EAF7F0] p-4 mb-6">
                <div className="flex items-start gap-3">
                  <CalendarDays className="h-5 w-5 text-[#1F764D] mt-0.5" />
                  <p className="text-sm text-[#13452D]">After creation, open the detail page to add employees, labor categories, equipment, and material costs.</p>
                </div>
              </div>
              <div className="space-y-3">
                <button type="submit" disabled={isSubmitting} className="w-full px-6 py-3.5 bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSubmitting ? 'Creating...' : <><ClipboardList className="h-5 w-5" />Create Plan</>}
                </button>
                <Link href="/admin/planning">
                  <button type="button" className="w-full px-6 py-3.5 bg-white border border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all">Cancel</button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
