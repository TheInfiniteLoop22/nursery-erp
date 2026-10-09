'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, Printer, Check, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { products as productsApi, nurseries as nurseriesApi, zones as zonesApi } from '@/app/lib/api'
import { printBarcode } from '@/app/lib/barcodePrinter'
import {
  buildProductSizeLabel,
  normalizeDimensionValue,
  sectionUsesGallonPotFields,
} from '@/app/lib/size'
import { barcodeCountForProduct, getProductSectionLabel, ProductSection, sectionIsShrubs } from '@/app/lib/productCategory'
import { productCreateSchema, type ProductCreateFormValues } from '@/app/lib/schemas'
import { createFormDataSetter, firstErrorMessage } from '@/app/lib/rhf-bridge'
import { FieldError } from '@/app/components/ui/field-error'
import { ZonePicker } from '@/app/components/zones/ZonePicker'
import { buildDefaultZoneConfigurations, getZoneDisplayLabel, type ZoneConfiguration } from '@/app/lib/zone'
import { NurseryVendorField, type NurseryOption } from '@/app/components/vendors/NurseryVendorField'
import {
  finalUnitPriceFromBaseAndRate,
  formatRateMultiplierString,
  rateMultiplierFromBaseAndFinalUnit,
} from '@/app/lib/pricing'

interface Nursery {
  nursery_id: string
  nursery_name: string
}

function sortNurseries(items: NurseryOption[]) {
  return [...items].sort((a, b) => a.nursery_name.localeCompare(b.nursery_name))
}

