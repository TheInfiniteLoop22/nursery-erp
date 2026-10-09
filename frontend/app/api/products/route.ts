import { NextRequest, NextResponse } from 'next/server'
import { generateBarcode } from '@/app/lib/utils'

// Mock products database
const products = [
  {
    product_id: 'PRD-001',
    nursery_id: 'NUR-001',
    item_name: 'Japanese Maple',
    size: 'Small (3-4 ft)',
    inventory_quantity: 45,
    ordered_quantity: 12,
    base_price_per_unit: 89.99,
    rate_percentage: 25,
    image_url: null,
    created_at: new Date('2024-01-01'),
  },
  {
    product_id: 'PRD-002',
    nursery_id: 'NUR-001',
    item_name: 'Blue Spruce',
    size: 'Large (8-10 ft)',
    inventory_quantity: 8,
    ordered_quantity: 3,
    base_price_per_unit: 199.99,
    rate_percentage: 30,
    image_url: null,
    created_at: new Date('2024-01-01'),
  },
  {
    product_id: 'PRD-003',
    nursery_id: 'NUR-002',
    item_name: 'Rose Bush',
    size: 'Medium (2-3 ft)',
    inventory_quantity: 67,
    ordered_quantity: 23,
    base_price_per_unit: 34.99,
    rate_percentage: 20,
    image_url: null,
    created_at: new Date('2024-01-01'),
  },
]

// GET /api/products
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const nursery = searchParams.get('nursery')

    let filteredProducts = products

    if (search) {
      filteredProducts = filteredProducts.filter(product =>
        product.item_name.toLowerCase().includes(search.toLowerCase()) ||
        product.size.toLowerCase().includes(search.toLowerCase())
      )
    }

    if (nursery && nursery !== 'all') {
      filteredProducts = filteredProducts.filter(product =>
        product.nursery_id === nursery
      )
    }

    return NextResponse.json({
      products: filteredProducts,
      total: filteredProducts.length
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

// POST /api/products
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      item_name,
      size,
      inventory_quantity,
      base_price_per_unit,
      rate_percentage,
      nursery_id,
      image_url
    } = body

    // Validation
    if (!item_name || !size || !nursery_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (inventory_quantity < 0 || base_price_per_unit < 0) {
      return NextResponse.json(
        { error: 'Quantities and prices must be positive' },
        { status: 400 }
      )
    }

    // Create new product
    const newProduct = {
      product_id: `PRD-${String(products.length + 1).padStart(3, '0')}`,
      nursery_id,
      item_name,
      size,
      inventory_quantity: Number(inventory_quantity) || 0,
      ordered_quantity: 0,
      base_price_per_unit: Number(base_price_per_unit),
      rate_percentage: Number(rate_percentage) || 0,
      image_url: image_url || null,
      created_at: new Date(),
    }

    products.push(newProduct)

    return NextResponse.json({
      product: newProduct,
      message: 'Product created successfully',
      barcode: generateBarcode() // Generate barcode for the new product
    }, { status: 201 })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}

