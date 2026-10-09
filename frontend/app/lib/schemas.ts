import { z } from 'zod'
import { shrubsHasGallonsOrHeight } from '@/app/lib/size'
import { sectionIsShrubs, type ProductSection } from '@/app/lib/productCategory'

/**
 * Shared Zod schemas used with React Hook Form (via zodResolver).
 * They mirror the Pydantic models on the FastAPI backend, which stays the
 * authoritative validator; these give instant, field-level feedback in the UI.
 */

const requiredText = (label: string, max = 120) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)

const optionalText = (max = 255) => z.string().trim().max(max, `Must be at most ${max} characters`)

/** Positive money-like number coming from an <input type="number"> as a string. */
const positiveNumberString = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => !Number.isNaN(Number(v)), `${label} must be a number`)
    .refine((v) => Number(v) > 0, `${label} must be greater than 0`)

const nonNegativeNumberString = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => !Number.isNaN(Number(v)), `${label} must be a number`)
    .refine((v) => Number(v) >= 0, `${label} cannot be negative`)

const nonNegativeIntString = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .regex(/^\d+$/, `${label} must be a whole number`)

// ---------------------------------------------------------------- auth
export const loginSchema = z.object({
  username: requiredText('Username', 64),
  password: z.string().min(1, 'Password is required').max(128),
})
export type LoginFormValues = z.infer<typeof loginSchema>

// ------------------------------------------------------------- employees
export const USER_ROLES = ['employee', 'nursery', 'head_installation', 'head_maintenance'] as const

const optionalNonNegative = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), `${label} must be a number ≥ 0`)

