export type UserRole = 'ADMIN' | 'EMPLOYEE' | 'NURSERY' | 'HEAD_INSTALLATION' | 'HEAD_MAINTENANCE'

export type OrderStatus = 'CREATED' | 'IN_PROGRESS' | 'COMPLETED'

export type WorkOrderType = 'MAINTENANCE' | 'INSTALL'

export interface User {
  user_id: string
  user_username: string
  user_password: string
  role: UserRole
  created_at: Date
}

export interface Nursery {
  nursery_id: string
  nursery_name: string
  contact_email?: string | null
  contact_phone?: string | null
  products_count?: number
  total_inventory?: number
  total_ordered_quantity?: number
  featured_products?: string[]
}

export interface NurseryDetail extends Nursery {
  products_count: number
  total_inventory: number
  total_ordered_quantity: number
  featured_products: string[]
  notes?: string | null
  products: Array<{
    product_id: string
    item_name: string
    size: string
    height_feet: string
    caliper_inches: string
    inventory_quantity: number
    ordered_quantity: number
    image_url?: string | null
  }>
}

export interface Product {
  product_id: string
  nursery_id: string
  item_name: string
  section?: 'tree' | 'shrubs' | 'perennials'
  zones?: number
  subzone?: string | null
  size: string
  height_feet: string
  caliper_inches: string
  gallons?: string | null
  inventory_quantity: number
  ordered_quantity: number
  base_price_per_unit: number
  rate_percentage: number
  image_url?: string
  nursery?: Nursery
}

export interface Order {
  order_id: string
  user_id: string
  client_name: string
  work_order_type: WorkOrderType
  total_order_amount: number
  status: OrderStatus
  ordered_at: Date
  updated_at: Date
  invoice_generated_at?: Date
  paid_at?: Date
  user?: User
  ordered_products?: OrderedProduct[]
}

export interface OrderedProduct {
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  rate_percentage?: number
  total_price: number
  product?: Product
}

export interface EmployeeScanLog {
  scan_id: string
  employee_id: string
  order_id: string
  product_id: string
  scanned_quantity: number
  scanned_at: Date
  employee?: User
  order?: Order
  product?: Product
}

export interface CreateProductFormData {
  item_name: string
  section?: 'tree' | 'shrubs' | 'perennials'
  zones?: number
  subzone?: string | null
  size?: string
  height_feet?: string
  caliper_inches?: string
  gallons?: string | null
  inventory_quantity: number
  base_price_per_unit: number
  rate_percentage: number
  nursery_id: string
  image_url?: string
}

export interface ProductSubmission {
  submission_id: string
  employee_id: string
  employee_username: string
  nursery_id: string
  item_name: string
  section?: 'tree' | 'shrubs' | 'perennials'
  zones?: number
  subzone?: string | null
  size: string
  height_feet: string
  caliper_inches: string
  gallons?: string | null
  inventory_quantity: number
  image_url?: string | null
  status: string
  approved_product_id?: string | null
  barcode_status: string
  barcode_printed_at?: string | null
  barcode_printed_by?: string | null
  reviewed_by?: string | null
  created_at: string
  updated_at: string
}

export interface NotificationItem {
  notification_id: string
  type: string
  title: string
  message: string
  actor_user_id?: string | null
  reference_id?: string | null
  is_read: boolean
  created_at: string
}

export interface ProductSubmissionFormData {
  item_name: string
  section?: 'tree' | 'shrubs' | 'perennials'
  zones?: number
  subzone?: string | null
  size?: string
  height_feet?: string
  caliper_inches?: string
  gallons?: string | null
  inventory_quantity: number
  nursery_id: string
  image_url?: string
}

export interface ApproveProductSubmissionFormData {
  base_price_per_unit: number
  rate_percentage: number
}

export interface CreateOrderFormData {
  client_name: string
  user_id: string
  work_order_type: WorkOrderType
  products: Array<{
    product_id: string
    quantity: number
  }>
}

export interface LoginFormData {
  username: string
  password: string
}