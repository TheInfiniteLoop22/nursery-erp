'use client'

import { useEffect, useState } from 'react'
import { VendorDetailClient } from '../VendorDetailClient'

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const [nurseryId, setNurseryId] = useState<string | null>(null)

  useEffect(() => {
    const resolve = async () => {
      const p = await Promise.resolve(params)
      setNurseryId(p.id)
    }
    resolve()
  }, [params])

  if (!nurseryId) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#1F764D] border-t-transparent" />
      </div>
    )
  }

  return <VendorDetailClient basePath="/admin/nursery" nurseryId={nurseryId} />
}
