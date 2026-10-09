'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X, Package, AlertTriangle, CalendarDays } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { notifications as notificationsApi, API_ENDPOINTS, apiCall, ApiError, auth } from '@/app/lib/api'
import { formatDateTime } from '@/app/lib/utils'
import { useLiveEvents } from '@/app/lib/useLiveEvents'

const isSubmissionNotification = (type: string) =>
  ['product_submission', 'product_submission_approved', 'inventory_update'].includes(type)

const isOrderAuditNotification = (type: string) =>
  ['order_scan', 'order_edit', 'order_approved', 'order_completed'].includes(type)

const isPlanningNotification = (type: string) =>
  ['plan_submitted', 'plan_completed'].includes(type)


export function NotificationBell() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Array<{
    notification_id: string
    type: string
    title: string
    message: string
    actor_user_id?: string | null
    reference_id?: string | null
    is_read: boolean
    created_at: string
  }>>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = async () => {
    if (!auth.isAuthenticated()) {
      setNotifications([])
      return
    }

    try {
      setIsLoading(true)
      const [feed, unread] = await Promise.all([
        notificationsApi.getAll({ page: 1, page_size: 20 }),
        notificationsApi.getUnreadCount(),
      ])
      setNotifications(feed.items)
      setUnreadCount(unread.unread_count)
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        setNotifications([])
        return
      }
      console.error('Failed to fetch notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Live updates over SSE: refresh the instant a scan or status change happens.
  const { connected: isLive } = useLiveEvents(() => {
    fetchNotifications()
  })

  useEffect(() => {
    fetchNotifications()

    // Fallback poll every 5 minutes in case the live stream is unavailable
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  const handleNotificationClick = async (item: {
    notification_id: string
    type: string
    reference_id?: string | null
  }) => {
    if (item.type === 'product_submission' || item.type === 'product_submission_approved') {
      try {
        await apiCall(API_ENDPOINTS.notificationMarkRead(item.notification_id), {
          method: 'PATCH',
        })
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } catch (error) {
        console.error('Failed to mark notification as read:', error)
      }

      if (item.reference_id) {
        router.push(`/admin/products/submissions/${item.reference_id}`)
        setIsOpen(false)
      }
      return
    }

    if (isOrderAuditNotification(item.type) && item.reference_id) {
      router.push(`/admin/orders/${item.reference_id}`)
      setIsOpen(false)
      return
    }

    if (isPlanningNotification(item.type) && item.reference_id) {
      try {
        await apiCall(API_ENDPOINTS.notificationMarkRead(item.notification_id), {
          method: 'PATCH',
        })
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } catch (error) {
        console.error('Failed to mark notification as read:', error)
      }
      router.push(`/admin/planning/${item.reference_id}`)
      setIsOpen(false)
      return
    }
  }

  return (
    <div className="relative">
      <Button 
        variant="ghost" 
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative text-black hover:text-black"
      >
        <Bell className="h-5 w-5" />
        <span
          title={isLive ? 'Live updates connected' : 'Live updates offline'}
          className={`absolute bottom-0 right-0 h-2 w-2 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-gray-300'}`}
        />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-96 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Notifications
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No notifications
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((item) => (
                  <div
                    key={item.notification_id}
                    onClick={() => handleNotificationClick(item)}
                    className={`cursor-pointer px-4 py-3 transition-colors ${
                      isSubmissionNotification(item.type)
                        ? 'bg-amber-50 hover:bg-amber-100/80 border-l-4 border-amber-500'
                        : isOrderAuditNotification(item.type)
                        ? 'bg-blue-50 hover:bg-blue-100/80 border-l-4 border-blue-500'
                        : isPlanningNotification(item.type)
                        ? 'bg-[#EAF7F0] hover:bg-[#EAF7F0]/80 border-l-4 border-[#1F764D]'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        isSubmissionNotification(item.type)
                          ? 'bg-amber-100'
                          : isOrderAuditNotification(item.type)
                          ? 'bg-blue-100'
                          : isPlanningNotification(item.type)
                          ? 'bg-[#B6DCC9]/40'
                          : 'bg-emerald-100'
                      }`}>
                        {isSubmissionNotification(item.type) ? (
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        ) : isOrderAuditNotification(item.type) ? (
                          <Package className="h-4 w-4 text-blue-600" />
                        ) : isPlanningNotification(item.type) ? (
                          <CalendarDays className="h-4 w-4 text-[#13452D]" />
                        ) : (
                          <Package className="h-4 w-4 text-emerald-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">
                          {item.title}
                          </p>
                          {isSubmissionNotification(item.type) && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                              {item.is_read ? 'Reviewed' : 'Review'}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {item.message}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {formatDateTime(item.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t border-gray-200 px-4 py-2">
              <button
                onClick={fetchNotifications}
                className="w-full text-center text-xs text-emerald-600 hover:text-emerald-700 font-medium py-1"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
