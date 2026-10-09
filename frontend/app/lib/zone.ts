export interface ZoneSubzoneOption {
  code: string
  label: string
}

export interface ZoneConfiguration {
  zone_number: number
  subzone_count: number
  subzones: ZoneSubzoneOption[]
}

export interface ZoneSelection {
  zone_number: number
  subzone: string | null
}

export const DEFAULT_ZONE_NUMBERS = [1]

export function normalizeSubzoneCode(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }

  const normalized = value.trim().toUpperCase()
  return normalized || null
}

export function buildZoneLabel(zoneNumber: number, subzone: string | null | undefined = null): string {
  const normalized = normalizeSubzoneCode(subzone)
  return normalized ? `${zoneNumber}${normalized}` : String(zoneNumber)
}

export function getZoneDisplayLabel(zoneNumber: number, subzone: string | null | undefined = null): string {
  return `Zone ${buildZoneLabel(zoneNumber, subzone)}`
}

export function generateSubzoneCodes(subzoneCount: number): string[] {
  if (subzoneCount <= 0) {
    return []
  }

  const toAlphaCode = (index: number): string => {
    let n = index
    let out = ''
    while (n >= 0) {
      out = String.fromCharCode(65 + (n % 26)) + out
      n = Math.floor(n / 26) - 1
    }
    return out
  }

  return Array.from({ length: subzoneCount }, (_, index) => toAlphaCode(index))
}

export function buildDefaultZoneConfigurations(): ZoneConfiguration[] {
  return DEFAULT_ZONE_NUMBERS.map((zoneNumber) => ({
    zone_number: zoneNumber,
    subzone_count: 0,
    subzones: [],
  }))
}

export function getZoneSelectionLabel(selection?: ZoneSelection | null): string {
  if (!selection) {
    return 'Select Zone'
  }

  return getZoneDisplayLabel(selection.zone_number, selection.subzone)
}

//test