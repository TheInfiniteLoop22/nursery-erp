'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { nurseries as nurseriesApi, products as productsApi, zones as zonesApi } from '@/app/lib/api'
import {
  buildProductSizeLabel,
  normalizeDimensionValue,
  shrubsHasGallonsOrHeight,
  sectionUsesGallonPotFields,
} from '@/app/lib/size'
import { getProductSectionLabel, ProductSection, sectionIsShrubs } from '@/app/lib/productCategory'
import { productSubmissionSchema, type ProductSubmissionFormValues } from '@/app/lib/schemas'
import { createFormDataSetter, firstErrorMessage } from '@/app/lib/rhf-bridge'
import { FieldError } from '@/app/components/ui/field-error'
import { ZonePicker } from '@/app/components/zones/ZonePicker'
import { buildDefaultZoneConfigurations, type ZoneConfiguration } from '@/app/lib/zone'
import { NurseryVendorField, type NurseryOption } from '@/app/components/vendors/NurseryVendorField'

interface Nursery {
  nursery_id: string
  nursery_name: string
}

function sortNurseries(items: NurseryOption[]) {
  return [...items].sort((a, b) => a.nursery_name.localeCompare(b.nursery_name))
}

export default function NurseryCreateProductPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [nurseries, setNurseries] = useState<Nursery[]>([])
  const [zoneConfigurations, setZoneConfigurations] = useState<ZoneConfiguration[]>([])
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const form = useForm<ProductSubmissionFormValues>({
    resolver: zodResolver(productSubmissionSchema),
    defaultValues: {
    section: 'tree' as ProductSection,
    zones: '1',
    subzone: '',
    item_name: '',
    height_feet: 'N/A',
    caliper_inches: 'N/A',
    gallons: '',
    inventory_quantity: '',
    nursery_id: '',
    image_url: '',
    },
  })
  const { formState: { errors } } = form
  // Live values for the custom pickers; setFormData keeps the old updater API on top of RHF.
  const formData = form.watch()
  const setFormData = createFormDataSetter(form)

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [nurseryData, zoneData] = await Promise.all([
          nurseriesApi.getAll(),
          zonesApi.getAll(),
        ])
        setNurseries(sortNurseries(nurseryData))
        setZoneConfigurations(zoneData.length > 0 ? zoneData : buildDefaultZoneConfigurations())
      } catch {
        toast.error('Failed to load nurseries')
        setZoneConfigurations(buildDefaultZoneConfigurations())
      } finally {
        setIsLoading(false)
      }
    }
    loadInitialData()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    if (name === 'section') {
      const next = value as ProductSection
      setFormData((prev) => ({
        ...prev,
        section: next,
        ...(next === 'perennials' ? { height_feet: 'N/A', caliper_inches: 'N/A' } : {}),
      }))
      return
    }
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const submitForm = async () => {
    setIsSubmitting(true)

    try {

      if (sectionIsShrubs(formData.section) && !shrubsHasGallonsOrHeight(formData.gallons, formData.height_feet)) {
        toast.error('For shrubs, enter pot size (gallons) and/or height (at least one is required)')
        return
      }

      const response = await productsApi.submitForReview({
        nursery_id: formData.nursery_id,
        item_name: formData.item_name.trim(),
        section: formData.section,
        zones: Number(formData.zones),
        subzone: formData.subzone.trim() || null,
        size: buildProductSizeLabel(formData.section, formData.height_feet, formData.caliper_inches, formData.gallons),
        height_feet: normalizeDimensionValue(formData.height_feet),
        caliper_inches: normalizeDimensionValue(formData.caliper_inches),
        gallons: sectionUsesGallonPotFields(formData.section) ? formData.gallons.trim() || null : null,
        inventory_quantity: Number(formData.inventory_quantity),
        image_url: formData.image_url.trim() || null,
      })

      setSubmissionId(response.submission_id)
      toast.success(response.message || 'Product submitted successfully')
      toast.info('Admin will review and complete pricing')
      setFormData({
        section: 'tree',
        zones: '1',
        subzone: '',
        item_name: '',
        height_feet: 'N/A',
        caliper_inches: 'N/A',
        gallons: '',
        inventory_quantity: '',
        nursery_id: '',
        image_url: '',
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to submit product'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-start gap-3">
        <Link href="/nursery">
          <button className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Submit Product</h1>
          <p className="text-sm text-gray-600">Nursery product entry for admin review</p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-700 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">Nursery users cannot set price or rate</p>
            <p className="text-sm text-amber-700">Submit the product details here. Admin will add base price and rate after review.</p>
          </div>
        </div>
      </div>

      {submissionId && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-700 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-900">Submission sent</p>
              <p className="text-sm text-emerald-700">Submission ID: {submissionId}. Admin has been notified.</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={form.handleSubmit(submitForm, (errs) => toast.error(firstErrorMessage(errs)))} noValidate className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Section *</label>
            <select name="section" value={formData.section} onChange={handleChange} className="w-full h-11 rounded-lg border border-gray-300 px-3 bg-white text-gray-900" required>
              <option value="tree">Trees</option>
              <option value="shrubs">Shrubs</option>
              <option value="perennials">Perennials</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">{getProductSectionLabel(formData.section)}</p>
          </div>

          <ZonePicker
            value={{
              zone_number: Number(formData.zones),
              subzone: formData.subzone || null,
            }}
            zones={zoneConfigurations}
            onChange={({ zone_number, subzone }) => {
              setFormData(prev => ({
                ...prev,
                zones: String(zone_number),
                subzone: subzone || '',
              }))
            }}
            label="Zone *"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
            <input name="item_name" value={formData.item_name} onChange={handleChange} className="w-full h-11 rounded-lg border border-gray-300 px-3 text-gray-900" required />
          <FieldError error={errors.item_name} />
          </div>
          {sectionIsShrubs(formData.section) ? (
            <>
              <div className="md:col-span-2">
                <p className="text-xs text-gray-500 mb-2">
                  Pot size (gallons) and/or height — at least one is required (both is fine too).
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gallons</label>
                <input
                  name="gallons"
                  value={formData.gallons}
                  onChange={handleChange}
                  placeholder="e.g. 5 Gallon"
                  className="w-full h-11 rounded-lg border border-gray-300 px-3 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Height (ft)</label>
                <input
                  name="height_feet"
                  value={formData.height_feet}
                  onChange={handleChange}
                  onFocus={(e) => {
                    if (e.target.value === 'N/A') {
                      setFormData((prev) => ({ ...prev, height_feet: '' }))
                    }
                  }}
                  onBlur={(e) => {
                    if (!e.target.value.trim()) {
                      setFormData((prev) => ({ ...prev, height_feet: 'N/A' }))
                    }
                  }}
                  placeholder='e.g. 2"-3"'
                  className="w-full h-11 rounded-lg border border-gray-300 px-3 text-gray-900"
                />
              </div>
            </>
          ) : sectionUsesGallonPotFields(formData.section) ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gallons *</label>
              <input
                name="gallons"
                value={formData.gallons}
                onChange={handleChange}
                placeholder="e.g. 5 Gallon"
                className="w-full h-11 rounded-lg border border-gray-300 px-3 text-gray-900"
                required
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Height (ft)</label>
                <input
                  name="height_feet"
                  value={formData.height_feet}
                  onChange={handleChange}
                  onFocus={(e) => {
                    if (e.target.value === 'N/A') {
                      setFormData(prev => ({ ...prev, height_feet: '' }))
                    }
                  }}
                  onBlur={(e) => {
                    if (!e.target.value.trim()) {
                      setFormData(prev => ({ ...prev, height_feet: 'N/A' }))
                    }
                  }}
                  placeholder='e.g. 2"-3"'
                  className="w-full h-11 rounded-lg border border-gray-300 px-3 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Caliper (inches)</label>
                <input
                  name="caliper_inches"
                  value={formData.caliper_inches}
                  onChange={handleChange}
                  onFocus={(e) => {
                    if (e.target.value === 'N/A') {
                      setFormData(prev => ({ ...prev, caliper_inches: '' }))
                    }
                  }}
                  onBlur={(e) => {
                    if (!e.target.value.trim()) {
                      setFormData(prev => ({ ...prev, caliper_inches: 'N/A' }))
                    }
                  }}
                  placeholder='e.g. 1.5"-2.25"'
                  className="w-full h-11 rounded-lg border border-gray-300 px-3 text-gray-900"
                />
              </div>
            </>
          )}
          <NurseryVendorField
            nurseries={nurseries}
            value={formData.nursery_id}
            onChange={(nurseryId) => setFormData((prev) => ({ ...prev, nursery_id: nurseryId }))}
            onVendorCreated={(vendor) => {
              setNurseries((prev) => sortNurseries([...prev, vendor]))
              setFormData((prev) => ({ ...prev, nursery_id: vendor.nursery_id }))
            }}
            disabled={isLoading}
            label="Vendor *"
            vendorsHref="/nursery/nursery"
            selectClassName="h-11 rounded-lg border border-gray-300 px-3 bg-white text-gray-900"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
            <input type="number" min="0" name="inventory_quantity" value={formData.inventory_quantity} onChange={handleChange} className="w-full h-11 rounded-lg border border-gray-300 px-3 text-gray-900" required />
          <FieldError error={errors.inventory_quantity} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (optional)</label>
          <input name="image_url" value={formData.image_url} onChange={handleChange} className="w-full h-11 rounded-lg border border-gray-300 px-3 text-gray-900" />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-linear-to-r from-[#13452D] to-[#1F764D] px-5 py-3 text-white font-semibold disabled:opacity-50"
        >
          <CheckCircle className="h-4 w-4" />
          {isSubmitting ? 'Submitting...' : 'Submit for Review'}
        </button>
      </form>
    </div>
  )
}
