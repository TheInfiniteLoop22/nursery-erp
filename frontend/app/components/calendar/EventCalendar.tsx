'use client'

import { useState, useEffect } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import AddEventModal from './AddEventModal'
import { events as eventsApi } from '@/app/lib/api'
import { toast } from 'sonner'

import { useRouter } from 'next/navigation'

interface Event {
  event_id: string
  event_name: string
  event_date: string
  event_time: string
  created_by: string
  created_at: string
  updated_at: string
}

type ViewType = 'Month' | 'Week' | 'Day'

export interface CompletedPlan {
  plan_id?: string
  job_name?: string
  job_date?: string
  client_name?: string | null
  work_order_id?: string | null
}

interface EventCalendarProps {
  completedPlans?: CompletedPlan[]
}

export default function EventCalendar({ completedPlans = [] }: EventCalendarProps) {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewType, setViewType] = useState<ViewType>('Month')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchEvents = async () => {
    try {
      const data = await eventsApi.getAll()
      setEvents(data)
    } catch (error: unknown) {
      console.error('Error fetching events:', error)
      toast.error('Failed to load events')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const goToToday = () => setCurrentDate(new Date())
  const goToPrevious = () => {
    const newDate = new Date(currentDate)
    if (viewType === 'Month') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else if (viewType === 'Week') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setDate(newDate.getDate() - 1)
    }
    setCurrentDate(newDate)
  }
  const goToNext = () => {
    const newDate = new Date(currentDate)
    if (viewType === 'Month') {
      newDate.setMonth(newDate.getMonth() + 1)
    } else if (viewType === 'Week') {
      newDate.setDate(newDate.getDate() + 7)
    } else {
      newDate.setDate(newDate.getDate() + 1)
    }
    setCurrentDate(newDate)
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days: (Date | null)[] = []

    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }

    return days
  }

  const getEventsForDate = (date: Date | null) => {
    if (!date) return []
    const dateStr = date.toISOString().split('T')[0]
    return events.filter(event => event.event_date === dateStr)
  }

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const isToday = (date: Date | null) => {
    if (!date) return false
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const openEventDetails = (event: Event) => {
    setSelectedEvent(event)
  }

  const closeEventDetails = () => {
    setSelectedEvent(null)
  }

  const getWeekDays = (date: Date) => {
    const curr = new Date(date)
    const first = curr.getDate() - curr.getDay()
    const weekDays: Date[] = []
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(curr)
      day.setDate(first + i)
      weekDays.push(day)
    }
    
    return weekDays
  }

  const days = getDaysInMonth(currentDate)

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-xl">
              <CalendarIcon className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Event Calendar</h2>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-br from-[#13452D] to-[#1F764D] text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            Add Event
          </button>
        </div>

        {/* Calendar Controls */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="px-4 py-2 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
            >
              Today
            </button>
            <button
              onClick={goToPrevious}
              className="p-2 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-gray-700" />
            </button>
            <button
              onClick={goToNext}
              className="p-2 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-gray-700" />
            </button>
          </div>

          <h3 className="text-xl font-bold text-gray-900">{formatMonthYear(currentDate)}</h3>

          <div className="flex items-center gap-2">
            {(['Month', 'Week', 'Day'] as ViewType[]).map((view) => (
              <button
                key={view}
                onClick={() => setViewType(view)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  viewType === view
                    ? 'bg-gradient-to-br from-[#13452D] to-[#1F764D] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {view}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar Grid */}
        {viewType === 'Month' && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Day Headers */}
            <div className="grid grid-cols-7 bg-gray-50">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="p-3 text-center font-semibold text-gray-700 border-b border-r border-gray-200 last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7">
              {days.map((date, index) => {
                const dayEvents = getEventsForDate(date)
                const isCurrentDay = isToday(date)

                return (
                  <div
                    key={index}
                    className={`min-h-[120px] p-2 border-b border-r border-gray-200 last:border-r-0 ${
                      !date ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'
                    } ${isCurrentDay ? 'bg-[#1F764D]/5' : ''}`}
                  >
                    {date && (
                      <>
                        <div
                          className={`text-sm font-semibold mb-1 ${
                            isCurrentDay
                              ? 'bg-gradient-to-br from-[#13452D] to-[#1F764D] text-white w-7 h-7 rounded-full flex items-center justify-center'
                              : 'text-gray-700'
                          }`}
                        >
                          {date.getDate().toString().padStart(2, '0')}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 2).map((event) => (
                            <div
                              key={event.event_id}
                              className="text-xs px-2 py-1 bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white rounded-md truncate font-medium cursor-pointer"
                              title={`${event.event_name} - ${event.event_time}`}
                              onClick={() => openEventDetails(event)}
                            >
                              {event.event_name}
                            </div>
                          ))}
                          
                          {/* Render completed plans for this date */}
                          {completedPlans.filter(p => p.job_date === date.toISOString().split('T')[0]).slice(0, 2).map((plan) => (
                            <div
                              key={plan.plan_id}
                              className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-md truncate font-medium cursor-pointer"
                              title={`Completed: ${plan.job_name}`}
                              onClick={() => router.push(`/admin/planning/${plan.work_order_id}`)}
                            >
                              ✓ {plan.client_name || plan.work_order_id}
                            </div>
                          ))}

                          {(dayEvents.length + completedPlans.filter(p => p.job_date === date.toISOString().split('T')[0]).length) > 2 && (
                            <div className="text-xs text-gray-500 px-2">
                              +{dayEvents.length + completedPlans.filter(p => p.job_date === date.toISOString().split('T')[0]).length - 2} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Week View */}
        {viewType === 'Week' && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Day Headers */}
            <div className="grid grid-cols-7 bg-gray-50">
              {getWeekDays(currentDate).map((date, index) => {
                const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
                const isCurrentDay = isToday(date)
                return (
                  <div
                    key={index}
                    className={`p-3 text-center border-b border-r border-gray-200 last:border-r-0 ${
                      isCurrentDay ? 'bg-[#1F764D]/10' : ''
                    }`}
                  >
                    <div className="font-semibold text-gray-700">{dayName}</div>
                    <div className={`text-sm mt-1 ${
                      isCurrentDay
                        ? 'bg-gradient-to-br from-[#13452D] to-[#1F764D] text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto'
                        : 'text-gray-600'
                    }`}>
                      {date.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Week Grid */}
            <div className="grid grid-cols-7">
              {getWeekDays(currentDate).map((date, index) => {
                const dayEvents = getEventsForDate(date)
                const isCurrentDay = isToday(date)
                return (
                  <div
                    key={index}
                    className={`min-h-[400px] p-3 border-r border-gray-200 last:border-r-0 ${
                      isCurrentDay ? 'bg-[#1F764D]/5' : 'bg-white'
                    }`}
                  >
                    <div className="space-y-2">
                      {dayEvents.map((event) => (
                        <div
                          key={event.event_id}
                          className="p-3 bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white rounded-lg shadow-sm"
                          onClick={() => openEventDetails(event)}
                        >
                          <div className="font-semibold text-sm mb-1">{event.event_name}</div>
                          <div className="text-xs opacity-90">{event.event_time}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Day View */}
        {viewType === 'Day' && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Day Header */}
            <div className="bg-gray-50 p-4 border-b border-gray-200">
              <div className="flex items-center justify-center gap-3">
                <div className={`text-2xl font-bold ${
                  isToday(currentDate)
                    ? 'bg-gradient-to-br from-[#13452D] to-[#1F764D] text-white w-12 h-12 rounded-full flex items-center justify-center'
                    : 'text-gray-900'
                }`}>
                  {currentDate.getDate()}
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-900">
                    {currentDate.toLocaleDateString('en-US', { weekday: 'long' })}
                  </div>
                  <div className="text-sm text-gray-600">
                    {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>

            {/* Time Slots */}
            <div className="bg-white">
              {getEventsForDate(currentDate).length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <CalendarIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No events scheduled for this day</p>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="mt-4 px-6 py-2 bg-gradient-to-br from-[#13452D] to-[#1F764D] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                  >
                    Add Event
                  </button>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  {getEventsForDate(currentDate).map((event) => (
                    <div
                      key={event.event_id}
                      className="p-6 bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white rounded-xl shadow-lg"
                      onClick={() => openEventDetails(event)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-bold mb-2">{event.event_name}</h3>
                          <div className="flex items-center gap-2 text-sm opacity-90">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                              <polyline points="12 6 12 12 16 14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span>{event.event_time}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AddEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEventAdded={fetchEvents}
      />

      {selectedEvent && (
        <div
          className="fixed inset-0 z-100 w-screen h-screen flex items-center justify-center bg-black/25 backdrop-blur-[1px]"
          onClick={closeEventDetails}
        >
          <div
            className="w-full max-w-md mx-4 rounded-2xl bg-white shadow-2xl border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Event Details</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-2">Event Name</p>
              <p className="text-xl font-semibold text-gray-900 wrap-break-word">{selectedEvent.event_name}</p>
            </div>
            <div className="p-6 pt-0 flex justify-end">
              <button
                type="button"
                onClick={closeEventDetails}
                className="px-4 py-2 rounded-lg bg-linear-to-br from-[#13452D] to-[#1F764D] text-white font-semibold hover:shadow-md transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
