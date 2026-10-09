'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, PencilLine, Trash2, FileText, Mail, Phone, Trees, X, BarChart3, Package, StickyNote } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card'
import { nurseries as nurseriesApi, analytics as analyticsApi } from '@/app/lib/api'
import NotesModal from '@/app/components/ProductNotesModal'
import type { NurseryDetail } from '@/app/lib/types'
import { buildSizeLabel } from '@/app/lib/size'
import { vendorSchema, type VendorFormValues } from '@/app/lib/schemas'
import { FieldError } from '@/app/components/ui/field-error'

type NurseryAnalyticsOverview = Awaited<ReturnType<typeof analyticsApi.getNurseryOverview>>

export function VendorDetailClient({ basePath, nurseryId }: { basePath: string; nurseryId: string }) {
  const router = useRouter()
  const [detail, setDetail] = useState<NurseryDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const editForm = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: { nursery_name: '', contact_email: '', contact_phone: '', notes: '' },
  })
  const { register, formState: { errors } } = editForm

  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [analyticsOverview, setAnalyticsOverview] = useState<NurseryAnalyticsOverview | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)

  const loadDetail = async (id: string) => {
    const d = await nurseriesApi.getById(id)
    setDetail(d)
    editForm.reset({
      nursery_name: d.nursery_name,
      contact_email: d.contact_email ?? '',
      contact_phone: d.contact_phone ?? '',
      notes: d.notes ?? '',
    })
  }

  useEffect(() => {
    const run = async () => {
      try {
        setIsLoading(true)
        await loadDetail(nurseryId)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load vendor'
        toast.error(message)
        router.push(basePath)
      } finally {
        setIsLoading(false)
      }
    }
    run()
  }, [nurseryId, basePath, router])

  useEffect(() => {
    if (!nurseryId) return
    let cancelled = false
    const run = async () => {
      try {
        setAnalyticsLoading(true)
        setAnalyticsError(null)
        const data = await analyticsApi.getNurseryOverview(nurseryId)
        if (!cancelled) setAnalyticsOverview(data)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load analytics'
        if (!cancelled) {
          setAnalyticsError(message)
          setAnalyticsOverview(null)
        }
      } finally {
        if (!cancelled) setAnalyticsLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [nurseryId])

  const openEditModal = () => {
    if (detail) {
      editForm.reset({
        nursery_name: detail.nursery_name,
        contact_email: detail.contact_email ?? '',
        contact_phone: detail.contact_phone ?? '',
        notes: detail.notes ?? '',
      })
    }
    setIsEditModalOpen(true)
  }

  const handleSave = async (values: VendorFormValues) => {
    try {
      setIsSaving(true)
      await nurseriesApi.update(nurseryId, {
        nursery_name: values.nursery_name,
        contact_email: values.contact_email,
        contact_phone: values.contact_phone,
        notes: values.notes,
      })
      toast.success('Vendor updated')
      await loadDetail(nurseryId)
      try {
        const data = await analyticsApi.getNurseryOverview(nurseryId)
        setAnalyticsOverview(data)
        setAnalyticsError(null)
      } catch {
        /* non-fatal */
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update vendor'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    const ok = window.confirm('Delete this vendor? This may fail if products are still linked.')
    if (!ok) return
    try {
      setIsDeleting(true)
      await nurseriesApi.delete(nurseryId)
      toast.success('Vendor deleted')
      router.push(basePath)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete vendor'
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading || !detail) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#1F764D] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Link href={basePath}>
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-gray-700" type="button">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Vendor</p>
            <h1 className="wrap-break-word text-2xl font-black text-gray-900 sm:text-3xl">{detail.nursery_name}</h1>
            <p className="mt-1 font-mono text-xs text-gray-500">{detail.nursery_id}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            onClick={openEditModal}
            className="bg-[#13452D] hover:bg-[#0f3522]"
          >
            <PencilLine className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} type="button">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Plant types</CardDescription>
            <CardTitle className="text-3xl font-black text-[#13452D]">{detail.products_count}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Inventory</CardDescription>
            <CardTitle className="text-3xl font-black text-[#13452D]">{detail.total_inventory}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Units bought</CardDescription>
            <CardTitle className="text-3xl font-black text-emerald-700">{detail.total_ordered_quantity}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-gray-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-[#1F764D]" />
            Contact & internal notes
          </CardTitle>
          <CardDescription>Visible on this page; use Edit to change.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:gap-6">
            <div className="flex min-w-0 items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</p>
                <p className="mt-0.5 wrap-break-word text-gray-900">
                  {detail.contact_email?.trim() ? detail.contact_email : '—'}
                </p>
              </div>
            </div>
            <div className="flex min-w-0 items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Phone</p>
                <p className="mt-0.5 text-gray-900">{detail.contact_phone?.trim() ? detail.contact_phone : '—'}</p>
              </div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</p>
            {detail.notes != null && detail.notes.trim() !== '' ? (
              <div className="rounded-xl border border-gray-100 bg-gray-50/90 p-4 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap wrap-break-word">
                {detail.notes}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-6 text-center text-sm text-gray-500">
                No internal notes yet. Click <span className="font-semibold text-gray-700">Edit</span> to add some.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#1F764D]" />
            Analytics
          </CardTitle>
          <CardDescription>Overview from order and inventory data for this vendor.</CardDescription>
        </CardHeader>
        <CardContent>
          {analyticsLoading && (
            <p className="text-sm text-gray-600">Loading analytics…</p>
          )}
          {analyticsError && !analyticsLoading && (
            <p className="text-sm text-red-600">{analyticsError}</p>
          )}
          {!analyticsLoading && !analyticsError && analyticsOverview && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Products</p>
                  <p className="mt-1 text-2xl font-black text-[#13452D]">{analyticsOverview.products_count}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total inventory</p>
                  <p className="mt-1 text-2xl font-black text-[#13452D]">{analyticsOverview.total_inventory}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Units ordered</p>
                  <p className="mt-1 text-2xl font-black text-emerald-700">{analyticsOverview.total_ordered_quantity}</p>
                </div>
              </div>
              <div>
                <p className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
                  <Package className="h-4 w-4 text-[#1F764D]" />
                  Top products by units ordered
                </p>
                {analyticsOverview.top_products.length === 0 ? (
                  <p className="text-sm text-gray-500">No order history yet for this vendor.</p>
                ) : (
                  <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {analyticsOverview.top_products.map((row) => (
                      <li
                        key={row.product_id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm shadow-sm"
                      >
                        <span className="min-w-0 truncate font-semibold text-gray-900">{row.item_name}</span>
                        <span className="shrink-0 tabular-nums text-xs text-gray-600">
                          <span className="font-bold text-emerald-700">{row.ordered_quantity}</span>
                          {' '}
                          ordered ·
                          {' '}
                          <span className="text-gray-500">{row.inventory_quantity} in stock</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-gray-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trees className="h-5 w-5 text-[#1F764D]" />
            Products from this vendor
          </CardTitle>
          <CardDescription>Tap the note icon for per-product notes (separate from vendor notes).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-112 space-y-3 overflow-y-auto pr-1">
            {detail.products.length > 0 ? (
              detail.products.map((product) => (
                <div
                  key={product.product_id}
                  className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900">{product.item_name}</p>
                    <p className="text-xs text-gray-500">
                      {product.size || buildSizeLabel(product.height_feet, product.caliper_inches)} ·{' '}
                      {product.inventory_quantity} in stock
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProductId(product.product_id)
                        setIsNotesModalOpen(true)
                      }}
                      className="rounded-lg p-2 text-purple-600 transition-colors hover:bg-purple-100"
                      title="Product notes"
                    >
                      <FileText size={16} />
                    </button>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#1F764D]">{product.ordered_quantity}</p>
                      <p className="text-xs text-gray-500">bought</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No products are linked to this vendor yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedProductId && (
        <NotesModal
          productId={selectedProductId}
          isOpen={isNotesModalOpen}
          onClose={() => {
            setIsNotesModalOpen(false)
            setSelectedProductId(null)
          }}
          isAdmin={basePath.startsWith('/admin')}
        />
      )}

      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vendor-edit-modal-title"
        >
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 id="vendor-edit-modal-title" className="text-lg font-black text-gray-900 sm:text-xl">
                  Edit vendor
                </h2>
                <p className="mt-1 text-sm text-gray-500">Update name, contact information, and internal notes.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="shrink-0 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-800">Vendor name *</label>
                  <Input {...register('nursery_name')} className="h-11" />
                  <FieldError error={errors.nursery_name} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <Mail className="h-4 w-4 text-gray-500" />
                      Email
                    </label>
                    <Input
                      type="email"
                      {...register('contact_email')}
                      placeholder="Optional"
                      className="h-11"
                    />
                    <FieldError error={errors.contact_email} />
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <Phone className="h-4 w-4 text-gray-500" />
                      Phone
                    </label>
                    <Input
                      type="tel"
                      {...register('contact_phone')}
                      placeholder="Optional"
                      className="h-11"
                    />
                    <FieldError error={errors.contact_phone} />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-800">Notes</label>
                  <textarea
                    {...register('notes')}
                    rows={5}
                    placeholder="Internal notes about this vendor…"
                    className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus-visible:border-[#1F764D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F764D]/30"
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button onClick={editForm.handleSubmit(handleSave, (errs) => toast.error(Object.values(errs)[0]?.message ?? 'Please fix the errors in the form'))} disabled={isSaving} className="bg-[#13452D] hover:bg-[#0f3522]">
                    {isSaving ? 'Saving…' : 'Save changes'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