export default function CreateProductPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [nurseries, setNurseries] = useState<Nursery[]>([])
  const [zoneConfigurations, setZoneConfigurations] = useState<ZoneConfiguration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [printStatus, setPrintStatus] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [createdProductId, setCreatedProductId] = useState<string | null>(null)
  const form = useForm<ProductCreateFormValues>({
    resolver: zodResolver(productCreateSchema),
    defaultValues: {
    section: 'tree' as ProductSection,
    zones: '1',
    subzone: '',
    item_name: '',
    height_feet: 'N/A',
    caliper_inches: 'N/A',
    gallons: '',
    inventory_quantity: '',
    base_price_per_unit: '',
    rate_percentage: '2.25',
    final_price_per_unit: '',
    nursery_id: '',
    image_url: ''
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
      } catch (error: unknown) {
        console.error('Error fetching nurseries:', error)
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

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleManualPrint = async () => {
    if (!createdProductId) {
      toast.error('No product to print barcodes for')
      return
    }

    const requestedQuantity = parseInt(formData.inventory_quantity)
    if (requestedQuantity <= 0) {
      toast.error('Invalid quantity for printing')
      return
    }

    const quantity = barcodeCountForProduct(formData.section, requestedQuantity)

    try {
      toast.info(`Printing ${quantity} barcode(s)...`)
      await printBarcode(createdProductId, formData.item_name, quantity, undefined, {
        section: formData.section,
        height: formData.height_feet,
        caliper: formData.caliper_inches,
        gallons: formData.gallons,
      })
      setPrintStatus({
        success: true,
        message: `${quantity} barcode(s) printed successfully`
      })
      toast.success('Barcodes printed successfully!')
    } catch (error: unknown) {
      console.error('Failed to print barcode:', error)
      const message = error instanceof Error ? error.message : 'Failed to print barcodes'
      setPrintStatus({
        success: false,
        message,
      })
      toast.error('Failed to print barcodes')
    }
  }

  const submitForm = async () => {
    setIsSubmitting(true)
    setPrintStatus(null)

    try {
      const potSection = sectionUsesGallonPotFields(formData.section)
      const selectedZoneNumber = Number(formData.zones)
      const selectedZoneConfig = zoneConfigurations.find((z) => z.zone_number === selectedZoneNumber)
      if (
        selectedZoneConfig &&
        selectedZoneConfig.subzone_count > 0 &&
        !formData.subzone.trim()
      ) {
        toast.error(`Subzone is required for zone ${selectedZoneNumber}`)
        setIsSubmitting(false)
        return
      }

      // Prepare data for API
      const productData = {
        nursery_id: formData.nursery_id,
        item_name: formData.item_name.trim(),
        section: formData.section,
        zones: Number(formData.zones),
        subzone: formData.subzone.trim() || null,
        size: buildProductSizeLabel(
          formData.section,
          formData.height_feet,
          formData.caliper_inches,
          formData.gallons,
        ),
        height_feet: normalizeDimensionValue(formData.height_feet),
        caliper_inches: normalizeDimensionValue(formData.caliper_inches),
        gallons: potSection ? formData.gallons.trim() || null : null,
        inventory_quantity: parseInt(formData.inventory_quantity),
        ordered_quantity: 0,
        base_price_per_unit: parseFloat(formData.base_price_per_unit),
        rate_percentage: parseFloat(formData.rate_percentage),
        // Only include image_url if it's a valid URL, otherwise send null
        image_url: formData.image_url.trim() && formData.image_url.startsWith('http') 
          ? formData.image_url.trim() 
          : null
      }

      // Call the API
      const response = await productsApi.create(productData)
      const productId = response.product_id
      
      toast.success('Product created successfully!')
      toast.info(`Product ID: ${productId}`)
      setCreatedProductId(productId)

      // Automatically print barcodes
      const requestedQuantity = parseInt(formData.inventory_quantity)
      const quantity = barcodeCountForProduct(formData.section, requestedQuantity)
      if (quantity > 0) {
        try {
          toast.info(`Preparing to print ${quantity} barcode(s)...`)
          await printBarcode(productId, formData.item_name, quantity, undefined, {
            section: formData.section,
            height: formData.height_feet,
            caliper: formData.caliper_inches,
            gallons: formData.gallons,
          })
          setPrintStatus({
            success: true,
            message: `${quantity} barcode(s) printed successfully`
          })
          toast.success('Barcodes printed successfully!')
        } catch (error: unknown) {
          console.error('Failed to print barcode:', error)
          const message = error instanceof Error ? error.message : 'Failed to print barcode. Product was created successfully.'
          setPrintStatus({
            success: false,
            message,
          })
          toast.error('Failed to print barcodes. You can reprint from the products list.')
        }
      }
      
      // Redirect after a delay
      setTimeout(() => {
        router.push('/admin/products')
      }, 2000)
    } catch (error: unknown) {
      console.error('Error creating product:', error)
      const message = error instanceof Error ? error.message : 'Failed to create product'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-start gap-3 sm:gap-4">
        <Link href="/admin/products">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Add New Product</h1>
          <p className="text-gray-600 mt-1">Create a new product with automatic barcode generation</p>
        </div>
      </div>

      {/* Print Status Alert */}
      {printStatus && (
        <Card className={printStatus.success ? 'border-emerald-500 bg-emerald-50' : 'border-orange-500 bg-orange-50'}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${printStatus.success ? 'bg-emerald-100' : 'bg-orange-100'}`}>
                {printStatus.success ? (
                  <Check className="h-5 w-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                )}
              </div>
              <div className="flex-1">
                <p className={`font-semibold ${printStatus.success ? 'text-emerald-700' : 'text-orange-700'}`}>
                  {printStatus.message}
                </p>
                {!printStatus.success && createdProductId && (
                  <p className="text-sm text-orange-600 mt-1">
                    You can reprint the barcodes using the button below.
                  </p>
                )}
              </div>
              {!printStatus.success && createdProductId && (
                <Button
                  onClick={handleManualPrint}
                  variant="outline"
                  size="sm"
                  className="border-orange-300 text-orange-700 hover:bg-orange-100"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Retry Print
                </Button>
              )}
              <Button
                onClick={() => setPrintStatus(null)}
                variant="ghost"
                size="sm"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={form.handleSubmit(submitForm, (errs) => toast.error(firstErrorMessage(errs)))} noValidate>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Form */}
          <div className="xl:col-span-2 space-y-4 sm:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Product Information</CardTitle>
                <CardDescription>Enter the basic details of the product</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Section *
                    </label>
                    <select
                      name="section"
                      value={formData.section}
                      onChange={handleChange}
                      className="w-full h-10 border border-gray-300 rounded-md px-3 bg-white"
                      required
                    >
                      <option value="tree">Trees</option>
                      <option value="shrubs">Shrubs</option>
                      <option value="perennials">Perennials</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {getProductSectionLabel(formData.section)}
                    </p>
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

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Name *
                    </label>
                    <Input
                      name="item_name"
                      value={formData.item_name}
                      onChange={handleChange}
                      placeholder="e.g., Japanese Maple"
                      required
                    />
                    <FieldError error={errors.item_name} />
                  </div>
                  
                  {sectionIsShrubs(formData.section) ? (
                    <>
                      <div className="md:col-span-2">
                        <p className="text-xs text-gray-500">
                          Pot size (gallons) and/or height — at least one is required (both is fine too).
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Gallons
                        </label>
                        <Input
                          name="gallons"
                          value={formData.gallons}
                          onChange={handleChange}
                          placeholder="e.g. 5 Gallon"
                          className="w-full h-10 border border-gray-300 rounded-md px-3 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Height (ft)
                        </label>
                        <Input
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
                          className="w-full h-10 border border-gray-300 rounded-md px-3 bg-white"
                        />
                      </div>
                    </>
                  ) : sectionUsesGallonPotFields(formData.section) ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Gallons *
                      </label>
                      <Input
                        name="gallons"
                        value={formData.gallons}
                        onChange={handleChange}
                        placeholder="e.g. 5 Gallon"
                        className="w-full h-10 border border-gray-300 rounded-md px-3 bg-white"
                        required
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Height (ft)
                        </label>
                        <Input
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
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Caliper (inches)
                        </label>
                        <Input
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
                    vendorsHref="/admin/nursery"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory & Pricing</CardTitle>
                <CardDescription>Set stock, base price, rate multiplier, and review final unit price</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2 tracking-wide">
                      Quantity *
                    </label>
                    <Input
                      type="number"
                      name="inventory_quantity"
                      value={formData.inventory_quantity}
                      onChange={handleChange}
                      placeholder="0"
                      min="0"
                      required
                    />
                    <FieldError error={errors.inventory_quantity} />
                    <p className="text-xs text-gray-500 mt-1">
                      Barcodes will be auto-generated
                    </p>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2 tracking-wide">
                      Base Price ($) *
                    </label>
                    <Input
                      type="number"
                      name="base_price_per_unit"
                      value={formData.base_price_per_unit}
                      onChange={handleChange}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      required
                    />
                    <FieldError error={errors.base_price_per_unit} />
                    <p className="text-xs text-gray-500 mt-1">The starting unit price before multiplier.</p>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 tracking-wide">
                        Rate (multiplier) *
                      </label>
                      <Input
                        type="number"
                        name="rate_percentage"
                        value={formData.rate_percentage}
                        onChange={handleChange}
                        placeholder="2.25"
                        min="0"
                        step="0.000001"
                        inputMode="decimal"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Applied as base price × rate (e.g. 2.25).</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 tracking-wide">
                        Final price ($) *
                      </label>
                      <Input
                        type="number"
                        name="final_price_per_unit"
                        value={formData.final_price_per_unit}
                        onChange={handleChange}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                      />
                      <p className="text-xs text-gray-500 mt-1">Editing this updates the rate to match the base price.</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-emerald-300 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Live Price Preview</div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-700">Base × Rate</span>
                      <span className="text-lg font-semibold text-emerald-700">
                        {(formData.base_price_per_unit || '0.00')} × {(formData.rate_percentage || '0')}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between items-end">
                      <span className="text-sm font-medium text-gray-700">Final Unit Price</span>
                      <span className="text-2xl font-bold text-emerald-600">
                        $
                        {(formData.base_price_per_unit && formData.rate_percentage
                          ? parseFloat(formData.base_price_per_unit) * parseFloat(formData.rate_percentage)
                          : 0
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* <Card>
              <CardHeader>
                <CardTitle>Product Image</CardTitle>
                <CardDescription>Upload or provide image URL (optional)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-600 mb-2">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-500">PNG, JPG or GIF (max. 5MB)</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Or paste image URL
                  </label>
                  <Input
                    name="image_url"
                    value={formData.image_url}
                    onChange={handleChange}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </CardContent>
            </Card> */}
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-4 sm:space-y-6">
            <Card className="xl:sticky xl:top-6">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Section:</span>
                    <span className="font-medium">{getProductSectionLabel(formData.section)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Product Name:</span>
                    <span className="font-medium">{formData.item_name || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Zone:</span>
                    <span className="font-medium">{getZoneDisplayLabel(Number(formData.zones), formData.subzone || null)}</span>
                  </div>
                  {sectionIsShrubs(formData.section) ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Gallons:</span>
                        <span className="font-medium">{formData.gallons.trim() ? formData.gallons : '—'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Height (ft):</span>
                        <span className="font-medium">
                          {normalizeDimensionValue(formData.height_feet) === 'N/A' ? '—' : formData.height_feet}
                        </span>
                      </div>
                    </>
                  ) : sectionUsesGallonPotFields(formData.section) ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Gallons:</span>
                      <span className="font-medium">{formData.gallons || 'Enter value'}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Height (ft):</span>
                        <span className="font-medium">{formData.height_feet || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Caliper (in):</span>
                        <span className="font-medium">{formData.caliper_inches || 'N/A'}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Initial Stock:</span>
                    <span className="font-medium">{formData.inventory_quantity || '0'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Base Price:</span>
                    <span className="font-medium">
                      ${formData.base_price_per_unit || '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Rate (×):</span>
                    <span className="font-medium">{formData.rate_percentage || '—'}</span>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold">Final Price:</span>
                    <span className="text-xl font-bold text-emerald-600">
                      ${formData.base_price_per_unit && formData.rate_percentage
                        ? (
                            parseFloat(formData.base_price_per_unit) *
                            parseFloat(formData.rate_percentage)
                          ).toFixed(2)
                        : '0.00'
                      }
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Creating...' : 'Create Product'}
                  </Button>
                  <Link href="/admin/products" className="block">
                    <Button variant="outline" className="w-full" type="button">
                      Cancel
                    </Button>
                  </Link>
                </div>

                <div className="text-xs text-gray-500 text-center pt-4 border-t">
                  <p>Barcodes are automatically generated on create.</p>
                  <p>
                    Trees print one barcode per unit. Shrubs and perennials print a single pot barcode.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  )
}