export const employeeCreateSchema = z
  .object({
    username: requiredText('Username', 64).min(3, 'Username must be at least 3 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters').max(128),
    confirmPassword: z.string(),
    role: z.enum(USER_ROLES),
    hourly_rate: optionalNonNegative('Hourly rate'),
    hourly_rate_multiplier: optionalNonNegative('Multiplier'),
    final_hourly_rate: optionalNonNegative('Final rate'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
export type EmployeeCreateFormValues = z.infer<typeof employeeCreateSchema>

// ----------------------------------------------------- vendors (nurseries)
export const vendorSchema = z.object({
  nursery_name: requiredText('Vendor name', 120),
  contact_email: z
    .string()
    .trim()
    .max(255)
    .refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email address'),
  contact_phone: z
    .string()
    .trim()
    .max(64)
    .refine((v) => v === '' || /^[+()\-\s\d.]{7,}$/.test(v), 'Enter a valid phone number'),
  notes: optionalText(2000),
})
export type VendorFormValues = z.infer<typeof vendorSchema>

// ---------------------------------------------------------------- events
export const eventSchema = z.object({
  event_name: requiredText('Event name', 120),
  event_date: z.string().min(1, 'Date is required').regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date'),
  event_time: z.string().min(1, 'Time is required').regex(/^\d{2}:\d{2}/, 'Use a valid time'),
})
export type EventFormValues = z.infer<typeof eventSchema>

// ----------------------------------------------------------------- zones
export const zoneSchema = z.object({
  zone_number: nonNegativeIntString('Zone number').refine((v) => Number(v) >= 1, 'Zone number must be at least 1'),
  subzone_count: nonNegativeIntString('Subzone count').refine((v) => Number(v) <= 26, 'At most 26 subzones (A–Z)'),
})
export type ZoneFormValues = z.infer<typeof zoneSchema>

// -------------------------------------------------------------- products
const productBase = {
  section: z.string().min(1, 'Section is required'),
  zones: nonNegativeIntString('Zone').refine((v) => Number(v) >= 1, 'Zone must be at least 1'),
  subzone: z.string().trim().max(2),
  item_name: requiredText('Item name', 120),
  height_feet: z.string(),
  caliper_inches: z.string(),
  gallons: z.string().trim().max(40),
  inventory_quantity: nonNegativeIntString('Quantity'),
  nursery_id: z.string().min(1, 'Vendor is required'),
  image_url: z.string().trim().max(500),
}

/** Shrubs need a pot size (gallons) and/or a height, same rule the API enforces. */
const shrubRule = <T extends { section: string; gallons: string; height_feet: string }>(v: T, ctx: z.RefinementCtx) => {
  if (sectionIsShrubs(v.section as ProductSection) && !shrubsHasGallonsOrHeight(v.gallons, v.height_feet)) {
    ctx.addIssue({
      code: 'custom',
      path: ['gallons'],
      message: 'For shrubs, enter pot size (gallons) and/or height',
    })
  }
}

/** Nursery/vendor submits a product for admin review. */
export const productSubmissionSchema = z.object(productBase).superRefine(shrubRule)
export type ProductSubmissionFormValues = z.infer<typeof productSubmissionSchema>

const productPricing = {
  base_price_per_unit: positiveNumberString('Base price'),
  rate_percentage: nonNegativeNumberString('Markup %').refine((v) => Number(v) <= 1000, 'Markup % looks too high'),
  final_price_per_unit: z.string(),
}

/** Admin creates a live product directly (adds pricing). */
export const productCreateSchema = z.object({ ...productBase, ...productPricing }).superRefine(shrubRule)
export type ProductCreateFormValues = z.infer<typeof productCreateSchema>

/** Admin edits an existing product (adds the low-stock threshold). */
export const productEditSchema = z
  .object({ ...productBase, ...productPricing, low_stock_threshold: nonNegativeIntString('Low-stock threshold') })
  .superRefine(shrubRule)
export type ProductEditFormValues = z.infer<typeof productEditSchema>

// ---------------------------------------------------- submission approval
export const submissionApprovalSchema = z.object({
  item_name: requiredText('Product name', 120),
  base_price_per_unit: positiveNumberString('Base price'),
  rate_percentage: positiveNumberString('Rate (multiplier)'),
  final_price_per_unit: z.string(),
})
export type SubmissionApprovalFormValues = z.infer<typeof submissionApprovalSchema>

// ---------------------------------------------------------------- orders
export const orderItemSchema = z.object({
  product_id: z.string().min(1),
  quantity: z
    .number({ error: 'Quantity is required' })
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1'),
})
export type OrderItemFormValue = z.infer<typeof orderItemSchema>

export const orderCreateSchema = z.object({
  client_name: requiredText('Client name', 120),
  user_id: requiredText('Admin user ID', 64),
  work_order_type: z.enum(['INSTALL', 'MAINTENANCE']),
  designer_name: requiredText('Designer', 60),
  items: z.array(orderItemSchema).min(1, 'Add at least one product to the work order'),
})
export type OrderCreateFormValues = z.infer<typeof orderCreateSchema>

/** Header fields of an existing work order (line items are diffed separately on the edit page). */
export const orderDetailsSchema = z.object({
  client_name: requiredText('Client name', 120),
  work_order_type: z.enum(['INSTALL', 'MAINTENANCE']),
  designer_name: requiredText('Designer', 60),
})
export type OrderDetailsFormValues = z.infer<typeof orderDetailsSchema>

// ------------------------------------------------------------ hourly rate
export const hourlyRateSchema = z.object({
  hourly_rate: nonNegativeNumberString('Base rate'),
  hourly_rate_multiplier: positiveNumberString('Rate multiplier'),
  final_hourly_rate: z.string(),
})
export type HourlyRateFormValues = z.infer<typeof hourlyRateSchema>

// ----------------------------------------------------------- product notes
export const noteSchema = z.object({
  note_text: requiredText('Note', 2000),
})
export type NoteFormValues = z.infer<typeof noteSchema>

// ------------------------------------------------- labour actuals (day sheet)
export const laborActualsSchema = z.object({
  actual_hours: nonNegativeNumberString('Actual hours').refine((v) => Number(v) <= 24, 'A day cannot exceed 24 hours'),
  notes: optionalText(500),
})
export type LaborActualsFormValues = z.infer<typeof laborActualsSchema>

// ------------------------------------------------- crew labour entry (modal)
export const laborJobRowSchema = z.object({
  labor_entry_id: z.string().optional(),
  category: z.string().min(1, 'Choose a task for every row'),
  actual_hours: nonNegativeNumberString('Hours').refine((v) => Number(v) <= 24, 'A day cannot exceed 24 hours'),
  notes: optionalText(500),
})

export const laborEntrySchema = z.object({
  date: z.string().min(1, 'Date is required'),
  employee_id: z.string().min(1, 'Choose an employee'),
  jobs: z.array(laborJobRowSchema).min(1, 'Add at least one task'),
})
export type LaborEntryFormValues = z.infer<typeof laborEntrySchema>

// -------------------------------------------------------------- planning
export const planningCreateSchema = z
  .object({
    plan_type: z.enum(['INSTALL', 'MAINTENANCE']),
    job_name: requiredText('Job name', 120),
    location: optionalText(255),
    work_order_id: z.string(),
    job_date: z.string().min(1, 'Job date is required'),
    time_in: z.string(),
    time_out: z.string(),
    prepared_by: z.string(),
    billable: z.boolean(),
    create_calendar_event: z.boolean(),
    notes: optionalText(2000),
  })
  .refine((v) => !v.time_in || !v.time_out || v.time_out > v.time_in, {
    path: ['time_out'],
    message: 'Time out must be after time in',
  })
export type PlanningCreateFormValues = z.infer<typeof planningCreateSchema>
