export const WORK_ORDER_DESIGNER_OPTIONS = ['Alex', 'Jordan', 'Taylor'] as const

export type WorkOrderDesignerName = (typeof WORK_ORDER_DESIGNER_OPTIONS)[number]
