import { NextRequest, NextResponse } from 'next/server'

// Mock scan logs database
const scanLogs: Record<string, unknown>[] = []

// Mock function to update inventory
function updateInventory(productId: string, quantity: number) {
  // In a real app, this would update the database
  return {
    success: true,
    newInventoryQuantity: Math.max(0, 100 - quantity), // Mock calculation
    newOrderedQuantity: Math.max(0, 50 - quantity) // Mock calculation
  }
}

// POST /api/scan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      employee_id,
      order_id,
      product_id,
      barcode,
      scanned_quantity
    } = body

    // Validation
    if (!employee_id || !order_id || !product_id || !scanned_quantity) {
      return NextResponse.json(
        { error: 'Missing required scan data' },
        { status: 400 }
      )
    }

    if (scanned_quantity <= 0) {
      return NextResponse.json(
        { error: 'Scanned quantity must be positive' },
        { status: 400 }
      )
    }

    // Check if order is paid and accessible to employee
    // TODO: Implement proper order validation

    // Update inventory
    const inventoryUpdate = updateInventory(product_id, scanned_quantity)
    
    if (!inventoryUpdate.success) {
      return NextResponse.json(
        { error: 'Failed to update inventory' },
        { status: 400 }
      )
    }

    // Create scan log entry
    const scanLog = {
      scan_id: `SCN-${Date.now()}`,
      employee_id,
      order_id,
      product_id,
      scanned_quantity: Number(scanned_quantity),
      scanned_at: new Date(),
      barcode: barcode || null
    }

    scanLogs.push(scanLog)

    return NextResponse.json({
      scanLog,
      inventoryUpdate: {
        newInventoryQuantity: inventoryUpdate.newInventoryQuantity,
        newOrderedQuantity: inventoryUpdate.newOrderedQuantity
      },
      message: 'Product scanned successfully'
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process scan' },
      { status: 500 }
    )
  }
}

// GET /api/scan?order_id=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('order_id')
    const employeeId = searchParams.get('employee_id')

    let filteredLogs = scanLogs

    if (orderId) {
      filteredLogs = filteredLogs.filter(log => log.order_id === orderId)
    }

    if (employeeId) {
      filteredLogs = filteredLogs.filter(log => log.employee_id === employeeId)
    }

    return NextResponse.json({
      scanLogs: filteredLogs,
      total: filteredLogs.length
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch scan logs' },
      { status: 500 }
    )
  }
}