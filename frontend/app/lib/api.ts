// API configuration and helper functions

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export const API_ENDPOINTS = {
  // Auth endpoints
  login: `${API_BASE_URL}/auth/login`,
  register: `${API_BASE_URL}/auth/register`,
  me: `${API_BASE_URL}/auth/me`,

  // Product endpoints
  products: `${API_BASE_URL}/products`,
  productsAll: `${API_BASE_URL}/products/all`,
  productLookupByBarcode: `${API_BASE_URL}/products/lookup/by-barcode`,
  productById: (id: string) => `${API_BASE_URL}/products/${id}`,
  productUpdate: (id: string) => `${API_BASE_URL}/products/${id}`,
  productDelete: (id: string) => `${API_BASE_URL}/products/${id}`,
  productAdd: `${API_BASE_URL}/products/add`,
  productAddStock: (id: string) => `${API_BASE_URL}/products/${id}/add-stock`,
  productSubmit: `${API_BASE_URL}/products/submit`,
  productSubmissionPending: `${API_BASE_URL}/products/submissions/pending`,
  productSubmissionPendingBarcode: `${API_BASE_URL}/products/submissions/pending-barcode`,
  productSubmissionMine: `${API_BASE_URL}/products/submissions/mine`,
  productSubmissionById: (id: string) => `${API_BASE_URL}/products/submissions/${id}`,
  productSubmissionApprove: (id: string) => `${API_BASE_URL}/products/submissions/${id}/approve`,
  productSubmissionBarcodeStatus: (id: string) => `${API_BASE_URL}/products/submissions/${id}/barcode-status`,

  // Order endpoints
  orders: `${API_BASE_URL}/orders`,
  ordersAll: `${API_BASE_URL}/orders/all`,
  ordersSummary: `${API_BASE_URL}/orders/summary`,
  ordersPaid: `${API_BASE_URL}/orders/paid`,
  orderById: (id: string) => `${API_BASE_URL}/orders/${id}`,
  orderCreate: `${API_BASE_URL}/orders/create`,
  orderAddProduct: (orderId: string) => `${API_BASE_URL}/orders/${orderId}/add-product`,
  orderRemoveProduct: (orderId: string) => `${API_BASE_URL}/orders/${orderId}/remove-product`,
  orderStatus: (orderId: string) => `${API_BASE_URL}/orders/${orderId}/complete`,
  orderApprove: (orderId: string) => `${API_BASE_URL}/orders/${orderId}/start`,
  orderUpdate: (orderId: string) => `${API_BASE_URL}/orders/${orderId}/update`,

  // Nursery endpoints
  nurseries: `${API_BASE_URL}/nursery`,
  nurseryAll: `${API_BASE_URL}/nursery/all`,
  nurserySummary: `${API_BASE_URL}/nursery/summary`,
  nurseryById: (id: string) => `${API_BASE_URL}/nursery/${id}`,
  nurseryAdd: `${API_BASE_URL}/nursery/add`,

  // Zone endpoints
  zones: `${API_BASE_URL}/zones`,
  zoneByNumber: (zoneNumber: number) => `${API_BASE_URL}/zones/${zoneNumber}`,

  // Analytics endpoints
  analyticsOverview: `${API_BASE_URL}/analytics/overview`,
  analyticsDesigners: `${API_BASE_URL}/analytics/designers`,
  analyticsTopProducts: `${API_BASE_URL}/analytics/products/top`,
  analyticsRevenueTrend: `${API_BASE_URL}/analytics/revenue-trend`,
  analyticsOrdersTrend: `${API_BASE_URL}/analytics/orders-trend`,
  analyticsNurseryOverview: (nurseryId: string) => `${API_BASE_URL}/analytics/nursery/${nurseryId}/overview`,

  // Employee endpoints
  employees: `${API_BASE_URL}/employees/employees`,
  employeeById: (id: string) => `${API_BASE_URL}/employees/employees/${id}`,
  employeeCreate: `${API_BASE_URL}/employees/create`,

  // Planning endpoints
  planning: `${API_BASE_URL}/planning/`,
  planningById: (id: string) => `${API_BASE_URL}/planning/${id}`,
  planningLabor: (id: string) => `${API_BASE_URL}/planning/${id}/labor`,
  planningLaborBulk: (id: string) => `${API_BASE_URL}/planning/${id}/labor/bulk`,
  planningLaborById: (planId: string, laborId: string) => `${API_BASE_URL}/planning/${planId}/labor/${laborId}`,
  planningCosts: (id: string) => `${API_BASE_URL}/planning/${id}/costs`,
  planningCostById: (planId: string, costId: string) => `${API_BASE_URL}/planning/${planId}/costs/${costId}`,
  planningWorkOrderSubmit: (workOrderId: string) => `${API_BASE_URL}/planning/work-order/${workOrderId}/submit`,
  planningWorkOrderApprove: (workOrderId: string) => `${API_BASE_URL}/planning/work-order/${workOrderId}/approve`,

  // Event endpoints
  events: `${API_BASE_URL}/events`,
  eventsAll: `${API_BASE_URL}/events/all`,
  eventById: (id: string) => `${API_BASE_URL}/events/${id}`,
  eventCreate: `${API_BASE_URL}/events/create`,
  eventUpdate: (id: string) => `${API_BASE_URL}/events/${id}`,
  eventDelete: (id: string) => `${API_BASE_URL}/events/${id}`,

  // Notification endpoints
  notifications: `${API_BASE_URL}/notifications`,
  notificationsUnreadCount: `${API_BASE_URL}/notifications/unread-count`,
  lowStockNotifications: `${API_BASE_URL}/notifications/low-stock`,
  notificationMarkRead: (id: string) => `${API_BASE_URL}/notifications/${id}/read`,

  // Scan endpoints
  recordScan: `${API_BASE_URL}/employees/scan`,
  scanLogsForOrder: (orderId: string) => `${API_BASE_URL}/employees/scans?order_id=${orderId}`,
}

