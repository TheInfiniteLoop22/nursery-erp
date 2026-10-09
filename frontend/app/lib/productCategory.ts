import { sectionIsShrubs, sectionUsesGallonPotFields } from '@/app/lib/size'

export type ProductSection = 'tree' | 'shrubs' | 'perennials'

export { sectionIsShrubs, sectionUsesGallonPotFields }

export const PRODUCT_SECTION_LABELS: Record<ProductSection, string> = {
  tree: 'Trees',
  shrubs: 'Shrubs',
  perennials: 'Perennials',
}

export function normalizeProductSection(section: string | null | undefined): ProductSection {
  const s = (section || '').trim().toLowerCase()
  if (s === 'shrubs') return 'shrubs'
  if (s === 'perennials') return 'perennials'
  return 'tree'
}

export function getProductSectionLabel(section: string | null | undefined): string {
  return PRODUCT_SECTION_LABELS[normalizeProductSection(section)]
}

/** True for shrubs and perennials (gallon pot + bulk scan quantity). */
export function isShrubsProduct(section: string | null | undefined): boolean {
  return sectionUsesGallonPotFields(section)
}

export function barcodeCountForProduct(section: string | null | undefined, requestedQuantity: number): number {
  const quantity = Math.max(0, Math.floor(Number(requestedQuantity) || 0))
  if (quantity === 0) {
    return 0
  }
  return sectionUsesGallonPotFields(section) ? 1 : quantity
}
