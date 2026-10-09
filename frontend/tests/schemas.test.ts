import { describe, expect, it } from 'vitest'
import {
  laborActualsSchema,
  laborEntrySchema,
  noteSchema,
  hourlyRateSchema,
  orderCreateSchema,
  orderDetailsSchema,
  productEditSchema,
  submissionApprovalSchema,
  employeeCreateSchema,
  eventSchema,
  loginSchema,
  productCreateSchema,
  productSubmissionSchema,
  vendorSchema,
  zoneSchema,
} from '@/app/lib/schemas'

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? [] : result.error!.issues.map((i) => i.message)

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    expect(loginSchema.safeParse({ username: 'admin', password: 'admin123' }).success).toBe(true)
  })
  it('requires both fields', () => {
    expect(messages(loginSchema.safeParse({ username: '  ', password: '' }))).toEqual([
      'Username is required',
      'Password is required',
    ])
  })
})

describe('employeeCreateSchema', () => {
  const valid = {
    username: 'jane',
    password: 'secret1',
    confirmPassword: 'secret1',
    role: 'employee',
    hourly_rate: '20',
    hourly_rate_multiplier: '1.0',
    final_hourly_rate: '20.00',
  }
  it('accepts a valid employee', () => {
    expect(employeeCreateSchema.safeParse(valid).success).toBe(true)
  })
  it('rejects mismatched passwords', () => {
    expect(messages(employeeCreateSchema.safeParse({ ...valid, confirmPassword: 'other' }))).toContain('Passwords do not match')
  })
  it('rejects short usernames, short passwords and unknown roles', () => {
    expect(employeeCreateSchema.safeParse({ ...valid, username: 'ab' }).success).toBe(false)
    expect(employeeCreateSchema.safeParse({ ...valid, password: '123', confirmPassword: '123' }).success).toBe(false)
    expect(employeeCreateSchema.safeParse({ ...valid, role: 'admin' }).success).toBe(false)
  })
})

describe('vendorSchema', () => {
  it('only requires a name; email and phone are optional but validated when present', () => {
    expect(vendorSchema.safeParse({ nursery_name: 'Green Valley', contact_email: '', contact_phone: '', notes: '' }).success).toBe(true)
    expect(messages(vendorSchema.safeParse({ nursery_name: 'X', contact_email: 'nope', contact_phone: '', notes: '' }))).toContain(
      'Enter a valid email address'
    )
    expect(messages(vendorSchema.safeParse({ nursery_name: '', contact_email: '', contact_phone: '', notes: '' }))).toContain(
      'Vendor name is required'
    )
  })
})

describe('eventSchema / zoneSchema', () => {
  it('validates event date and time shapes', () => {
    expect(eventSchema.safeParse({ event_name: 'Delivery', event_date: '2026-10-05', event_time: '12:30' }).success).toBe(true)
    expect(eventSchema.safeParse({ event_name: 'Delivery', event_date: '05/10/2026', event_time: '12:30' }).success).toBe(false)
  })
  it('limits subzones to A-Z and zone numbers to >= 1', () => {
    expect(zoneSchema.safeParse({ zone_number: '3', subzone_count: '4' }).success).toBe(true)
    expect(zoneSchema.safeParse({ zone_number: '0', subzone_count: '4' }).success).toBe(false)
    expect(zoneSchema.safeParse({ zone_number: '3', subzone_count: '27' }).success).toBe(false)
  })
})

describe('product schemas', () => {
  const base = {
    section: 'tree',
    zones: '1',
    subzone: '',
    item_name: 'Red Maple',
    height_feet: '6',
    caliper_inches: 'N/A',
    gallons: '',
    inventory_quantity: '12',
    nursery_id: 'nur_001',
    image_url: '',
  }
  it('accepts a valid submission', () => {
    expect(productSubmissionSchema.safeParse(base).success).toBe(true)
  })
  it('requires a vendor and a whole-number quantity', () => {
    expect(productSubmissionSchema.safeParse({ ...base, nursery_id: '' }).success).toBe(false)
    expect(productSubmissionSchema.safeParse({ ...base, inventory_quantity: '1.5' }).success).toBe(false)
  })
  it('requires gallons or height for shrubs, like the API does', () => {
    const shrub = { ...base, section: 'shrubs', height_feet: 'N/A', gallons: '' }
    expect(messages(productSubmissionSchema.safeParse(shrub))).toContain('For shrubs, enter pot size (gallons) and/or height')
    expect(productSubmissionSchema.safeParse({ ...shrub, gallons: '3' }).success).toBe(true)
  })
  it('admin create also needs a positive price', () => {
    const admin = { ...base, base_price_per_unit: '49.99', rate_percentage: '2.25', final_price_per_unit: '112.48' }
    expect(productCreateSchema.safeParse(admin).success).toBe(true)
    expect(productCreateSchema.safeParse({ ...admin, base_price_per_unit: '0' }).success).toBe(false)
  })
})

