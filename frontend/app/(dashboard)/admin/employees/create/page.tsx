'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, UserPlus, Eye, EyeOff, DollarSign } from 'lucide-react'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Card } from '@/app/components/ui/card'
import { employees } from '@/app/lib/api'
import { toast } from 'sonner'
import { formatRateMultiplierString } from '@/app/lib/pricing'
import { employeeCreateSchema, type EmployeeCreateFormValues } from '@/app/lib/schemas'
import { FieldError } from '@/app/components/ui/field-error'

export default function CreateEmployeePage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeCreateFormValues>({
    resolver: zodResolver(employeeCreateSchema),
    defaultValues: {
      username: '',
      password: '',
      confirmPassword: '',
      role: 'employee',
      hourly_rate: '',
      hourly_rate_multiplier: '1.0',
      final_hourly_rate: '',
    },
  })
  const isLoading = isSubmitting

  // Base rate x multiplier = final rate; editing the final rate back-solves the multiplier.
  const recomputeFinal = (base: string, mult: string) => {
    const b = parseFloat(base)
    const r = parseFloat(mult)
    setValue('final_hourly_rate', Number.isFinite(b) && Number.isFinite(r) ? (b * r).toFixed(2) : '')
  }

  const baseField = register('hourly_rate')
  const multField = register('hourly_rate_multiplier')
  const finalField = register('final_hourly_rate')

  const onFinalRateChange = (value: string) => {
    if (value.trim() === '') return
    const base = parseFloat(watch('hourly_rate'))
    const fin = parseFloat(value)
    if (Number.isFinite(base) && base > 0 && Number.isFinite(fin)) {
      setValue('hourly_rate_multiplier', formatRateMultiplierString(fin / base))
    }
  }

  const onSubmit = async (values: EmployeeCreateFormValues) => {
    try {
      const response = await employees.create({
        username: values.username.trim(),
        password: values.password,
        role: values.role,
        hourly_rate: values.hourly_rate ? Number(values.hourly_rate) : 0,
        hourly_rate_multiplier: values.hourly_rate_multiplier ? Number(values.hourly_rate_multiplier) : 1.0,
      })

      toast.success(`${response.role} user ${response.username} created successfully!`)
      router.push('/admin/employees')
    } catch (error: unknown) {
      console.error('Error creating employee:', error)
      const message = error instanceof Error ? error.message : 'Failed to create employee'
      toast.error(message)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6 animate-fade-in">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Back to Employees</span>
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-[#13452D] to-[#1F764D] rounded-2xl p-5 sm:p-8 text-white shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-xl">
              <UserPlus className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Create New User</h1>
              <p className="text-sm sm:text-base text-white/90 mt-1">Add an employee or nursery user to your ERP system</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <Card className="p-4 sm:p-8">
          <form onSubmit={handleSubmit(onSubmit, () => toast.error('Please fix the errors in the form'))} noValidate className="space-y-6">
            {/* Username Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Username <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                {...register('username')}
                placeholder="Enter employee username"
                className={`h-12 ${errors.username ? 'border-red-500' : ''}`}
                disabled={isLoading}
              />
              <FieldError error={errors.username} />
              <p className="text-gray-500 text-xs mt-1">
                Username must be at least 3 characters long
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                {...register('role')}
                className="h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-black bg-white"
                disabled={isLoading}
              >
                <option value="employee">Employee</option>
                <option value="nursery">Nursery</option>
                <option value="head_installation">Head of Installation</option>
                <option value="head_maintenance">Head of Maintenance</option>
              </select>
            </div>

            {/* Hourly Rate Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-gray-200 rounded-xl p-4 bg-gray-50/50">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Base Hourly Rate ($)
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    {...baseField}
                    onChange={(e) => {
                      baseField.onChange(e)
                      recomputeFinal(e.target.value, watch('hourly_rate_multiplier'))
                    }}
                    placeholder="0.00"
                    className="h-12 pl-10 bg-white border border-gray-200 focus-visible:ring-[#1F764D]"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Rate (multiplier)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.000001"
                  {...multField}
                  onChange={(e) => {
                    multField.onChange(e)
                    recomputeFinal(watch('hourly_rate'), e.target.value)
                  }}
                  placeholder="1.0"
                  className="h-12 bg-white border border-gray-200 focus-visible:ring-[#1F764D]"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Final Hourly Rate ($)
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    {...finalField}
                    onChange={(e) => {
                      finalField.onChange(e)
                      onFinalRateChange(e.target.value)
                    }}
                    placeholder="0.00"
                    className="h-12 pl-10 bg-white border border-gray-200 focus-visible:ring-[#1F764D]"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  placeholder="Enter password"
                  className={`h-12 pr-12 ${errors.password ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <FieldError error={errors.password} />
              <p className="text-gray-500 text-xs mt-1">
                Password must be at least 6 characters long
              </p>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <Input
                type={showPassword ? 'text' : 'password'}
                {...register('confirmPassword')}
                placeholder="Re-enter password"
                className={`h-12 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                disabled={isLoading}
              />
              <FieldError error={errors.confirmPassword} />
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">User Account Details</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• User ID will be auto-generated</li>
                <li>• Choose employee or nursery role before creating</li>
                <li>• User can log in with their username and password</li>
                <li>• Access is role-based after login</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="flex-1 h-12"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 h-12 bg-[#1F764D] hover:bg-[#13452D] text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-5 w-5 mr-2" />
                    Create User
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
