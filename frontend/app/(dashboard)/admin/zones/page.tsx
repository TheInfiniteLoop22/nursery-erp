'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus, PencilLine, Trash2, Layers3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { zones as zonesApi } from '@/app/lib/api'
import { zoneSchema, type ZoneFormValues } from '@/app/lib/schemas'
import { FieldError } from '@/app/components/ui/field-error'
import {
  buildDefaultZoneConfigurations,
  generateSubzoneCodes,
  getZoneDisplayLabel,
  type ZoneConfiguration,
} from '@/app/lib/zone'

export default function AdminZonesPage() {
  const [zoneItems, setZoneItems] = useState<ZoneConfiguration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingZone, setEditingZone] = useState<number | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting: isSaving },
  } = useForm<ZoneFormValues>({
    resolver: zodResolver(zoneSchema),
    defaultValues: { zone_number: '1', subzone_count: '0' },
  })

  const fallbackZones = useMemo(() => buildDefaultZoneConfigurations(), [])

  const loadZones = async () => {
    try {
      const data = await zonesApi.getAll()
      setZoneItems(data.length > 0 ? data : fallbackZones)
    } catch (error: unknown) {
      console.error('Failed to load zones', error)
      const message = error instanceof Error ? error.message : 'Failed to load zones'
      toast.error(message)
      setZoneItems(fallbackZones)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadZones()
  }, [])

  const resetForm = () => {
    setEditingZone(null)
    reset({ zone_number: '1', subzone_count: '0' })
  }

  const onSubmit = async (values: ZoneFormValues) => {
    try {
      const payload = {
        zone_number: Number(values.zone_number),
        subzone_count: Number(values.subzone_count),
      }

      if (editingZone === null) {
        await zonesApi.create(payload)
        toast.success('Zone created successfully')
      } else {
        await zonesApi.update(editingZone, payload)
        toast.success('Zone updated successfully')
      }

      resetForm()
      await loadZones()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save zone'
      toast.error(message)
    }
  }

  const handleEdit = (zone: ZoneConfiguration) => {
    setEditingZone(zone.zone_number)
    reset({
      zone_number: String(zone.zone_number),
      subzone_count: String(zone.subzone_count),
    })
  }

  const handleDelete = async (zoneNumber: number) => {
    if (!confirm(`Delete zone ${zoneNumber}? This will remove its configured subzones.`)) {
      return
    }

    try {
      await zonesApi.delete(zoneNumber)
      toast.success(`Zone ${zoneNumber} deleted`)
      await loadZones()
      if (editingZone === zoneNumber) {
        resetForm()
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete zone'
      toast.error(message)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Zones & Subzones</h1>
          <p className="text-sm text-gray-600">Configure zone groups and the subzones shown in product forms.</p>
        </div>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Layers3 className="h-5 w-5" /> Zone Editor</CardTitle>
          <CardDescription>Add, edit, or delete zone groups and their generated subzones.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Zone Number</label>
              <Input
                type="number"
                min={1}
                {...register('zone_number')}
                required
              />
              <FieldError error={errors.zone_number} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Subzone Count</label>
              <Input
                type="number"
                min={0}
                {...register('subzone_count')}
                required
              />
              <FieldError error={errors.subzone_count} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button type="submit" disabled={isSaving} className="bg-linear-to-r from-[#13452D] to-[#1F764D] text-white">
                <Plus className="mr-2 h-4 w-4" />
                {editingZone === null ? 'Add Zone' : 'Save Zone'}
              </Button>
              {editingZone !== null && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {isLoading ? (
          <Card className="border-gray-200">
            <CardContent className="p-6 text-sm text-gray-600">Loading zones...</CardContent>
          </Card>
        ) : zoneItems.length === 0 ? (
          <Card className="border-gray-200">
            <CardContent className="p-6 text-sm text-gray-600">No zones configured yet.</CardContent>
          </Card>
        ) : (
          zoneItems.map((zone) => {
            const previewSubzones = zone.subzones.length > 0 ? zone.subzones : generateSubzoneCodes(zone.subzone_count).map((code) => ({ code, label: `${zone.zone_number}${code}` }))

            return (
              <Card key={zone.zone_number} className="border-gray-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{getZoneDisplayLabel(zone.zone_number)}</CardTitle>
                      <CardDescription>{zone.subzone_count} configured subzone{zone.subzone_count === 1 ? '' : 's'}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="outline" onClick={() => handleEdit(zone)}>
                        <PencilLine className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" onClick={() => handleDelete(zone.zone_number)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {previewSubzones.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {previewSubzones.map((subzone) => (
                        <span key={subzone.label} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                          {subzone.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">This zone currently has no subzones.</p>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}