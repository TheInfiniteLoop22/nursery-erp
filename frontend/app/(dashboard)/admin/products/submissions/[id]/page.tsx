'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, User, Image as ImageIcon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card'
import { products as productsApi, nurseries as nurseriesApi } from '@/app/lib/api'
import { printBarcode } from '@/app/lib/barcodePrinter'
import { formatDateTime, formatCurrency } from '@/app/lib/utils'
import { buildSizeLabel } from '@/app/lib/size'
import { barcodeCountForProduct, getProductSectionLabel, normalizeProductSection } from '@/app/lib/productCategory'
import { getZoneDisplayLabel } from '@/app/lib/zone'
import { submissionApprovalSchema, type SubmissionApprovalFormValues } from '@/app/lib/schemas'
import { createFormDataSetter, firstErrorMessage } from '@/app/lib/rhf-bridge'
import { FieldError } from '@/app/components/ui/field-error'
import {
  formatRateMultiplierString,
} from '@/app/lib/pricing'

interface ProductSubmission {
  submission_id: string
  employee_id: string
  employee_username: string
  nursery_id: string
  item_name: string
  section: string
  zones: number
  subzone?: string | null
  size: string
  height_feet: string
  caliper_inches: string
  gallons?: string | null
  inventory_quantity: number
  image_url?: string | null
  status: string
  approved_product_id?: string | null
  barcode_status: string
  barcode_printed_at?: string | null
  barcode_printed_by?: string | null
  reviewed_by?: string | null
  created_at: string
  updated_at: string
}

interface Nursery {
  nursery_id: string
  nursery_name: string
}