describe('order schemas', () => {
  const header = { client_name: 'Acme Gardens', user_id: 'ADM001', work_order_type: 'INSTALL', designer_name: 'Alex' }
  it('requires at least one line item', () => {
    expect(messages(orderCreateSchema.safeParse({ ...header, items: [] }))).toContain('Add at least one product to the work order')
  })
  it('accepts valid line items and rejects bad quantities', () => {
    expect(orderCreateSchema.safeParse({ ...header, items: [{ product_id: '12345678', quantity: 2 }] }).success).toBe(true)
    expect(orderCreateSchema.safeParse({ ...header, items: [{ product_id: '12345678', quantity: 0 }] }).success).toBe(false)
    expect(orderCreateSchema.safeParse({ ...header, items: [{ product_id: '12345678', quantity: 1.5 }] }).success).toBe(false)
    expect(messages(orderCreateSchema.safeParse({ ...header, items: [{ product_id: '12345678', quantity: NaN }] }))).toContain('Quantity is required')
  })
  it('validates header-only edits and rejects unknown work order types', () => {
    expect(orderDetailsSchema.safeParse({ client_name: 'X', work_order_type: 'MAINTENANCE', designer_name: 'Jordan' }).success).toBe(true)
    expect(orderDetailsSchema.safeParse({ client_name: 'X', work_order_type: 'DEMOLITION', designer_name: 'Jordan' }).success).toBe(false)
    expect(orderDetailsSchema.safeParse({ client_name: ' ', work_order_type: 'INSTALL', designer_name: 'Jordan' }).success).toBe(false)
  })
})

describe('pricing-related schemas', () => {
  it('submission approval needs a name, a positive base price and a positive multiplier', () => {
    const ok = { item_name: 'Oak', base_price_per_unit: '10', rate_percentage: '2.25', final_price_per_unit: '22.50' }
    expect(submissionApprovalSchema.safeParse(ok).success).toBe(true)
    expect(submissionApprovalSchema.safeParse({ ...ok, base_price_per_unit: '0' }).success).toBe(false)
    expect(submissionApprovalSchema.safeParse({ ...ok, rate_percentage: '-1' }).success).toBe(false)
    expect(submissionApprovalSchema.safeParse({ ...ok, item_name: '' }).success).toBe(false)
  })
  it('product edit also validates the low-stock threshold', () => {
    const ok = {
      section: 'tree', zones: '1', subzone: '', item_name: 'Oak', height_feet: '6', caliper_inches: 'N/A', gallons: '',
      inventory_quantity: '4', nursery_id: 'nur_001', image_url: '', base_price_per_unit: '10', rate_percentage: '2', final_price_per_unit: '20',
      low_stock_threshold: '10',
    }
    expect(productEditSchema.safeParse(ok).success).toBe(true)
    expect(productEditSchema.safeParse({ ...ok, low_stock_threshold: '-2' }).success).toBe(false)
  })
  it('hourly rate allows a zero base but needs a positive multiplier', () => {
    expect(hourlyRateSchema.safeParse({ hourly_rate: '0', hourly_rate_multiplier: '1.5', final_hourly_rate: '0.00' }).success).toBe(true)
    expect(hourlyRateSchema.safeParse({ hourly_rate: '20', hourly_rate_multiplier: '0', final_hourly_rate: '0' }).success).toBe(false)
  })
})

describe('notes and labour schemas', () => {
  it('rejects blank and oversized notes', () => {
    expect(noteSchema.safeParse({ note_text: '   ' }).success).toBe(false)
    expect(noteSchema.safeParse({ note_text: 'x'.repeat(2001) }).success).toBe(false)
    expect(noteSchema.safeParse({ note_text: 'Replant in spring' }).success).toBe(true)
  })
  it('labour actuals: hours between 0 and 24', () => {
    expect(laborActualsSchema.safeParse({ actual_hours: '7.5', notes: '' }).success).toBe(true)
    expect(laborActualsSchema.safeParse({ actual_hours: '25', notes: '' }).success).toBe(false)
    expect(laborActualsSchema.safeParse({ actual_hours: '-1', notes: '' }).success).toBe(false)
  })
  it('crew entry needs an employee, a date and valid task rows', () => {
    const row = { category: 'planting', actual_hours: '4', notes: '' }
    const ok = { date: '2026-10-05', employee_id: 'emp_001', jobs: [row] }
    expect(laborEntrySchema.safeParse(ok).success).toBe(true)
    expect(messages(laborEntrySchema.safeParse({ ...ok, employee_id: '' }))).toContain('Choose an employee')
    expect(messages(laborEntrySchema.safeParse({ ...ok, jobs: [] }))).toContain('Add at least one task')
    expect(messages(laborEntrySchema.safeParse({ ...ok, jobs: [{ ...row, category: '' }] }))).toContain('Choose a task for every row')
    expect(laborEntrySchema.safeParse({ ...ok, jobs: [{ ...row, labor_entry_id: 'lab_1' }] }).success).toBe(true)
  })
})
