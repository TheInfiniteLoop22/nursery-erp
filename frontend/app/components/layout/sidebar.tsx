'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  Users,
  ScanLine,
  LogOut,
  Leaf,
  MapPinned,
  Calendar,
  Clock3,
  Settings,
  HelpCircle,
  ClipboardList,
} from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { UserRole } from '@/app/lib/types'

interface SidebarProps {
  userRole: UserRole
  onLogout: () => void
  isOpen?: boolean
  onClose?: () => void
}

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  roles: UserRole[]
  badge?: string
  /** When prefix, active for /path and /path/... (e.g. order detail under list). */
  match?: 'exact' | 'prefix'
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    roles: ['ADMIN'],
  },
  {
    title: 'Live Inv',
    href: '/admin/products',
    icon: Package,
    roles: ['ADMIN'],
    match: 'prefix',
  },
  {
    title: 'Pending Inv',
    href: '/admin/pending-inv',
    icon: Clock3,
    roles: ['ADMIN'],
  },
  {
    title: 'Work orders',
    href: '/admin/orders',
    icon: ShoppingCart,
    roles: ['ADMIN'],
  },
  {
    title: 'Day Sheet',
    href: '/admin/planning',
    icon: ClipboardList,
    roles: ['ADMIN'],
    match: 'prefix',
  },
  {
    title: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
    roles: ['ADMIN'],
  },
  {
    title: 'Employees',
    href: '/admin/employees',
    icon: Users,
    roles: ['ADMIN'],
  },
  {
    title: 'Vendors',
    href: '/admin/nursery',
    icon: Leaf,
    roles: ['ADMIN'],
    match: 'prefix',
  },
  {
    title: 'Zones',
    href: '/admin/zones',
    icon: MapPinned,
    roles: ['ADMIN'],
  },
  {
    title: 'Product Scanner',
    href: '/admin/product-scanner',
    icon: ScanLine,
    roles: ['ADMIN'],
  },
  {
    title: 'Dashboard',
    href: '/employee',
    icon: LayoutDashboard,
    roles: ['EMPLOYEE', 'HEAD_INSTALLATION', 'HEAD_MAINTENANCE'],
  },
  {
    title: 'Scan work orders',
    href: '/employee/orders',
    icon: ScanLine,
    roles: ['EMPLOYEE'],
  },
  {
    title: 'Day Sheet',
    href: '/employee/planning',
    icon: ClipboardList,
    roles: ['HEAD_INSTALLATION', 'HEAD_MAINTENANCE'],
    match: 'prefix',
  },
  {
    title: 'Product Scanner',
    href: '/employee/product-scanner',
    icon: ScanLine,
    roles: ['EMPLOYEE'],
  },
  {
    title: 'Dashboard',
    href: '/nursery',
    icon: LayoutDashboard,
    roles: ['NURSERY'],
  },
  {
    title: 'Orders',
    href: '/nursery/orders',
    icon: ShoppingCart,
    roles: ['NURSERY'],
    match: 'prefix',
  },
  {
    title: 'Day Sheet',
    href: '/nursery/planning',
    icon: ClipboardList,
    roles: ['NURSERY'],
    match: 'prefix',
  },
  {
    title: 'Inventory',
    href: '/nursery/products',
    icon: Package,
    roles: ['NURSERY'],
  },
  {
    title: 'Add Product',
    href: '/nursery/products/create',
    icon: Package,
    roles: ['NURSERY'],
  },
  {
    title: 'Request status',
    href: '/nursery/requests',
    icon: Clock3,
    roles: ['NURSERY'],
    match: 'prefix',
  },
  {
    title: 'Manage vendors',
    href: '/nursery/nursery',
    icon: Leaf,
    roles: ['NURSERY'],
    match: 'prefix',
  },
  {
    title: 'Vendor analytics',
    href: '/nursery/analytics',
    icon: BarChart3,
    roles: ['NURSERY'],
  },
  {
    title: 'Product Scanner',
    href: '/nursery/product-scanner',
    icon: ScanLine,
    roles: ['NURSERY'],
  },
]

const generalItems: NavItem[] = [
  {
    title: 'Settings',
    href: '#',
    icon: Settings,
    roles: ['ADMIN', 'EMPLOYEE', 'NURSERY', 'HEAD_INSTALLATION', 'HEAD_MAINTENANCE'],
  },
  {
    title: 'Help',
    href: '#',
    icon: HelpCircle,
    roles: ['ADMIN', 'EMPLOYEE', 'NURSERY', 'HEAD_INSTALLATION', 'HEAD_MAINTENANCE'],
  },
]

export function Sidebar({ userRole, onLogout, isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname()

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  )

  const filteredGeneralItems = generalItems.filter((item) =>
    item.roles.includes(userRole)
  )

  return (
    <>
      {isOpen && (
        <button
          onClick={onClose}
          aria-label="Close menu overlay"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-gray-200 bg-white transition-transform md:static md:z-auto md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo Section */}
        <div className="p-6">
          <div className="flex items-center">
            <img
              src="/assets/logo.svg"
              alt="Nursery ERP"
              className="h-12 w-auto object-contain"
            />
          </div>
        </div>

        {/* Menu Section */}
        <nav className="flex-1 px-4">
          <div className="mb-4">
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Menu
            </p>
            <div className="space-y-1">
              {filteredNavItems.map((item) => {
                const Icon = item.icon
                const isActive =
                  item.match === 'prefix'
                    ? pathname === item.href || pathname.startsWith(`${item.href}/`)
                    : pathname === item.href

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'text-gray-900'
                        : 'text-gray-900 hover:text-gray-900'
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-linear-to-b from-[#13452D] to-[#1F764D]" />
                    )}
                    <Icon className="h-5 w-5" />
                    <span className="flex-1">{item.title}</span>
                    {item.badge && (
                      <span className="rounded-md bg-linear-to-r from-[#13452D] to-[#1F764D] px-2 py-0.5 text-xs font-semibold text-white">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* General Section */}
          <div className="mt-8">
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              General
            </p>
            <div className="space-y-1">

              <button
                onClick={onLogout}
                className="group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:text-gray-900"
              >
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </nav>
      </aside>
    </>
  )
}
