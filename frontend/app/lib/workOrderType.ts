import type { WorkOrderType } from './types'

export type { WorkOrderType } from './types'

export const WORK_ORDER_TYPE_OPTIONS: WorkOrderType[] = [
  'INSTALL',
  'MAINTENANCE',
]

export function formatWorkOrderTypeLabel(value?: WorkOrderType | null) {
  if (!value) return 'Install'
  return value === 'MAINTENANCE' ? 'Maintenance' : 'Install'
}