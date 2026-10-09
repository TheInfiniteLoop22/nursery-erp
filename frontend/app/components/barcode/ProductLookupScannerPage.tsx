'use client'

import { useMemo, useState } from 'react'
import { ScanLine, Package, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card'
import { BarcodeScanner } from '@/app/components/barcode/BarcodeScanner'
import { products as productsApi } from '@/app/lib/api'
import { formatCurrency } from '@/app/lib/utils'
import { getProductSectionLabel } from '@/app/lib/productCategory'
import { getZoneDisplayLabel } from '@/app/lib/zone'
import { finalUnitPriceFromBaseAndRate } from '@/app/lib/pricing'

interface ProductLookupScannerPageProps {
  roleLabel: string
}

interface ProductRecord {
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

interface ScanEntry {
  barcode: string
  product: ProductRecord
}

function parseNumber(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function ProductLookupScannerPage({ roleLabel }: ProductLookupScannerPageProps) {
  /** Employee / nursery: show only sell price and picking fields (no cost breakdown). */
  const staffCompactView = roleLabel === 'employee' || roleLabel === 'nursery'

  const [scannerActive, setScannerActive] = useState(false)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [lastScannedCode, setLastScannedCode] = useState('')
  const [product, setProduct] = useState<ProductRecord | null>(null)
  const [scanEntries, setScanEntries] = useState<ScanEntry[]>([])

  const finalPrice = useMemo(() => {
    if (!product) return 0
    return finalUnitPriceFromBaseAndRate(
      parseNumber(product.base_price_per_unit),
      parseNumber(product.rate_percentage)
    )
  }, [product])

  const lookupByBarcode = async (barcode: string): Promise<ProductRecord | null> => {
    const scannedDigits = barcode.replace(/\D/g, '')
    if (!scannedDigits) return null

    return (await productsApi.getByBarcode(scannedDigits)) as ProductRecord
  }

  const handleScan = async (barcode: string) => {
    const raw = barcode.trim()
    if (!raw) return

    setLastScannedCode(raw)
    setIsLookingUp(true)
    try {
      const found = await lookupByBarcode(raw)
      if (!found) {
        setProduct(null)
        toast.error('No product found for this barcode')
        return
      }

      setProduct(found)
      setScanEntries((prev) => [{ barcode: raw, product: found }, ...prev].slice(0, 10))
      toast.success(`Loaded product: ${found.item_name}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch product details'
      toast.error(message)
    } finally {
      setIsLookingUp(false)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Product Scanner</h1>
          <p className="text-sm text-gray-600 mt-1">
            {staffCompactView
              ? 'Scan a barcode for name, zone, size, price, and quantity on hand.'
              : `Scan a barcode to view complete product details (${roleLabel} view)`}
          </p>
        </div>
        <Button onClick={() => setScannerActive(true)} disabled={isLookingUp}>
          <ScanLine className="h-4 w-4 mr-2" />
          {isLookingUp ? 'Looking up...' : scannerActive ? 'Scanning Active' : 'Start Scanning'}
        </Button>
      </div>

      {scannerActive && (
        <BarcodeScanner
          isActive={scannerActive}
          onScan={handleScan}
          onClose={() => setScannerActive(false)}
          displayMode="inline"
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Scan Result</CardTitle>
          <CardDescription>
            Last scanned barcode: {lastScannedCode || '—'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!product ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <Package className="mx-auto h-10 w-10 text-gray-400" />
              <p className="mt-3 text-sm text-gray-600">No product loaded yet. Scan a barcode to begin.</p>
            </div>
          ) : staffCompactView ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-semibold">Product identified</span>
                </div>
                <p className="mt-2 text-lg font-bold text-gray-900">{product.item_name}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-3">
                  <span className="text-gray-500">Size</span>
                  <p className="mt-0.5 font-semibold text-gray-900">{product.size}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <span className="text-gray-500">Zone</span>
                  <p className="mt-0.5 font-semibold text-gray-900">
                    {getZoneDisplayLabel(product.zones, product.subzone || null)}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <span className="text-gray-500">Quantity</span>
                  <p className="mt-0.5 font-semibold text-gray-900">{product.inventory_quantity}</p>
                </div>
                <div className="rounded-lg bg-[#13452D] p-3 text-white sm:col-span-2">
                  <span className="text-sm text-white/80">Final price</span>
                  <p className="mt-0.5 text-2xl font-bold">{formatCurrency(finalPrice)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-semibold">Product identified</span>
                </div>
                <p className="mt-2 text-lg font-bold text-gray-900">{product.item_name}</p>
                <p className="text-xs text-gray-600">{product.product_id}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-gray-50 p-3"><span className="text-gray-500">Section:</span> {getProductSectionLabel(product.section)}</div>
                <div className="rounded-lg bg-gray-50 p-3"><span className="text-gray-500">Zone:</span> {getZoneDisplayLabel(product.zones, product.subzone || null)}</div>
                <div className="rounded-lg bg-gray-50 p-3"><span className="text-gray-500">Size:</span> {product.size}</div>
                <div className="rounded-lg bg-gray-50 p-3"><span className="text-gray-500">Nursery ID:</span> {product.nursery_id}</div>
                <div className="rounded-lg bg-gray-50 p-3"><span className="text-gray-500">Inventory:</span> {product.inventory_quantity}</div>
                <div className="rounded-lg bg-gray-50 p-3"><span className="text-gray-500">Ordered:</span> {product.ordered_quantity}</div>
                <div className="rounded-lg bg-gray-50 p-3"><span className="text-gray-500">Base Price:</span> {formatCurrency(parseNumber(product.base_price_per_unit))}</div>
                <div className="rounded-lg bg-gray-50 p-3"><span className="text-gray-500">Rate (x):</span> {product.rate_percentage}</div>
              </div>

              <div className="rounded-xl bg-[#13452D] p-4 text-white">
                <p className="text-sm text-white/80">Final Price</p>
                <p className="text-2xl font-bold">{formatCurrency(finalPrice)}</p>
              </div>
            </div>
          )}

          {scanEntries.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Recent scans</p>
              <div className="space-y-2">
                {scanEntries.map((entry, index) => {
                  const entryFinal = finalUnitPriceFromBaseAndRate(
                    parseNumber(entry.product.base_price_per_unit),
                    parseNumber(entry.product.rate_percentage)
                  )
                  return (
                  <div
                    key={`${entry.barcode}-${entry.product.product_id}-${index}`}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs sm:text-sm"
                  >
                    {staffCompactView ? (
                      <div className="flex flex-col gap-1.5 text-gray-800">
                        <span className="font-semibold text-gray-900">{entry.product.item_name}</span>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-gray-600">
                          <span>Size {entry.product.size}</span>
                          <span>Zone {getZoneDisplayLabel(entry.product.zones, entry.product.subzone || null)}</span>
                          <span>Qty {entry.product.inventory_quantity}</span>
                          <span className="font-medium text-gray-900">{formatCurrency(entryFinal)}</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-gray-900">{entry.product.item_name}</span>
                          <span className="font-mono text-gray-600">{entry.barcode}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-600">
                          <span>{entry.product.product_id}</span>
                          <span>{getZoneDisplayLabel(entry.product.zones, entry.product.subzone || null)}</span>
                          <span>{formatCurrency(entryFinal)}</span>
                        </div>
                      </>
                    )}
                  </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
