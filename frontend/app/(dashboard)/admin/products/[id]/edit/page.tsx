'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { nurseries as nurseriesApi, products as productsApi, zones as zonesApi } from '@/app/lib/api'
import {
  buildProductSizeLabel,
  normalizeDimensionValue,
  sectionUsesGallonPotFields,
} from '@/app/lib/size'
import { getProductSectionLabel, normalizeProductSection, ProductSection, sectionIsShrubs } from '@/app/lib/productCategory'
import { productEditSchema, type ProductEditFormValues } from '@/app/lib/schemas'
import { createFormDataSetter, firstErrorMessage } from '@/app/lib/rhf-bridge'
import { FieldError } from '@/app/components/ui/field-error'
import { ZonePicker } from '@/app/components/zones/ZonePicker'
import { buildDefaultZoneConfigurations, type ZoneConfiguration } from '@/app/lib/zone'
import { NurseryVendorField, type NurseryOption } from '@/app/components/vendors/NurseryVendorField'
import {
  finalUnitPriceFromBaseAndRate,
  formatRateMultiplierString,
  rateMultiplierFromBaseAndFinalUnit,
} from '@/app/lib/pricing'

interface Product {
  product_id: string
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
  ordered_quantity: number
  base_price_per_unit: string
  rate_percentage: string
  image_url?: string | null
}

interface Nursery {
  nursery_id: string
  nursery_name: string
}

