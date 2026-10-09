'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Leaf, Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card'
import { nurseries as nurseriesApi } from '@/app/lib/api'
import { vendorSchema, type VendorFormValues } from '@/app/lib/schemas'
import { FieldError } from '@/app/components/ui/field-error'

export function VendorCreateClient({ basePath }: { basePath: string }) {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting: isSaving },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: { nursery_name: '', contact_email: '', contact_phone: '', notes: '' },
  })

  const onSubmit = async (values: VendorFormValues) => {
    try {
      const response = await nurseriesApi.create({
        nursery_name: values.nursery_name,
        contact_email: values.contact_email || undefined,
        contact_phone: values.contact_phone || undefined,
        notes: values.notes || undefined,
      })
      toast.success('Vendor created')
      const id = response.nursery_id
      if (id) {
        router.push(`${basePath}/${id}`)
      } else {
        router.push(basePath)
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create vendor'
      toast.error(message)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href={basePath}>
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-gray-700" type="button">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          <Leaf className="h-3.5 w-3.5" />
          New vendor
        </div>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">Add vendor</h1>
        <p className="mt-1 text-sm text-gray-600">Name is required. Email, phone, and notes are optional and can be edited later.</p>
      </div>

      <Card className="border-gray-200 shadow-lg">
        <CardHeader>
          <CardTitle>Vendor details</CardTitle>
          <CardDescription>Contact fields are stored for your team only.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-800">Vendor name *</label>
              <Input
                {...register('nursery_name')}
                placeholder="e.g. Green Valley Nursery"
                className="h-11"
              />
              <FieldError error={errors.nursery_name} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-800">Email (optional)</label>
              <Input
                type="email"
                {...register('contact_email')}
                placeholder="contact@vendor.com"
                className="h-11"
              />
              <FieldError error={errors.contact_email} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-800">Phone (optional)</label>
              <Input
                type="tel"
                {...register('contact_phone')}
                placeholder="(555) 123-4567"
                className="h-11"
              />
              <FieldError error={errors.contact_phone} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-800">Notes (optional)</label>
              <textarea
                {...register('notes')}
                placeholder="Payment terms, delivery preferences, account numbers…"
                rows={4}
                className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus-visible:border-[#1F764D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F764D]/30"
              />
              <FieldError error={errors.notes} />
            </div>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
              <Link href={basePath} className="sm:mr-auto">
                <Button type="button" variant="outline" className="w-full sm:w-auto">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSaving} className="w-full bg-[#13452D] hover:bg-[#0f3522] sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving…' : 'Create vendor'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
