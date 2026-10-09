'use client'

interface PaginationControlsProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  itemLabel?: string
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
  isLoading?: boolean
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  itemLabel = 'items',
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  isLoading = false,
}: PaginationControlsProps) {
  if (totalItems === 0) {
    return null
  }

  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)

  return (
    <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm text-gray-600">
          Showing{' '}
          <span className="font-semibold text-gray-900">{startIndex + 1}</span> to{' '}
          <span className="font-semibold text-gray-900">{endIndex}</span> of{' '}
          <span className="font-semibold text-gray-900">{totalItems}</span> {itemLabel}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {onPageSizeChange && (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              Per page
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                disabled={isLoading}
                className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1F764D]"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || isLoading}
              className="px-4 py-2 border-2 border-gray-200 rounded-xl text-gray-700 font-medium hover:border-[#1F764D] hover:bg-[#1F764D]/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {totalPages > 1 && (
              <div className="flex items-center gap-1 overflow-x-auto max-w-full">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => onPageChange(page)}
                        disabled={isLoading}
                        className={`w-10 h-10 rounded-xl font-semibold transition-all ${
                          currentPage === page
                            ? 'bg-gradient-to-br from-[#13452D] to-[#1F764D] text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  }

                  if (page === currentPage - 2 || page === currentPage + 2) {
                    return (
                      <span key={page} className="px-2 text-gray-400">
                        ...
                      </span>
                    )
                  }

                  return null
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages || isLoading}
              className="px-4 py-2 border-2 border-gray-200 rounded-xl text-gray-700 font-medium hover:border-[#1F764D] hover:bg-[#1F764D]/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