function sortNurseries(items: NurseryOption[]) {
  return [...items].sort((a, b) => a.nursery_name.localeCompare(b.nursery_name))
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter()
  const [productId, setProductId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [nurseries, setNurseries] = useState<Nursery[]>([])
  const [zoneConfigurations, setZoneConfigurations] = useState<ZoneConfiguration[]>([])
  const form = useForm<ProductEditFormValues>({
    resolver: zodResolver(productEditSchema),
    defaultValues: {
    section: 'tree' as ProductSection,
    zones: '1',
    subzone: '',
    nursery_id: '',
    item_name: '',
    height_feet: 'N/A',
    caliper_inches: 'N/A',
    gallons: '',
    inventory_quantity: '0',
    low_stock_threshold: '10',
    base_price_per_unit: '0',
    rate_percentage: '2.25',
    final_price_per_unit: '',
    image_url: '',
    },
  })
  const { formState: { errors } } = form
  // Live values for the custom pickers; setFormData keeps the old updater API on top of RHF.
  const formData = form.watch()
  const setFormData = createFormDataSetter(form)

  useEffect(() => {
    const resolve = async () => {
      const p = await Promise.resolve(params)
      setProductId(p.id)
    }
    resolve()
  }, [params])

  useEffect(() => {
    if (!productId) return

    const load = async () => {
      try {
        setIsLoading(true)
        const [product, zoneList, nurseryList] = await Promise.all([
          productsApi.getById(productId) as Promise<Product>,
          zonesApi.getAll(),
          nurseriesApi.getAll(),
        ])

        setNurseries(sortNurseries(nurseryList))
        setZoneConfigurations(zoneList.length > 0 ? zoneList : buildDefaultZoneConfigurations())
        setFormData({
          section: normalizeProductSection(product.section),
          zones: String(product.zones || 1),
          subzone: product.subzone || '',
          nursery_id: product.nursery_id,
          item_name: product.item_name,
          height_feet: product.height_feet || 'N/A',
          caliper_inches: product.caliper_inches || 'N/A',
          gallons: product.gallons ? String(product.gallons) : '',
          inventory_quantity: String(product.inventory_quantity),
          low_stock_threshold: '10',
          base_price_per_unit: String(product.base_price_per_unit),
          rate_percentage: String(product.rate_percentage),
          final_price_per_unit: (() => {
            const fp = finalUnitPriceFromBaseAndRate(
              Number(product.base_price_per_unit),
              Number(product.rate_percentage)
            )
            return Number.isFinite(fp) ? fp.toFixed(2) : ''
          })(),
          image_url: product.image_url || '',
        })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load product'
        toast.error(message)
        setNurseries([])
        setZoneConfigurations(buildDefaultZoneConfigurations())
        router.push('/admin/products')
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [productId, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target

    if (name === 'final_price_per_unit') {
      setFormData((prev) => {
        if (value.trim() === '') {
          return { ...prev, final_price_per_unit: '' }
        }
        const base = parseFloat(prev.base_price_per_unit)
        const fin = parseFloat(value)
        if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(fin)) {
          return { ...prev, final_price_per_unit: value }
        }
        const rate = rateMultiplierFromBaseAndFinalUnit(base, fin)
        return {
          ...prev,
          final_price_per_unit: value,
          rate_percentage: formatRateMultiplierString(rate),
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
            ? finalUnitPriceFromBaseAndRate(b, r).toFixed(2)
            : prev.final_price_per_unit
        return { ...prev, [name]: value, final_price_per_unit: fin }
      })
      return
    }

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
    setIsSaving(true)
    try {
      const payload = {
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
        low_stock_threshold: Number(formData.low_stock_threshold),
        base_price_per_unit: Number(formData.base_price_per_unit),
        rate_percentage: Number(formData.rate_percentage),
        image_url: formData.image_url.trim() || null,
      }

      const response = await productsApi.update(productId, payload)
      toast.success(response.message || 'Product updated successfully')
      router.push(`/admin/products/${productId}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update product'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="text-gray-600">Loading product...</div>
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-start gap-3">
        <Link href={`/admin/products/${productId}`}>
          <button className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Edit Product</h1>
          <p className="text-sm text-gray-600">Update product information and pricing</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(submitForm, (errs) => toast.error(firstErrorMessage(errs)))} noValidate className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
            <select
              name="section"
              value={formData.section}
              onChange={handleChange}
              className="w-full h-11 rounded-lg border border-gray-300 px-3 bg-white text-gray-900"
              required
            >
              <option value="tree">Trees</option>
              <option value="shrubs">Shrubs</option>
              <option value="perennials">Perennials</option>
            </select>
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
            label="Zone"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
            <input
              name="item_name"
              value={formData.item_name}
              onChange={handleChange}
              className="w-full h-11 rounded-lg border border-gray-300 px-3 text-gray-900"
              required
            />
            <FieldError error={errors.item_name} />
          </div>

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
            vendorsHref="/admin/nursery"
            selectClassName="h-11 rounded-lg border border-gray-300 px-3 bg-white text-gray-900"
          />

          {sectionIsShrubs(formData.section) ? (
            <>
              <div className="md:col-span-2">
                <p className="text-xs text-gray-500">
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
                  onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Gallons</label>
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
                  onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
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
                  onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Inventory</label>
            <input
              type="number"
              min="0"
              name="inventory_quantity"
              value={formData.inventory_quantity}
              onChange={handleChange}
              className="w-full h-11 rounded-lg border border-gray-300 px-3 text-gray-900"
              required
            />
            <FieldError error={errors.inventory_quantity} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold</label>
            <input
              type="number"
              min="0"
              name="low_stock_threshold"
              value={formData.low_stock_threshold}
              onChange={handleChange}
              className="w-full h-11 rounded-lg border border-gray-300 px-3 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base Price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              name="base_price_per_unit"
              value={formData.base_price_per_unit}
              onChange={handleChange}
              className="w-full h-11 rounded-lg border border-gray-300 px-3 text-gray-900"
              required
            />
            <FieldError error={errors.base_price_per_unit} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rate (multiplier)</label>
            <input
              type="number"
              min="0"
              step="0.000001"
              name="rate_percentage"
              value={formData.rate_percentage}
              onChange={handleChange}
              className="w-full h-11 rounded-lg border border-gray-300 px-3 text-gray-900"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Base × rate = final unit price.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Final price ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              name="final_price_per_unit"
              value={formData.final_price_per_unit}
              onChange={handleChange}
              className="w-full h-11 rounded-lg border border-gray-300 px-3 text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-1">Adjust to back-calculate the rate from the base price.</p>
          </div>
        </div>
        <div className="text-sm text-gray-700">
          Section: <span className="font-semibold">{getProductSectionLabel(formData.section)}</span>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (optional)</label>
          <input
            name="image_url"
            value={formData.image_url}
            onChange={handleChange}
            className="w-full h-11 rounded-lg border border-gray-300 px-3 text-gray-900"
          />
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-linear-to-r from-[#13452D] to-[#1F764D] px-5 py-3 text-white font-semibold disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
