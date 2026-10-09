'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/app/components/layout/sidebar'
import { Header } from '@/app/components/layout/header'
import { UserRole } from '@/app/lib/types'
import { toast } from 'sonner'
import { auth } from '@/app/lib/api'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  
  // Get user info from localStorage
  const userName = typeof window !== 'undefined' ? localStorage.getItem('user_id') || 'Admin' : 'Admin'
  const userRole = typeof window !== 'undefined' ? (localStorage.getItem('user_role')?.toUpperCase() || 'ADMIN') as UserRole : 'ADMIN' as UserRole

  useEffect(() => {
    // Check authentication on mount
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token')
      const role = localStorage.getItem('user_role')
      
      if (!token) {
        toast.error('Please login to continue')
        router.push('/login')
        return
      }
      
      if (role !== 'admin') {
        toast.error('Admin access required')
        if (role === 'employee') {
          router.push('/employee')
        } else if (role === 'nursery') {
          router.push('/nursery')
        } else {
          router.push('/login')
        }
        return
      }
      
      // Auth state lives in localStorage, so it can only be read after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsAuthenticated(true)
      setIsLoading(false)
    }
  }, [router])

  const handleLogout = () => {
    auth.logout()
    toast.success('Logged out successfully')
    router.push('/login')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
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
          title="Admin Dashboard"
          subtitle="Manage your nursery business"
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