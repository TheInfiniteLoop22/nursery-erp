'use client'

import { Menu, Search, User } from 'lucide-react'
import { Input } from '@/app/components/ui/input'
import { NotificationBell } from './NotificationBell'

interface HeaderProps {
  title: string
  subtitle?: string
  userName: string
  userRole: string
  onMenuToggle?: () => void
}

export function Header({ title, subtitle, userName, userRole, onMenuToggle }: HeaderProps) {
  return (
    <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          {onMenuToggle && (
            <button
              onClick={onMenuToggle}
              className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="mt-1 hidden text-sm text-gray-500 sm:block">{subtitle}</p>
          )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search..."
              className="w-64 pl-10"
            />
          </div>

          {/* Notifications - Only for Admin */}
          {userRole.toLowerCase() === 'admin' && <NotificationBell />}

          {/* User Info */}
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-gray-900">{userName}</p>
              <p className="text-xs text-gray-500">{userRole}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
              <User className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}