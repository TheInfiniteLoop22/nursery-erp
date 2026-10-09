'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import {
  buildDefaultZoneConfigurations,
  generateSubzoneCodes,
  getZoneDisplayLabel,
  getZoneSelectionLabel,
  normalizeSubzoneCode,
  type ZoneConfiguration,
  type ZoneSelection,
} from '@/app/lib/zone'

interface ZonePickerProps {
  value: ZoneSelection
  onChange: (value: ZoneSelection) => void
  zones?: ZoneConfiguration[]
  label?: string
  className?: string
  disabled?: boolean
}

export function ZonePicker({
  value,
  onChange,
  zones,
  label = 'Zone',
  className,
  disabled = false,
}: ZonePickerProps) {
  const [open, setOpen] = useState(false)
  const [hoveredZone, setHoveredZone] = useState<number | null>(value.zone_number)
  const containerRef = useRef<HTMLDivElement>(null)

  const availableZones = useMemo(() => {
    return (zones && zones.length > 0 ? zones : buildDefaultZoneConfigurations()).slice().sort((left, right) => left.zone_number - right.zone_number)
  }, [zones])

  const activeZone = availableZones.find((zone) => zone.zone_number === hoveredZone) || availableZones[0] || null

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    // Keep the hover highlight in sync when the selected zone is changed from outside.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoveredZone(value.zone_number)
  }, [value.zone_number])

  const selectZone = (zone: ZoneConfiguration) => {
    if (zone.subzone_count > 0) {
      const subzones = generateSubzoneCodes(zone.subzone_count)
      onChange({
        zone_number: zone.zone_number,
        subzone: subzones[0] ?? null,
      })
    } else {
      onChange({
        zone_number: zone.zone_number,
        subzone: null,
      })
    }
    setOpen(false)
  }

  const selectSubzone = (zoneNumber: number, subzoneCode: string) => {
    onChange({
      zone_number: zoneNumber,
      subzone: normalizeSubzoneCode(subzoneCode),
    })
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 text-left text-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100"
      >
        <span>{getZoneSelectionLabel(value)}</span>
        <ChevronDown className="h-4 w-4 text-gray-500" />
      </button>

      {open && !disabled && (
        <div className="absolute z-30 mt-2 flex w-md max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="w-44 border-r border-gray-100 bg-gray-50 p-2">
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Zones</p>
            <div className="space-y-1">
              {availableZones.map((zone) => {
                const isActive = zone.zone_number === value.zone_number
                const hasSubzones = zone.subzone_count > 0

                return (
                  <button
                    key={zone.zone_number}
                    type="button"
                    onMouseEnter={() => setHoveredZone(zone.zone_number)}
                    onFocus={() => setHoveredZone(zone.zone_number)}
                    onClick={() => selectZone(zone)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive ? 'bg-emerald-600 text-white' : 'text-gray-700 hover:bg-white hover:text-gray-900',
                    )}
                  >
                    <span>{getZoneDisplayLabel(zone.zone_number)}</span>
                    {hasSubzones && <ChevronRight className="h-4 w-4" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="min-h-48 flex-1 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Subzones</p>
                <p className="text-sm text-gray-600">
                  {activeZone ? getZoneDisplayLabel(activeZone.zone_number) : 'Choose a zone'}
                </p>
              </div>
              {activeZone && activeZone.subzone_count > 0 && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  {activeZone.subzone_count} configured
                </span>
              )}
            </div>

            {!activeZone && <p className="text-sm text-gray-500">No zones available.</p>}

            {activeZone && activeZone.subzone_count === 0 && (
              <button
                type="button"
                onClick={() => selectZone(activeZone)}
                className="flex w-full items-center justify-between rounded-xl border border-dashed border-gray-300 px-4 py-3 text-left text-sm text-gray-700 hover:border-emerald-500 hover:bg-emerald-50"
              >
                <span>Select the base zone</span>
                <span className="font-semibold">{getZoneDisplayLabel(activeZone.zone_number)}</span>
              </button>
            )}

            {activeZone && activeZone.subzone_count > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {generateSubzoneCodes(activeZone.subzone_count).map((subzoneCode) => {
                  const isSelected = value.zone_number === activeZone.zone_number && normalizeSubzoneCode(value.subzone) === subzoneCode

                  return (
                    <button
                      key={`${activeZone.zone_number}${subzoneCode}`}
                      type="button"
                      onClick={() => selectSubzone(activeZone.zone_number, subzoneCode)}
                      className={cn(
                        'rounded-xl border px-4 py-3 text-sm font-medium transition-colors',
                        isSelected
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-500 hover:bg-emerald-50',
                      )}
                    >
                      {getZoneDisplayLabel(activeZone.zone_number, subzoneCode)}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}