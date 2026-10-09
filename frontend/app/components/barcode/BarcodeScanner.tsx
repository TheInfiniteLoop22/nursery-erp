'use client'

import { useState, useEffect, useRef } from 'react'
import { ScanLine, X, Wifi, CheckCircle, Package } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'

interface ProductProgress {
  product_id: string
  name: string
  size: string
  quantity: number
  scanned_quantity: number
}

interface BarcodeScanner {
  onScan: (barcode: string) => void
  isActive: boolean
  onClose: () => void
  products?: ProductProgress[]
  displayMode?: 'modal' | 'inline'
}

export function BarcodeScanner({
  onScan,
  isActive,
  onClose,
  products = [],
  displayMode = 'modal',
}: BarcodeScanner) {
  const [manualInput, setManualInput] = useState('')
  const [lastScanned, setLastScanned] = useState<{ barcode: string; ok: boolean; label: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isActive) {
      // Reset the scanner whenever it is (re)activated.
      /* eslint-disable react-hooks/set-state-in-effect */
      setLastScanned(null)
      setManualInput('')
      /* eslint-enable react-hooks/set-state-in-effect */
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isActive])

  const submitBarcode = (raw: string) => {
    const value = raw.trim()
    if (!value) return
    setManualInput('')
    onScan(value)
    // Optimistic label — parent will update products state which re-renders here
    setLastScanned({ barcode: value, ok: true, label: 'Processing…' })
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  const handleScannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submitBarcode(manualInput)
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submitBarcode(manualInput)
  }

  const totalRequired = products.reduce((s, p) => s + p.quantity, 0)
  const totalScanned  = products.reduce((s, p) => s + p.scanned_quantity, 0)
  const allDone       = totalRequired > 0 && totalScanned >= totalRequired

  if (!isActive) return null

  const cardContent = (
    <Card className="w-full max-w-lg max-h-[90vh] flex flex-col">
      <CardHeader className="shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Barcode Scanner</CardTitle>
            <CardDescription>Keep scanning — window stays open</CardDescription>
          </div>
          {displayMode === 'modal' && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Overall progress bar */}
        {totalRequired > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>{totalScanned} of {totalRequired} items scanned</span>
              <span>{Math.round((totalScanned / totalRequired) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  allDone ? 'bg-green-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${(totalScanned / totalRequired) * 100}%` }}
              />
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4 overflow-y-auto">

          {/* Scanner ready area */}
          <div
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 cursor-pointer transition-colors ${
              allDone
                ? 'border-green-400 bg-green-50'
                : 'border-emerald-400 bg-emerald-50'
            }`}
            onClick={() => inputRef.current?.focus()}
          >
            <div className="relative flex items-center justify-center">
              {!allDone && (
                <div className="absolute h-16 w-16 rounded-full bg-emerald-100 animate-ping opacity-40" />
              )}
              {allDone
                ? <CheckCircle className="relative h-10 w-10 text-green-600" />
                : <ScanLine   className="relative h-10 w-10 text-emerald-600" />
              }
            </div>
            <p className={`text-sm font-semibold ${
              allDone ? 'text-green-700' : 'text-emerald-700'
            }`}>
              {allDone ? 'All items scanned!' : 'Ready — scan now'}
            </p>
            {!allDone && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                <Wifi className="h-3.5 w-3.5" />
                Listening for scanner input
              </div>
            )}
          </div>

          {/* Hidden input */}
          <input
            ref={inputRef}
            className="sr-only"
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            onKeyDown={handleScannerKeyDown}
            aria-label="Scanner input"
            autoComplete="off"
          />

          {/* Last scan feedback */}
          {lastScanned && (
            <div className="rounded-lg bg-gray-100 px-4 py-2 text-center text-xs text-gray-600">
              Last scan: <span className="font-mono font-semibold">{lastScanned.barcode}</span>
            </div>
          )}

          {/* Per-product progress list */}
          {products.length > 0 && (
            <div className="space-y-2">
              {products.map(p => {
                const done      = p.scanned_quantity >= p.quantity
                const pct       = Math.min(100, Math.round((p.scanned_quantity / p.quantity) * 100))
                const remaining = p.quantity - p.scanned_quantity
                return (
                  <div
                    key={p.product_id}
                    className={`rounded-lg border px-3 py-2 ${
                      done ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        {done
                          ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                          : <Package     className="h-4 w-4 text-gray-400 shrink-0" />
                        }
                        <span className="text-sm font-medium truncate">{p.name}</span>
                        <span className="text-xs text-gray-400 shrink-0">{p.size}</span>
                      </div>
                      <span className={`text-xs font-semibold shrink-0 ml-2 ${
                        done ? 'text-green-600' : remaining === 0 ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        {p.scanned_quantity}/{p.quantity}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          done ? 'bg-green-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Manual input fallback */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">or type manually</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <Input
                placeholder="Type barcode and press Enter"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitBarcode(manualInput)
                  }
                }}
              />
              <Button type="submit" variant="outline">Submit</Button>
            </form>
          </div>

      </CardContent>
    </Card>
  )

  if (displayMode === 'inline') {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4">
        {cardContent}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      {cardContent}
    </div>
  )
}

interface BarcodeDisplayProps {
  barcode: string
  productName?: string
  size?: 'sm' | 'md' | 'lg'
}

export function BarcodeDisplay({ barcode, productName, size = 'md' }: BarcodeDisplayProps) {
  const sizeClasses = {
    sm: 'h-8 text-xs',
    md: 'h-12 text-sm',
    lg: 'h-16 text-base'
  }

  return (
    <div className="text-center">
      {/* Barcode Visual */}
      <div className={`bg-white border-2 border-gray-300 rounded p-2 mb-2 ${sizeClasses[size]}`}>
        <div className="h-full flex items-center justify-center">
          <div className="flex space-x-1">
            {/* Simple barcode visualization */}
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="bg-black"
                style={{
                  width: [2, 1, 1, 2, 1, 2][i % 6] + 'px', // fixed pattern: render must stay pure
                  height: '100%',
                }}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Barcode Text */}
      <div className={sizeClasses[size].includes('text-xs') ? 'text-xs' : 'text-sm'}>
        <div className="font-mono">{barcode}</div>
        {productName && (
          <div className="text-gray-600 mt-1">{productName}</div>
        )}
      </div>
    </div>
  )
}
