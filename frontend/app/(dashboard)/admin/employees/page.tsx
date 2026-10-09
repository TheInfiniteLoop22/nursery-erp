'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, UserPlus, Calendar, TrendingUp, Award, Users, CheckCircle, BarChart3 } from 'lucide-react'
import { formatDate } from '@/app/lib/utils'
import { toast } from 'sonner'
import { employees as employeesApi } from '@/app/lib/api'

interface Employee {
  employee_id: string
  username: string
  role: string
  created_at: string
  items_scanned: number
  orders_completed: number
  status: string
}

export default function EmployeesPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [totalEmployees, setTotalEmployees] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setCurrentPage(1)
      setSearchQuery(searchInput.trim())
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setIsLoading(true)
        const data = await employeesApi.getAll({
          page: currentPage,
          page_size: pageSize,
          search: searchQuery || undefined,
          status: statusFilter,
        })
        setEmployees(data.items)
        setTotalEmployees(data.total)
        setTotalPages(data.total_pages)
      } catch (error: unknown) {
        console.error('Error fetching employees:', error)
        toast.error('Failed to load employees')
      } finally {
        setIsLoading(false)
      }
    }
    void fetchEmployees()
  }, [currentPage, pageSize, searchQuery, statusFilter])

  const stats = {
    total: totalEmployees,
    active: employees.filter(e => e.status === 'active').length,
    totalOrders: employees.reduce((sum, e) => sum + e.orders_completed, 0),
    totalScans: employees.reduce((sum, e) => sum + e.items_scanned, 0),
  }

  const topPerformer = employees.length > 0 
    ? employees.reduce((max, emp) => emp.orders_completed > max.orders_completed ? emp : max)
    : null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-[#1F764D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading employees...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#13452D] to-[#1F764D] rounded-2xl p-5 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Employee Management</h1>
            <p className="text-sm sm:text-lg text-white/90">Manage your team and track performance</p>
          </div>
          <button 
            onClick={() => router.push('/admin/employees/create')}
            className="w-full sm:w-auto px-6 py-3 bg-white text-[#13452D] font-semibold rounded-lg hover:bg-white/90 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
          >
            <UserPlus className="h-5 w-5" />
            Add Employee
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-gradient-to-br from-[#13452D] to-[#1F764D] rounded-2xl p-4 sm:p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium mb-1">Total Employees</p>
              <p className="text-3xl sm:text-4xl font-bold">{stats.total}</p>
              <p className="text-white/70 text-xs mt-1">{stats.active} active</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <Users className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">Orders Completed</p>
              <p className="text-3xl sm:text-4xl font-bold text-[#1F764D]">{stats.totalOrders}</p>
              <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                All time
              </p>
            </div>
            <div className="p-3 bg-[#1F764D]/10 rounded-xl">
              <CheckCircle className="h-8 w-8 text-[#1F764D]" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">Total Items Scanned</p>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900">{stats.totalScans}</p>
              <p className="text-gray-500 text-xs mt-1">Across all employees</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-xl">
              <BarChart3 className="h-8 w-8 text-gray-700" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">Top Performer</p>
              <p className="text-lg font-bold text-gray-900 truncate">{topPerformer?.username || 'N/A'}</p>
              <p className="text-gray-500 text-xs mt-1">{topPerformer?.orders_completed || 0} orders</p>
            </div>
            <div className="p-3 bg-amber-100 rounded-xl">
              <Award className="h-8 w-8 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search by username or employee ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full h-12 pl-12 pr-4 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#1F764D] transition-all text-black"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
              setCurrentPage(1)
            }}
            className="h-12 sm:min-w-[170px] border-2 border-gray-200 rounded-lg px-4 bg-white text-black focus:border-[#1F764D] focus:outline-none transition-all cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="h-12 sm:min-w-[130px] border-2 border-gray-200 rounded-lg px-4 bg-white text-black focus:border-[#1F764D] focus:outline-none transition-all cursor-pointer"
          >
            <option value={12}>12 / page</option>
            <option value={24}>24 / page</option>
            <option value={48}>48 / page</option>
          </select>
        </div>
      </div>

      {/* Employees Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {employees.map((employee) => (
          <Link key={employee.employee_id} href={`/admin/employees/${employee.employee_id}`}>
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-[#1F764D] group cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#13452D] to-[#1F764D] flex items-center justify-center text-white text-xl font-bold shadow-lg">
                  {employee.username.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 group-hover:text-[#1F764D] transition-colors truncate">
                    @{employee.username}
                  </h3>
                  <p className="text-sm text-gray-600 break-all">{employee.employee_id}</p>
                  <span className={`inline-block mt-1 px-3 py-1 text-xs font-semibold rounded-full ${
                    employee.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {employee.status === 'active' ? '● Active' : '○ Inactive'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <Calendar className="h-4 w-4 text-[#1F764D]" />
              <span>Joined {formatDate(new Date(employee.created_at))}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-[#1F764D]">{employee.orders_completed}</p>
                <p className="text-xs text-gray-600 mt-1">Orders Completed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{employee.items_scanned}</p>
                <p className="text-xs text-gray-600 mt-1">Items Scanned</p>
              </div>
            </div>
          </div>
          </Link>
        ))}
      </div>

      {/* Empty State */}
      {employees.length === 0 && (
        <div className="bg-white rounded-2xl p-8 sm:p-12 text-center shadow-lg border border-gray-100">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
            <Users className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">No Employees Found</h3>
          <p className="text-gray-600 mb-6">No employees match your search criteria.</p>
          <button 
            onClick={() => { setSearchInput(''); setSearchQuery(''); setStatusFilter('all'); setCurrentPage(1) }}
            className="px-6 py-3 bg-gradient-to-r from-[#13452D] to-[#1F764D] text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300 cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">
            Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalEmployees)} of {totalEmployees}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded-lg border text-black border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm font-medium text-gray-700">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-lg border text-black border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}