// Helper function for API calls with authentication
export async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('access_token')

  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    const message = error.detail || `HTTP error! status: ${response.status}`

    if (response.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('user_role')
      localStorage.removeItem('user_id')
    }

    throw new ApiError(message, response.status)
  }

  return response.json()
}

// Auth helper functions
export const auth = {
  login: async (username: string, password: string) => {
    const response = await apiCall<{
      access_token: string
      role: string
      user_id: string
    }>(API_ENDPOINTS.login, {
      method: 'POST',
      body: JSON.stringify({
        user_username: username,
        user_password: password,
      }),
    })

    // Store token in localStorage
    localStorage.setItem('access_token', response.access_token)
    localStorage.setItem('user_role', response.role)
    localStorage.setItem('user_id', response.user_id)

    return response
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user_role')
    localStorage.removeItem('user_id')
  },

  getMe: async () => {
    return apiCall<{
      user_id: string
      user_username: string
      role: string
      created_at: string
    }>(API_ENDPOINTS.me)
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('access_token')
  },

  getRole: () => {
    return localStorage.getItem('user_role')
  },
}

// Product API functions
export const products = {
  getAll: async (params?: {
    page?: number
    page_size?: number
    search?: string
    nursery_ids?: string[]
    sections?: string[]
    live_only?: boolean
  }) => {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.page_size) query.set('page_size', String(params.page_size))
    if (params?.search?.trim()) query.set('search', params.search.trim())
    for (const nurseryId of params?.nursery_ids || []) query.append('nursery_ids', nurseryId)
    for (const section of params?.sections || []) query.append('sections', section)
    if (params?.live_only === false) query.set('live_only', 'false')
    const endpoint = query.toString() ? `${API_ENDPOINTS.productsAll}?${query.toString()}` : API_ENDPOINTS.productsAll

    const result = await apiCall<PaginatedResponse<{
      product_id: string
      nursery_id: string
      item_name: string
      section: string
      zones: number
      subzone?: string | null
      size: string
      height_feet: string
      caliper_inches: string
      gallons?: string | null
      inventory_quantity: number
      ordered_quantity: number
      base_price_per_unit: string
      rate_percentage: string
      image_url?: string | null
    }>>(endpoint)

    if (typeof window !== 'undefined') {
      console.log('[ERP fetch] GET /products/all', {
        request: params ?? {},
        url: endpoint,
        itemsReceived: result.items?.length ?? 0,
        total: result.total,
        page: result.page,
        page_size: result.page_size,
        total_pages: result.total_pages,
      })
    }

    return result
  },

  getById: async (id: string) => {
    return apiCall<{
      product_id: string
      nursery_id: string
      item_name: string
      section: string
      zones: number
      subzone?: string | null
      size: string
      height_feet: string
      caliper_inches: string
      gallons?: string | null
      inventory_quantity: number
      ordered_quantity: number
      base_price_per_unit: string
      rate_percentage: string
      image_url?: string | null
    }>(API_ENDPOINTS.productById(id))
  },

  getByBarcode: async (barcode: string) => {
    const query = new URLSearchParams({ barcode })
    return apiCall<{
      product_id: string
      nursery_id: string
      item_name: string
      section: string
      zones: number
      subzone?: string | null
      size: string
      height_feet: string
      caliper_inches: string
      gallons?: string | null
      inventory_quantity: number
      ordered_quantity: number
      base_price_per_unit: string
      rate_percentage: string
      image_url?: string | null
    }>(`${API_ENDPOINTS.productLookupByBarcode}?${query.toString()}`)
  },

  create: async (data: {
    nursery_id: string
    item_name: string
    section: string
    zones: number
    subzone?: string | null
    size?: string
    height_feet?: string
    caliper_inches?: string
    gallons?: string | null
    inventory_quantity: number
    ordered_quantity?: number
    base_price_per_unit: number
    rate_percentage?: number
    image_url?: string | null
  }) => {
    return apiCall<{
      product_id: string
      message: string
    }>(API_ENDPOINTS.productAdd, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update: async (id: string, data: {
    nursery_id: string
    item_name: string
    section: string
    zones: number
    subzone?: string | null
    size?: string
    height_feet?: string
    caliper_inches?: string
    gallons?: string | null
    inventory_quantity: number
    low_stock_threshold?: number
    base_price_per_unit: number
    rate_percentage?: number
    image_url?: string | null
  }) => {
    return apiCall<{
      product_id: string
      message: string
    }>(API_ENDPOINTS.productUpdate(id), {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  delete: async (id: string) => {
    return apiCall<{
      product_id: string
      message: string
    }>(API_ENDPOINTS.productDelete(id), {
      method: 'DELETE',
    })
  },

  submitForReview: async (data: {
    nursery_id: string
    item_name: string
    section: string
    zones: number
    subzone?: string | null
    size?: string
    height_feet?: string
    caliper_inches?: string
    gallons?: string | null
    inventory_quantity: number
    image_url?: string | null
  }) => {
    return apiCall<{
      submission_id: string
      message: string
    }>(API_ENDPOINTS.productSubmit, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  getPendingSubmissions: async (params?: {
    page?: number
    page_size?: number
    search?: string
  }) => {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.page_size) query.set('page_size', String(params.page_size))
    if (params?.search?.trim()) query.set('search', params.search.trim())
    const endpoint = query.toString() ? `${API_ENDPOINTS.productSubmissionPending}?${query.toString()}` : API_ENDPOINTS.productSubmissionPending
    return apiCall<PaginatedResponse<{
      submission_id: string
      employee_id: string
      employee_username: string
      nursery_id: string
      item_name: string
      section: string
      zones: number
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
    }>>(endpoint)
  },

  getPendingBarcodeSubmissions: async (params?: {
    page?: number
    page_size?: number
    search?: string
    nursery_ids?: string[]
    sections?: string[]
  }) => {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.page_size) query.set('page_size', String(params.page_size))
    if (params?.search?.trim()) query.set('search', params.search.trim())
    for (const nurseryId of params?.nursery_ids || []) query.append('nursery_ids', nurseryId)
    for (const section of params?.sections || []) query.append('sections', section)
    const endpoint = query.toString()
      ? `${API_ENDPOINTS.productSubmissionPendingBarcode}?${query.toString()}`
      : API_ENDPOINTS.productSubmissionPendingBarcode
    return apiCall<PaginatedResponse<{
      submission_id: string
      employee_id: string
      employee_username: string
      nursery_id: string
      item_name: string
      section: string
      zones: number
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
    }>>(endpoint)
  },

  getSubmissionById: async (id: string) => {
    return apiCall<{
      submission_id: string
      employee_id: string
      employee_username: string
      nursery_id: string
      item_name: string
      section: string
      zones: number
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
    }>(API_ENDPOINTS.productSubmissionById(id))
  },

  approveSubmission: async (submissionId: string, data: {
    base_price_per_unit: number
    rate_percentage: number
    item_name?: string
  }) => {
    return apiCall<{
      submission_id: string
      product_id: string
      message: string
    }>(API_ENDPOINTS.productSubmissionApprove(submissionId), {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  getMySubmissions: async (params?: {
    page?: number
    page_size?: number
    search?: string
    status?: 'all' | 'pending' | 'approved'
  }) => {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.page_size) query.set('page_size', String(params.page_size))
    if (params?.search?.trim()) query.set('search', params.search.trim())
    if (params?.status?.trim() && params.status !== 'all') query.set('status', params.status.trim())
    const endpoint = query.toString() ? `${API_ENDPOINTS.productSubmissionMine}?${query.toString()}` : API_ENDPOINTS.productSubmissionMine

    return apiCall<PaginatedResponse<{
      submission_id: string
      employee_id: string
      employee_username: string
      nursery_id: string
      item_name: string
      section: string
      zones: number
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
    }>>(endpoint)
  },

  updateSubmissionBarcodeStatus: async (
    submissionId: string,
    barcode_status: 'PENDING_NURSERY_PRINT' | 'PRINTED_BY_ADMIN' | 'PRINTED_BY_NURSERY'
  ) => {
    return apiCall<{
      submission_id: string
      barcode_status: string
      message: string
    }>(API_ENDPOINTS.productSubmissionBarcodeStatus(submissionId), {
      method: 'PATCH',
      body: JSON.stringify({ barcode_status }),
    })
  },

  addStock: async (productId: string, quantity: number) => {
    return apiCall<{
      product_id: string
      added_quantity: number
      inventory_quantity: number
      message: string
    }>(API_ENDPOINTS.productAddStock(productId), {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    })
  },
}

// Zone API functions
export const zones = {
  getAll: async () => {
    return apiCall<Array<{
      zone_number: number
      subzone_count: number
      subzones: Array<{ code: string; label: string }>
    }>>(API_ENDPOINTS.zones)
  },

  create: async (data: { zone_number: number; subzone_count: number }) => {
    return apiCall<{
      zone_number: number
      subzone_count: number
      subzones: Array<{ code: string; label: string }>
    }>(API_ENDPOINTS.zones, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update: async (zoneNumber: number, data: { zone_number: number; subzone_count: number }) => {
    return apiCall<{
      zone_number: number
      subzone_count: number
      subzones: Array<{ code: string; label: string }>
    }>(API_ENDPOINTS.zoneByNumber(zoneNumber), {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  delete: async (zoneNumber: number) => {
    return apiCall<{
      zone_number: number
      message: string
    }>(API_ENDPOINTS.zoneByNumber(zoneNumber), {
      method: 'DELETE',
    })
  },
}

// Order API functions
export const orders = {
  getSummary: async (params?: {
    search?: string
    scannable_only?: boolean
  }) => {
    const query = new URLSearchParams()
    if (params?.search?.trim()) query.set('search', params.search.trim())
    if (params?.scannable_only) query.set('scannable_only', 'true')
    const endpoint = query.toString()
      ? `${API_ENDPOINTS.ordersSummary}?${query.toString()}`
      : API_ENDPOINTS.ordersSummary

    return apiCall<{
      total: number
      created: number
      in_progress: number
      completed: number
    }>(endpoint)
  },

  getAll: async (params?: {
    page?: number
    page_size?: number
    search?: string
    status?: string
  }) => {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.page_size) query.set('page_size', String(params.page_size))
    if (params?.search?.trim()) query.set('search', params.search.trim())
    if (params?.status?.trim() && params.status !== 'all') query.set('status', params.status.trim())
    const endpoint = query.toString() ? `${API_ENDPOINTS.ordersAll}?${query.toString()}` : API_ENDPOINTS.ordersAll

    const result = await apiCall<PaginatedResponse<{
      order_id: string
      user_id: string
      client_name: string
      work_order_type: 'MAINTENANCE' | 'INSTALL'
      designer_name?: string | null
      status: string
      total_order_amount: string
      ordered_at: string
      updated_at: string
      invoice_generated_at?: string | null
      paid_at?: string | null
      items_count: number
    }>>(endpoint)

    if (typeof window !== 'undefined') {
      console.log('[ERP fetch] GET /orders/all', {
        request: params ?? {},
        url: endpoint,
        itemsReceived: result.items?.length ?? 0,
        total: result.total,
        page: result.page,
        page_size: result.page_size,
        total_pages: result.total_pages,
      })
    }

    return result
  },

  getPaid: async (params?: {
    page?: number
    page_size?: number
    search?: string
    status?: string
  }) => {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.page_size) query.set('page_size', String(params.page_size))
    if (params?.search?.trim()) query.set('search', params.search.trim())
    if (params?.status?.trim() && params.status !== 'all') query.set('status', params.status.trim())
    const endpoint = query.toString() ? `${API_ENDPOINTS.ordersPaid}?${query.toString()}` : API_ENDPOINTS.ordersPaid

    const result = await apiCall<PaginatedResponse<{
      order_id: string
      user_id: string
      client_name: string
      work_order_type: 'MAINTENANCE' | 'INSTALL'
      designer_name?: string | null
      status: string
      total_order_amount: string
      ordered_at: string
      updated_at: string
      invoice_generated_at?: string | null
      paid_at?: string | null
      items_count: number
    }>>(endpoint)

    if (typeof window !== 'undefined') {
      console.log('[ERP fetch] GET /orders/paid', {
        request: params ?? {},
        url: endpoint,
        itemsReceived: result.items?.length ?? 0,
        total: result.total,
        page: result.page,
        page_size: result.page_size,
        total_pages: result.total_pages,
      })
    }

    return result
  },

  getById: async (id: string) => {
    return apiCall<{
      order_id: string
      user_id: string
      client_name: string
      work_order_type: 'MAINTENANCE' | 'INSTALL'
      designer_name?: string | null
      status: string
      total_order_amount: string
      ordered_at: string
      updated_at: string
      invoice_generated_at?: string | null
      paid_at?: string | null
      items: Array<{
        product_id: string
        quantity: number
        unit_price: string
        rate_percentage: string | null
        total_price: string
      }>
    }>(API_ENDPOINTS.orderById(id))
  },

  create: async (data: {
    user_id: string
    client_name: string
    work_order_type?: 'MAINTENANCE' | 'INSTALL'
    designer_name: 'Alex' | 'Jordan' | 'Taylor'
  }) => {
    return apiCall<{
      order_id: string
      status: string
      message: string
    }>(API_ENDPOINTS.orderCreate, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  addProduct: async (orderId: string, data: {
    product_id: string
    quantity: number
    unit_price: number
    rate_percentage?: number
  }) => {
    return apiCall<{
      order_id: string
      product_id: string
      quantity: number
      line_total: string
      order_total: string
      message: string
    }>(API_ENDPOINTS.orderAddProduct(orderId), {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  removeProduct: async (orderId: string, data: {
    product_id: string
    quantity?: number
  }) => {
    return apiCall<{
      order_id: string
      product_id: string
      order_total: string
      message: string
    }>(API_ENDPOINTS.orderRemoveProduct(orderId), {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateStatus: async (orderId: string, status?: string) => {
    void status
    return apiCall<{
      order_id: string
      old_status?: string
      new_status?: string
      status?: string
      message: string
    }>(API_ENDPOINTS.orderStatus(orderId), {
      method: 'PATCH',
    })
  },

  generateInvoice: async (orderId: string) => {
    return apiCall<{
      message: string
      order_id: string
      invoice_generated_at: string
    }>(`${API_BASE_URL}/orders/${orderId}/generate-invoice`, {
      method: 'POST',
    })
  },

  markPaid: async (orderId: string) => {
    return apiCall<{
      message: string
      order_id: string
      paid_at: string
      status: string
    }>(`${API_BASE_URL}/orders/${orderId}/mark-paid`, {
      method: 'POST',
    })
  },

  updateDetails: async (
    orderId: string,
    data: {
      client_name?: string
      work_order_type?: 'MAINTENANCE' | 'INSTALL'
      designer_name?: 'Alex' | 'Jordan' | 'Taylor'
    }
  ) => {
    return apiCall<{
      message: string
      order_id: string
      client_name: string
      work_order_type: string
      designer_name?: string | null
      status: string
      updated_at: string
    }>(API_ENDPOINTS.orderUpdate(orderId), {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  approve: async (orderId: string) => {
    return apiCall<{
      message: string
      order_id: string
      status: string
      updated_at: string
    }>(API_ENDPOINTS.orderApprove(orderId), {
      method: 'PATCH',
    })
  },
}

// Nursery API functions
type NurserySummary = {
  nursery_id: string
  nursery_name: string
  contact_email?: string | null
  contact_phone?: string | null
  products_count?: number
  total_inventory?: number
  total_ordered_quantity?: number
  featured_products?: string[]
}

export const nurseries = {
  list: async (params?: {
    page?: number
    page_size?: number
    search?: string
  }) => {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.page_size) query.set('page_size', String(params.page_size))
    if (params?.search?.trim()) query.set('search', params.search.trim())
    const endpoint = query.toString()
      ? `${API_ENDPOINTS.nurseryAll}?${query.toString()}`
      : API_ENDPOINTS.nurseryAll

    return apiCall<PaginatedResponse<NurserySummary>>(endpoint)
  },

  getSummary: async (params?: { search?: string }) => {
    const query = new URLSearchParams()
    if (params?.search?.trim()) query.set('search', params.search.trim())
    const endpoint = query.toString()
      ? `${API_ENDPOINTS.nurserySummary}?${query.toString()}`
      : API_ENDPOINTS.nurserySummary

    return apiCall<{
      total_vendors: number
      total_products: number
      total_inventory: number
      total_ordered_quantity: number
    }>(endpoint)
  },

  getAll: async () => {
    const firstPage = await nurseries.list({ page: 1, page_size: 100 })
    let allItems = [...firstPage.items]
    for (let page = 2; page <= firstPage.total_pages; page += 1) {
      const nextPage = await nurseries.list({ page, page_size: 100 })
      allItems = allItems.concat(nextPage.items)
    }
    return allItems
  },

  getById: async (id: string) => {
    return apiCall<{
      nursery_id: string
      nursery_name: string
      contact_email?: string | null
      contact_phone?: string | null
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
    }>(API_ENDPOINTS.nurseryById(id))
  },

  create: async (data: {
    nursery_name: string
    contact_email?: string | null
    contact_phone?: string | null
    notes?: string | null
  }) => {
    return apiCall<{
      nursery_id: string
      message: string
    }>(API_ENDPOINTS.nurseryAdd, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update: async (
    id: string,
    data: {
      nursery_name?: string
      contact_email?: string | null
      contact_phone?: string | null
      notes?: string | null
    }
  ) => {
    return apiCall<{
      nursery_id: string
      message: string
    }>(API_ENDPOINTS.nurseryById(id), {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  delete: async (id: string) => {
    return apiCall<{
      nursery_id: string
      message: string
    }>(API_ENDPOINTS.nurseryById(id), {
      method: 'DELETE',
    })
  },
}

// Analytics API functions
export const analytics = {
  getOverview: async () => {
    return apiCall<{
      total_revenue: string
      total_orders: number
      total_products: number
      active_employees: number
      orders_by_status: Record<string, number>
      revenue_growth: number
      orders_growth: number
    }>(API_ENDPOINTS.analyticsOverview)
  },

  getDesigners: async () => {
    return apiCall<Array<{
      user_id: string
      username: string
      orders: number
      revenue: string
      avg_order_value: string
    }>>(API_ENDPOINTS.analyticsDesigners)
  },

  getTopProducts: async (limit: number = 10) => {
    return apiCall<Array<{
      product_id: string
      name: string
      sold: number
      revenue: string
    }>>(`${API_ENDPOINTS.analyticsTopProducts}?limit=${limit}`)
  },

  getRevenueTrend: async (days: number = 30) => {
    return apiCall<Array<{
      date: string
      revenue: number
    }>>(`${API_ENDPOINTS.analyticsRevenueTrend}?days=${days}`)
  },

  getOrdersTrend: async (days: number = 30) => {
    return apiCall<Array<{
      date: string
      orders: number
    }>>(`${API_ENDPOINTS.analyticsOrdersTrend}?days=${days}`)
  },

  getNurseryOverview: async (nurseryId: string) => {
    return apiCall<{
      nursery_id: string
      nursery_name: string
      products_count: number
      total_inventory: number
      total_ordered_quantity: number
      top_products: Array<{
        product_id: string
        item_name: string
        inventory_quantity: number
        ordered_quantity: number
      }>
    }>(API_ENDPOINTS.analyticsNurseryOverview(nurseryId))
  },
}
// Employee API functions
export const employees = {
  getAll: async (params?: {
    page?: number
    page_size?: number
    search?: string
    status?: 'all' | 'active' | 'inactive'
  }) => {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.page_size) query.set('page_size', String(params.page_size))
    if (params?.search?.trim()) query.set('search', params.search.trim())
    if (params?.status?.trim() && params.status !== 'all') query.set('status', params.status.trim())
    const endpoint = query.toString() ? `${API_ENDPOINTS.employees}?${query.toString()}` : API_ENDPOINTS.employees
    return apiCall<PaginatedResponse<{
      employee_id: string
      username: string
      role: string
      created_at: string
      items_scanned: number
      orders_completed: number
      status: string
    }>>(endpoint)
  },

  getById: async (id: string) => {
    return apiCall<{
      employee_id: string
      username: string
      role: string
      created_at: string
      items_scanned: number
      orders_completed: number
      inventory_updated: number
      products_added_count: number
      status: string
      scanned_products: Array<{
        product_id: string
        item_name: string
        size: string
        height_feet: string
        caliper_inches: string
        total_scanned: number
        last_scanned_at: string
      }>
      scanned_orders: Array<{
        order_id: string
        client_name: string
        status: string
        scan_events: number
        total_scanned: number
        last_scanned_at: string
      }>
      inventory_updates: Array<{
        notification_id: string
        product_id: string
        item_name?: string | null
        size?: string | null
        height_feet?: string | null
        caliper_inches?: string | null
        title: string
        message: string
        created_at: string
      }>
      recent_scans: Array<{
        scan_id: string
        order_id: string
        product_id: string
        scanned_quantity: number
        scanned_at: string
      }>
    }>(API_ENDPOINTS.employeeById(id))
  },

  create: async (data: { username: string; password: string; role?: 'employee' | 'nursery' | 'head_installation' | 'head_maintenance'; hourly_rate?: number; hourly_rate_multiplier?: number }) => {
    return apiCall<{
      employee_id: string
      username: string
      role: string
      message: string
    }>(API_ENDPOINTS.employeeCreate, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update: async (id: string, data: { hourly_rate?: number; hourly_rate_multiplier?: number; role?: string }) => {
    return apiCall<{
      employee_id: string
      hourly_rate: string
      hourly_rate_multiplier: string
      role: string
      message: string
    }>(`${API_BASE_URL}/employees/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },
}

// Scan API functions
export const scans = {
  record: async (data: {
    order_id: string
    product_id: string
    quantity_scanned: number
  }) => {
    return apiCall<{
      scan_id: string
      product_id: string
      requested_quantity: number
      quantity_scanned: number
      new_inventory_quantity: number
      remaining_order_quantity: number
      shortage_to_stock: number
      message: string
    }>(API_ENDPOINTS.recordScan, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  getForOrder: async (orderId: string) => {
    return apiCall<{
      order_id: string
      scanned_quantities: Record<string, number>
    }>(API_ENDPOINTS.scanLogsForOrder(orderId))
  },
}


export type PlanningJobType = 'MAINTENANCE' | 'INSTALL'
export type PlanningJobStatus = 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'COMPLETED'
export type PlanningCostType = 'EQUIPMENT' | 'GREEN_GOODS' | 'HARD_GOODS'

export interface PlanningTotals {
  planned_hours: string
  actual_hours: string
  planned_labor_total: string
  actual_labor_total: string
  planned_cost_total: string
  actual_cost_total: string
  planned_grand_total: string
  actual_grand_total: string
}

export interface PlanningLaborEntry {
  labor_entry_id: string
  plan_id: string
  employee_id: string
  employee_username?: string | null
  category: string
  planned_hours: string
  actual_hours: string
  hourly_rate: string
  planned_labor_total: string
  actual_labor_total: string
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface PlanningCostEntry {
  cost_entry_id: string
  plan_id: string
  cost_type: PlanningCostType
  description: string
  quantity: string
  hours?: string | null
  unit_cost: string
  supplier?: string | null
  planned_total: string
  actual_total: string
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface PlanningJob {
  plan_id: string
  plan_type: PlanningJobType
  status: PlanningJobStatus
  job_name: string
  location?: string | null
  work_order_id?: string | null
  client_name?: string | null
  event_id?: string | null
  job_date: string
  time_in?: string | null
  time_out?: string | null
  prepared_by?: string | null
  billable: boolean
  notes?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
  totals: PlanningTotals
  labor_entries: PlanningLaborEntry[]
  cost_entries: PlanningCostEntry[]
}

export const planningCategories = {
  MAINTENANCE: [
    'fall_spring_cleanup',
    'bark',
    'pruning',
    'weeding_plant_care',
    'planting',
    'fertilization',
    'mowing',
    'spraying',
    'waterfall_maintenance',
    'irrigation_watering',
    'replace_misc',
    'load_unload',
    'travel_time',
  ],
  INSTALL: [
    'site_grading',
    'drain_tile',
    'boulder_install',
    'edging_install',
    'bed_prep',
    'plant_install',
    'tree_install',
    'stone_weed_barrier',
    'bark_mulch',
    'blue_stone_brick',
    'lawn_prep',
    'waterfall_install',
    'watering',
    'cleanup',
    'pickup_material',
    'lighting',
    'replace_misc',
    'travel_time',
    'load_unload',
  ],
} as const

export function formatPlanningCategory(category: string) {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
// Event API functions
export const events = {
  getAll: async () => {
    return apiCall<Array<{
      event_id: string
      event_name: string
      event_date: string
      event_time: string
      created_by: string
      created_at: string
      updated_at: string
    }>>(API_ENDPOINTS.eventsAll)
  },

  getById: async (id: string) => {
    return apiCall<{
      event_id: string
      event_name: string
      event_date: string
      event_time: string
      created_by: string
      created_at: string
      updated_at: string
    }>(API_ENDPOINTS.eventById(id))
  },

  create: async (data: { event_name: string; event_date: string; event_time: string }) => {
    return apiCall<{
      event_id: string
      event_name: string
      event_date: string
      event_time: string
      created_by: string
      created_at: string
      updated_at: string
    }>(API_ENDPOINTS.eventCreate, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update: async (id: string, data: Partial<{ event_name: string; event_date: string; event_time: string }>) => {
    return apiCall<{
      event_id: string
      event_name: string
      event_date: string
      event_time: string
      created_by: string
      created_at: string
      updated_at: string
    }>(API_ENDPOINTS.eventUpdate(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  delete: async (id: string) => {
    return apiCall<{ message: string }>(API_ENDPOINTS.eventDelete(id), {
      method: 'DELETE',
    })
  },
}

export const notifications = {
  getAll: async (params?: {
    page?: number
    page_size?: number
    is_read?: boolean
    reference_id?: string
    types?: string[]
  }) => {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.page_size) query.set('page_size', String(params.page_size))
    if (typeof params?.is_read === 'boolean') query.set('is_read', String(params.is_read))
    if (params?.reference_id?.trim()) query.set('reference_id', params.reference_id.trim())
    for (const type of params?.types || []) query.append('types', type)
    const endpoint = query.toString() ? `${API_ENDPOINTS.notifications}?${query.toString()}` : API_ENDPOINTS.notifications
    return apiCall<PaginatedResponse<{
      notification_id: string
      type: string
      title: string
      message: string
      actor_user_id?: string | null
      reference_id?: string | null
      is_read: boolean
      created_at: string
    }>>(endpoint)
  },

  getUnreadCount: async () => {
    return apiCall<{ unread_count: number }>(API_ENDPOINTS.notificationsUnreadCount)
  },

  getLowStock: async () => {
    return apiCall<Array<{
      product_id: string
      item_name: string
      size: string
      height_feet: string
      caliper_inches: string
      current_stock: number
      threshold: number
      nursery_id: string
      created_at: string
    }>>(API_ENDPOINTS.lowStockNotifications)
  },
}

// Product Notes API functions
export const productNotes = {
  getByProductId: async (productId: string) => {
    return apiCall<Array<{
      note_id: string
      product_id: string
      admin_id: string | null
      admin_name: string | null
      note_text: string
      created_at: string
      updated_at: string
    }>>(`${API_BASE_URL}/products/${productId}/notes`)
  },

  create: async (productId: string, noteText: string) => {
    return apiCall<{
      note_id: string
      product_id: string
      admin_id: string | null
      note_text: string
      created_at: string
      updated_at: string
    }>(`${API_BASE_URL}/products/${productId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note_text: noteText }),
    })
  },

  update: async (productId: string, noteId: string, noteText: string) => {
    return apiCall<{
      note_id: string
      product_id: string
      admin_id: string | null
      note_text: string
      created_at: string
      updated_at: string
    }>(`${API_BASE_URL}/products/${productId}/notes/${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify({ note_text: noteText }),
    })
  },

  delete: async (productId: string, noteId: string) => {
    return apiCall<{
      message: string
    }>(`${API_BASE_URL}/products/${productId}/notes/${noteId}`, {
      method: 'DELETE',
    })
  },
}
export const planning = {
  getAll: async (params?: {
    page?: number
    page_size?: number
    plan_type?: PlanningJobType | 'all'
    status?: PlanningJobStatus | 'all'
    search?: string
    date_from?: string
    date_to?: string
    work_order_id?: string
  }) => {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.page_size) query.set('page_size', String(params.page_size))
    if (params?.plan_type && params.plan_type !== 'all') query.set('plan_type', params.plan_type)
    if (params?.status && params.status !== 'all') query.set('status', params.status)
    if (params?.search?.trim()) query.set('search', params.search.trim())
    if (params?.date_from) query.set('date_from', params.date_from)
    if (params?.date_to) query.set('date_to', params.date_to)
    if (params?.work_order_id) query.set('work_order_id', params.work_order_id)
    const endpoint = query.toString() ? `${API_ENDPOINTS.planning}?${query.toString()}` : API_ENDPOINTS.planning
    return apiCall<PaginatedResponse<PlanningJob>>(endpoint)
  },

  getById: async (id: string) => {
    return apiCall<PlanningJob>(API_ENDPOINTS.planningById(id))
  },

  create: async (data: {
    plan_type: PlanningJobType
    job_name: string
    location?: string | null
    work_order_id?: string | null
    event_id?: string | null
    job_date: string
    time_in?: string | null
    time_out?: string | null
    prepared_by?: string | null
    billable: boolean
    create_calendar_event?: boolean
    notes?: string | null
  }) => {
    return apiCall<PlanningJob>(API_ENDPOINTS.planning, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update: async (id: string, data: Partial<{
    plan_type: PlanningJobType
    status: PlanningJobStatus
    job_name: string
    location: string | null
    work_order_id: string | null
    event_id: string | null
    job_date: string
    time_in: string | null
    time_out: string | null
    prepared_by: string | null
    billable: boolean
    notes: string | null
  }>) => {
    return apiCall<PlanningJob>(API_ENDPOINTS.planningById(id), {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  delete: async (id: string) => {
    return apiCall<{ message: string; plan_id: string }>(API_ENDPOINTS.planningById(id), {
      method: 'DELETE',
    })
  },

  addLabor: async (planId: string, data: {
    employee_id: string
    category: string
    planned_hours: number
    actual_hours: number
    hourly_rate?: number
    notes?: string | null
  }) => {
    return apiCall<PlanningLaborEntry>(API_ENDPOINTS.planningLabor(planId), {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateLabor: async (planId: string, laborId: string, data: Partial<{
    employee_id: string
    category: string
    planned_hours: number
    actual_hours: number
    hourly_rate: number
    notes: string | null
  }>) => {
    return apiCall<PlanningLaborEntry>(API_ENDPOINTS.planningLaborById(planId, laborId), {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  deleteLabor: async (planId: string, laborId: string) => {
    return apiCall<{ message: string; labor_entry_id: string }>(API_ENDPOINTS.planningLaborById(planId, laborId), {
      method: 'DELETE',
    })
  },

  saveBulkLabor: async (planId: string, data: {
    employee_id: string
    entries: {
      labor_entry_id?: string
      category: string
      planned_hours: number
      actual_hours: number
      notes?: string | null
    }[]
  }) => {
    return apiCall<PlanningLaborEntry[]>(API_ENDPOINTS.planningLaborBulk(planId), {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },


  addCost: async (planId: string, data: {
    cost_type: PlanningCostType
    description: string
    quantity: number
    hours?: number | null
    unit_cost: number
    supplier?: string | null
    planned_total?: number | null
    actual_total?: number | null
    notes?: string | null
  }) => {
    return apiCall<PlanningCostEntry>(API_ENDPOINTS.planningCosts(planId), {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateCost: async (planId: string, costId: string, data: Partial<{
    cost_type: PlanningCostType
    description: string
    quantity: number
    hours: number | null
    unit_cost: number
    supplier: string | null
    planned_total: number | null
    actual_total: number | null
    notes: string | null
  }>) => {
    return apiCall<PlanningCostEntry>(API_ENDPOINTS.planningCostById(planId, costId), {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  deleteCost: async (planId: string, costId: string) => {
    return apiCall<{ message: string; cost_entry_id: string }>(API_ENDPOINTS.planningCostById(planId, costId), {
      method: 'DELETE',
    })
  },

  submitByWorkOrder: async (workOrderId: string) => {
    return apiCall<{ message: string; work_order_id: string; submitted_count: number }>(
      API_ENDPOINTS.planningWorkOrderSubmit(workOrderId),
      { method: 'POST' },
    )
  },

  approveByWorkOrder: async (workOrderId: string) => {
    return apiCall<{ message: string; work_order_id: string; approved_count: number }>(
      API_ENDPOINTS.planningWorkOrderApprove(workOrderId),
      { method: 'POST' },
    )
  },
}
