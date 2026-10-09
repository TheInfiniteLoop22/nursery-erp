'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/app/components/layout/sidebar'
import { Header } from '@/app/components/layout/header'
import { UserRole } from '@/app/lib/types'
import { toast } from 'sonner'
import { auth } from '@/app/lib/api'

interface NurseryLayoutProps {
  children: React.ReactNode
}

export default function NurseryLayout({ children }: NurseryLayoutProps) {
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [authState] = useState(() => {
    if (typeof window === 'undefined') {
      return { isAuthenticated: false, isLoading: true, role: null as string | null }
    }
    const token = localStorage.getItem('access_token')
    const role = localStorage.getItem('user_role')
    return {
      isAuthenticated: !!token && role === 'nursery',
      isLoading: false,
      role,
    }
  })

  const userName = typeof window !== 'undefined' ? localStorage.getItem('user_id') || 'Vendor' : 'Vendor'
  const userRole = typeof window !== 'undefined' ? (localStorage.getItem('user_role')?.toUpperCase() || 'NURSERY') as UserRole : 'NURSERY' as UserRole

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!authState.isAuthenticated) {
        toast.error('Please login to continue')
        router.push('/login')
        return
      }
    }
  }, [authState.isAuthenticated, router])

  const handleLogout = () => {
    auth.logout()
    toast.success('Logged out successfully')
    router.push('/login')
  }

  if (authState.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!authState.isAuthenticated) {
    return null
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        userRole={userRole}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Vendor dashboard"
          subtitle="Add products and manage vendor data"
          userName={userName}
          userRole={userRole}
          onMenuToggle={() => setIsSidebarOpen((prev) => !prev)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