export default function ProductSubmissionDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter()
  const [submission, setSubmission] = useState<ProductSubmission | null>(null)
  const [nurseryName, setNurseryName] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPrintChoiceModalOpen, setIsPrintChoiceModalOpen] = useState(false)
  const [pendingApprovedSubmission, setPendingApprovedSubmission] = useState<ProductSubmission | null>(null)
  const [pendingApprovedProductId, setPendingApprovedProductId] = useState<string | null>(null)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const form = useForm<SubmissionApprovalFormValues>({
    resolver: zodResolver(submissionApprovalSchema),
    defaultValues: {
      item_name: '',
      base_price_per_unit: '0.00',
      rate_percentage: '2.25',
      final_price_per_unit: '',
    },
  })
  const { formState: { errors } } = form
  // Live values for the price preview; setFormData keeps the updater API on top of RHF.
  const formData = form.watch()
  const setFormData = createFormDataSetter(form)

  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await Promise.resolve(params)
      setSubmissionId(resolved.id)
    }
    resolveParams()
  }, [params])

  useEffect(() => {
    if (!submissionId) return

    const load = async () => {
      try {
        setIsLoading(true)
        const [submissionData, nurseries] = await Promise.all([
          productsApi.getSubmissionById(submissionId),
          nurseriesApi.getAll(),
        ])
        setSubmission(submissionData)
        setFormData((prev) => ({
          ...prev,
          item_name: submissionData.item_name,
        }))
        setNurseryName(nurseries.find((n: Nursery) => n.nursery_id === submissionData.nursery_id)?.nursery_name || submissionData.nursery_id)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load submission'
        toast.error(message)
        router.push('/admin/products/submissions')
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [submissionId, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (name === 'final_price_per_unit') {
      setFormData((prev) => {
        if (value.trim() === '') return { ...prev, final_price_per_unit: '' }
        const base = parseFloat(prev.base_price_per_unit)
        const fin = parseFloat(value)
        if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(fin)) {
          return { ...prev, final_price_per_unit: value }
        }
        return {
          ...prev,
          final_price_per_unit: value,
          rate_percentage: formatRateMultiplierString(fin / base),
        }
      })
      return
    }
    if (name === 'base_price_per_unit' || name === 'rate_percentage') {
      setFormData((prev) => {
        const nextBase = name === 'base_price_per_unit' ? value : prev.base_price_per_unit
        const nextRate = name === 'rate_percentage' ? value : prev.rate_percentage
        const b = parseFloat(nextBase)
        const r = parseFloat(nextRate)
        const fin =
          Number.isFinite(b) && Number.isFinite(r)
            ? (b * r).toFixed(2)
            : prev.final_price_per_unit
        return { ...prev, [name]: value, final_price_per_unit: fin }
      })
      return
    }
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleApprove = async (values: SubmissionApprovalFormValues) => {
    if (!submission) return

    const base = Number(values.base_price_per_unit)
    const rate = Number(values.rate_percentage)

    setIsSubmitting(true)
    try {
      const response = await productsApi.approveSubmission(submission.submission_id, {
        base_price_per_unit: base,
        rate_percentage: rate,
        item_name: formData.item_name.trim() || undefined,
      })
      const updatedSubmission = {
        ...submission,
        item_name: formData.item_name.trim() || submission.item_name
      }
      setPendingApprovedSubmission(updatedSubmission)
      setPendingApprovedProductId(response.product_id)
      setIsPrintChoiceModalOpen(true)
      toast.success(response.message)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to approve submission'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAdminPrintChoice = async (shouldPrintNow: boolean) => {
    if (!pendingApprovedSubmission || !pendingApprovedProductId) return

    try {
      if (shouldPrintNow) {
        const qtyToPrint = barcodeCountForProduct(
          pendingApprovedSubmission.section,
          Math.floor(Number(pendingApprovedSubmission.inventory_quantity))
        )
        if (Number.isFinite(qtyToPrint) && qtyToPrint > 0) {
          const printWindow = window.open('', '_blank')
          try {
            await printBarcode(pendingApprovedProductId, pendingApprovedSubmission.item_name, qtyToPrint, printWindow, {
              section: pendingApprovedSubmission.section,
              height: pendingApprovedSubmission.height_feet,
              caliper: pendingApprovedSubmission.caliper_inches,
              gallons: pendingApprovedSubmission.gallons,
            })
            await productsApi.updateSubmissionBarcodeStatus(
              pendingApprovedSubmission.submission_id,
              'PRINTED_BY_ADMIN'
            )
            toast.success(`Printed ${qtyToPrint} barcode(s).`)
          } catch (printError: unknown) {
            printWindow?.close()
            await productsApi.updateSubmissionBarcodeStatus(
              pendingApprovedSubmission.submission_id,
              'PENDING_NURSERY_PRINT'
            )
            const message = printError instanceof Error ? printError.message : 'Unknown error'
            toast.error(`Printing failed. Nursery can print later: ${message}`)
          }
        } else {
          await productsApi.updateSubmissionBarcodeStatus(
            pendingApprovedSubmission.submission_id,
            'PRINTED_BY_ADMIN'
          )
        }
      } else {
        await productsApi.updateSubmissionBarcodeStatus(
          pendingApprovedSubmission.submission_id,
          'PENDING_NURSERY_PRINT'
        )
        toast.info('Nursery can print barcode from request status page.')
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update barcode status'
      toast.error(message)
    } finally {
      setIsPrintChoiceModalOpen(false)
      setPendingApprovedSubmission(null)
      setPendingApprovedProductId(null)
      router.push('/admin/products/submissions')
    }
  }

  if (isLoading || !submission) {
    return <div className="text-gray-600">Loading submission...</div>
  }

  const finalPrice = Number(formData.base_price_per_unit) * Number(formData.rate_percentage)
  const safeFinal = Number.isFinite(finalPrice) ? finalPrice : 0
  const sec = normalizeProductSection(submission.section)
  const sectionBadgeClass =
    sec === 'shrubs'
      ? 'bg-emerald-100 text-emerald-800'
      : sec === 'perennials'
        ? 'bg-violet-100 text-violet-800'
        : 'bg-blue-100 text-blue-800'

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      {isPrintChoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900">Print barcode now?</h3>
            <p className="mt-2 text-sm text-gray-600">
              Product is approved. Do you want to print barcode labels now, or let nursery print later?
            </p>
            <div className="mt-5 flex gap-3 text-black">
              <Button type="button" variant="outline" className="flex-1" onClick={() => handleAdminPrintChoice(false)}>
                Print Later
              </Button>
              <Button type="button" className="flex-1" onClick={() => handleAdminPrintChoice(true)}>
                Print Now
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-start gap-3">
        <Link href="/admin/products/submissions">
          <button className="rounded-lg border border-gray-200 text-black p-2 hover:bg-gray-50">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Review Product Submission</h1>
          <p className="text-sm text-gray-600">Vendor-submitted details on the left, admin pricing on the right</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Employee Details</CardTitle>
            <CardDescription>Values submitted by {submission.employee_username}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Product Name</p>
                <div className="mt-1">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${sectionBadgeClass}`}>
                    {getProductSectionLabel(submission.section)}
                  </span>
                </div>
                <input
                  type="text"
                  name="item_name"
                  value={formData.item_name}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-base font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1F764D] bg-white"
                  required
                />
                <FieldError error={errors.item_name} />
                <p className="text-sm text-gray-500">{getZoneDisplayLabel(submission.zones, submission.subzone || null)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Size</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{submission.size || buildSizeLabel(submission.height_feet, submission.caliper_inches)}</p>
              </div>
              {normalizeProductSection(submission.section) !== 'perennials' && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Height (ft)</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{submission.height_feet || 'N/A'}</p>
                </div>
              )}
              {normalizeProductSection(submission.section) === 'tree' && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Caliper (in)</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{submission.caliper_inches || 'N/A'}</p>
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Vendor</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{nurseryName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Inventory</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{submission.inventory_quantity}</p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                Submitted by {submission.employee_username}
              </div>
              <p className="mt-2 text-xs text-gray-500">Submitted at {formatDateTime(submission.created_at)}</p>
              <p className="text-xs text-gray-500">Submission ID: {submission.submission_id}</p>
            </div>

            <div className="rounded-xl border border-dashed border-gray-300 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <ImageIcon className="h-4 w-4" />
                Image
              </div>
              <p className="mt-2 text-sm text-gray-600">{submission.image_url || 'No image provided'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Admin Pricing</CardTitle>
            <CardDescription>Enter the base price and rate to finalize this product</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(handleApprove, (errs) => toast.error(firstErrorMessage(errs)))} noValidate className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Base Price *</label>
                <Input
                  name="base_price_per_unit"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={formData.base_price_per_unit}
                  onChange={handleChange}
                  placeholder="0.00"
                  required
                />
                <FieldError error={errors.base_price_per_unit} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Rate (multiplier) *</label>
                <Input
                  name="rate_percentage"
                  type="number"
                  min="0"
                  step="0.000001"
                  inputMode="decimal"
                  value={formData.rate_percentage}
                  onChange={handleChange}
                  required
                />
                <FieldError error={errors.rate_percentage} />
                <p className="mt-1 text-xs text-gray-500">Stored as base price × rate (e.g. 2.25).</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Final price ($)</label>
                <Input
                  name="final_price_per_unit"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={formData.final_price_per_unit}
                  onChange={handleChange}
                />
                <p className="mt-1 text-xs text-gray-500">Optional: edit to adjust the rate automatically.</p>
              </div>

              <div className="rounded-xl bg-emerald-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Estimated Final Price</span>
                  <span className="font-bold text-emerald-700">{formatCurrency(safeFinal)}</span>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Approving...' : 'Approve & Create Product'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
