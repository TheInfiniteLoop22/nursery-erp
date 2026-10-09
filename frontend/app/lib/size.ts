const NA_VALUE = 'N/A'

export const PRODUCT_SECTION_TREE = 'tree'
export const PRODUCT_SECTION_SHRUBS = 'shrubs'
export const PRODUCT_SECTION_PERENNIALS = 'perennials'

export function sectionUsesGallonPotFields(section: string | null | undefined): boolean {
  const s = String(section || '').trim().toLowerCase()
  return s === PRODUCT_SECTION_SHRUBS || s === PRODUCT_SECTION_PERENNIALS
}

/** Shrubs use gallons and/or height on the size line; perennials are gallons only. */
export function sectionIsShrubs(section: string | null | undefined): boolean {
  return String(section || '').trim().toLowerCase() === PRODUCT_SECTION_SHRUBS
}

export const normalizeDimensionValue = (value?: string | null) => {
  if (!value) return NA_VALUE
  const cleaned = value.trim()
  if (!cleaned || cleaned.toLowerCase() === 'n/a' || cleaned.toLowerCase() === 'na') {
    return NA_VALUE
  }
  return cleaned
}

/** Shrubs must have at least pot size (gallons) or height; both are allowed. */
export function shrubsHasGallonsOrHeight(gallons?: string | null, heightFeet?: string | null): boolean {
  const hasGallons = !!(gallons != null && String(gallons).trim())
  const hasHeight = normalizeDimensionValue(heightFeet) !== NA_VALUE
  return hasGallons || hasHeight
}

export const buildSizeLabel = (heightFeet?: string | null, caliperInches?: string | null) => {
  const height = normalizeDimensionValue(heightFeet)
  const caliper = normalizeDimensionValue(caliperInches)
  return `Height: ${height} ft | Caliper: ${caliper} in`
}

export const buildGallonsSizeLabel = (gallons?: string | number | null) => {
  if (gallons === null || gallons === undefined || gallons === '') return NA_VALUE
  const text = String(gallons).trim()
  if (!text) return NA_VALUE
  const parsed = Number(text)
  if (!Number.isFinite(parsed) || parsed <= 0) return text
  return `${parsed} Gallon`
}

export const buildShrubsSizeLabel = (gallons?: string | number | null, heightFeet?: string | null) => {
  const base = buildGallonsSizeLabel(gallons)
  const h = normalizeDimensionValue(heightFeet)
  const hasGallons = base !== NA_VALUE
  if (!hasGallons && h === NA_VALUE) return NA_VALUE
  if (!hasGallons) return `Height: ${h} ft`
  if (h === NA_VALUE) return base
  return `${base} | Height: ${h} ft`
}

export const buildProductSizeLabel = (
  section: string | null | undefined,
  heightFeet?: string | null,
  caliperInches?: string | null,
  gallons?: string | number | null,
) => {
  const s = String(section || '').trim().toLowerCase()
  if (s === PRODUCT_SECTION_SHRUBS) {
    return buildShrubsSizeLabel(gallons, heightFeet)
  }
  if (sectionUsesGallonPotFields(section)) {
    return buildGallonsSizeLabel(gallons)
  }
  return buildSizeLabel(heightFeet, caliperInches)
}

/**
 * Size text for pick lists / packing slips: uses section-aware dimensions (shrubs = gallons + height)
 * with fallback to the denormalized `size` field when computed text would be unhelpful.
 */
export function formatOrderPickListSize(
  section: string | null | undefined,
  legacySize: string | null | undefined,
  heightFeet?: string | null,
  caliperInches?: string | null,
  gallons?: string | number | null,
): string {
  const computed = buildProductSizeLabel(section, heightFeet, caliperInches, gallons).trim()
  const legacy = (legacySize || '').trim()
  const unhelpful =
    !computed ||
    computed === NA_VALUE ||
    computed === 'Height: N/A ft | Caliper: N/A in'
  if (!unhelpful) return computed
  if (legacy) return legacy
  return '—'
}

export const isDimensionNumber = (value: string) => {
  if (normalizeDimensionValue(value) === NA_VALUE) return true
  return /^\d+(\.\d+)?$/.test(value.trim())
}