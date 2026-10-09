'use client'

import { useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '@/app/lib/api'

export type LiveEvent =
  | {
      type: 'scan'
      at: string
      order_id: string
      product_id: string
      quantity_scanned: number
      new_inventory_quantity: number
      remaining_order_quantity: number
      by: string
      by_user_id: string
    }
  | { type: 'order_status'; at: string; order_id: string; status: string; by: string }

type Handler = (event: LiveEvent) => void

const EVENT_TYPES: LiveEvent['type'][] = ['scan', 'order_status']

/**
 * Subscribes to the backend's Server-Sent Events stream (`/stream/events`) so
 * scans and order status changes show up instantly on every open screen.
 * EventSource cannot set headers, so the JWT travels as a query parameter.
 * The browser reconnects automatically if the connection drops.
 */
export function useLiveEvents(onEvent: Handler): { connected: boolean } {
  const [connected, setConnected] = useState(false)
  const handlerRef = useRef(onEvent)
  useEffect(() => {
    handlerRef.current = onEvent
  })

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    if (!token || typeof EventSource === 'undefined') return

    const source = new EventSource(`${API_BASE_URL}/stream/events?token=${encodeURIComponent(token)}`)
    source.addEventListener('ready', () => setConnected(true))
    source.onerror = () => setConnected(false)

    for (const type of EVENT_TYPES) {
      source.addEventListener(type, (message) => {
        try {
          handlerRef.current(JSON.parse((message as MessageEvent).data) as LiveEvent)
        } catch (error) {
          console.error('Bad live event payload', error)
        }
      })
    }

    return () => source.close()
  }, [])

  return { connected }
}
