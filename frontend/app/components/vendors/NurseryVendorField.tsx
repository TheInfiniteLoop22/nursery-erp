'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Plus, X, Leaf } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { nurseries as nurseriesApi } from '@/app/lib/api'
import { vendorSchema, type VendorFormValues } from '@/app/lib/schemas'
import { FieldError } from '@/app/components/ui/field-error'

export interface NurseryOption {
  nursery_id: string
  nursery_name: string
}

interface NurseryVendorFieldProps {
  nurseries: NurseryOption[]
  value: string
  onChange: (nurseryId: string) => void
  onVendorCreated: (vendor: NurseryOption) => void
  disabled?: boolean
  label?: string
  vendorsHref?: string
  selectClassName?: string
  className?: string
}

interface AddVendorModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (vendor: NurseryOption) => void
}

function AddVendorModal({ isOpen, onClose, onCreated }: AddVendorModalProps) {
  const [mounted, setMounted] = useState(false)
  const {
    register,
    handleSubmit: validateAndSubmit,
    reset,
    formState: { errors, isSubmitting: isSaving },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: { nursery_name: '', contact_email: '', contact_phone: '', notes: '' },
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  const resetForm = () => reset()

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const onSubmit = async (values: VendorFormValues) => {
    try {
      const response = await nurseriesApi.create({
        nursery_name: values.nursery_name,
        contact_email: values.contact_email || undefined,
        contact_phone: values.contact_phone || undefined,
        notes: values.notes || undefined,
      })

      if (!response.nursery_id) {
        throw new Error('Vendor was saved but no ID was returned')
      }

      const created: NurseryOption = {
        nursery_id: response.nursery_id,
        nursery_name: values.nursery_name,
      }

      toast.success('Vendor added successfully')
      onCreated(created)
      resetForm()
      onClose()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create vendor'
      toast.error(message)
    }
  }

  // This modal is rendered inside another <form> (via a portal); React bubbles synthetic
  // events through portals, so stop the submit from reaching the parent form.
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.stopPropagation()
    void validateAndSubmit(onSubmit)(e)
  }

  if (!isOpen || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-50 p-2 text-[#13452D]">
              <Leaf className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Add new vendor</h2>
              <p className="text-sm text-gray-500">Saved to your vendors list</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} noValidate className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-800">Vendor name *</label>
            <Input
              {...register('nursery_name')}
              placeholder="e.g. Green Valley Nursery"
              className="h-11 text-gray-900 placeholder:text-gray-400"
              autoFocus
            />
            <FieldError error={errors.nursery_name} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-800">Email (optional)</label>
            <Input
              type="email"
              {...register('contact_email')}
              placeholder="contact@vendor.com"
              className="h-11 text-gray-900 placeholder:text-gray-400"
            />
            <FieldError error={errors.contact_email} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-800">Phone (optional)</label>
            <Input
              type="tel"
              {...register('contact_phone')}
              placeholder="(555) 123-4567"
              className="h-11 text-gray-900 placeholder:text-gray-400"
            />
            <FieldError error={errors.contact_phone} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-800">Notes (optional)</label>
            <textarea
              {...register('notes')}
              placeholder="Payment terms, delivery preferences…"
              rows={3}
              className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus-visible:border-[#1F764D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F764D]/30"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={handleClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="w-full bg-[#13452D] hover:bg-[#0f3522] sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving…' : 'Add vendor'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export function NurseryVendorField({
  nurseries,
  value,
  onChange,
  onVendorCreated,
  disabled = false,
  label = 'Vendor *',
  vendorsHref = '/admin/nursery',
  selectClassName = 'h-10 border border-gray-300 rounded-md px-3 bg-white text-gray-900',
  className = '',
}: NurseryVendorFieldProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleVendorCreated = (vendor: NurseryOption) => {
    onVendorCreated(vendor)
    onChange(vendor.nursery_id)
  }

  return (
    <>
      <div className={`md:col-span-2 ${className}`.trim()}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label>
            <select
              name="nursery_id"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className={`w-full ${selectClassName}`}
              required
              disabled={disabled}
            >
              <option value="">Select vendor</option>
              {nurseries.map((nursery) => (
                <option key={nursery.nursery_id} value={nursery.nursery_id}>
                  {nursery.nursery_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col items-start">
            <label className="mb-2 hidden text-sm font-medium text-gray-700 md:block" aria-hidden="true">
              &nbsp;
            </label>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              disabled={disabled}
              className="inline-flex h-10 w-auto shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#1F764D]/30 bg-[#1F764D]/10 px-3 text-sm font-semibold text-[#13452D] transition hover:bg-[#1F764D]/15 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Add new
            </button>
          </div>
        </div>

        {vendorsHref ? (
          <p className="mt-1.5 text-xs text-gray-500">
            Manage all vendors in{' '}
            <Link href={vendorsHref} className="font-semibold text-[#1F764D] hover:underline">
              Vendors
            </Link>
            .
          </p>
        ) : null}
      </div>

      <AddVendorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleVendorCreated}
      />
    </>
  )
}
